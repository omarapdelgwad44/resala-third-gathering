-- Resala invitation backend: public event content, private RSVP data, and admin-only editing.
-- No service-role key is used by the browser application.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 2 and 80),
  title text not null default 'حفل الثلث الثالث من العام' check (char_length(title) between 2 and 180),
  intro text not null default 'في رسالة، كل حكاية خير وراها ناس كتير. تعالوا نرجع نتقابل، نفتكر أثرنا، ونحتفي باللي شاركونا الرحلة.' check (char_length(intro) <= 1200),
  event_at timestamptz,
  venue text check (venue is null or char_length(venue) <= 240),
  map_url text check (map_url is null or (char_length(map_url) <= 1000 and map_url ~ '^https://')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_allowlist (
  email text primary key check (email = lower(btrim(email)) and char_length(email) between 5 and 254),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.program_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  starts_at time,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.honorees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  role text not null default '' check (char_length(role) <= 120),
  message text not null default '' check (char_length(message) <= 1200),
  photo_path text check (photo_path is null or char_length(photo_path) <= 500),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guest_invites (
  token uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null check (char_length(guest_name) between 1 and 120),
  honoree_id uuid references public.honorees(id) on delete set null,
  personal_message text not null default '' check (char_length(personal_message) <= 1200),
  created_at timestamptz not null default now()
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  invite_token uuid unique references public.guest_invites(token) on delete set null,
  guest_name text not null check (char_length(guest_name) between 2 and 120),
  phone text check (phone is null or char_length(phone) <= 32),
  attending boolean not null,
  party_size smallint not null default 1 check (party_size between 0 and 8),
  message text not null default '' check (char_length(message) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((attending and party_size >= 1) or (not attending and party_size = 0))
);

create table public.site_metrics (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  metric text not null check (metric in ('page_view', 'rsvp_click', 'rsvp_submitted')),
  created_at timestamptz not null default now()
);

insert into public.events (slug, title, is_published)
values ('resala-third-gathering', 'حفل الثلث الثالث من العام', false);

insert into public.program_items (event_id, title, sort_order)
select id, 'استقبال وترحيب', 1 from public.events where slug = 'resala-third-gathering';
insert into public.program_items (event_id, title, sort_order)
select id, 'كلمة شكر وتقدير', 2 from public.events where slug = 'resala-third-gathering';
insert into public.program_items (event_id, title, sort_order)
select id, 'تكريم أهل الأثر', 3 from public.events where slug = 'resala-third-gathering';

create or replace function public.is_event_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_allowlist a
    where a.active = true
      and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_event_admin() from public;
grant execute on function public.is_event_admin() to anon, authenticated;

create or replace function public.get_guest_invite(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'guest_name', i.guest_name,
    'personal_message', i.personal_message,
    'honoree_name', h.name,
    'honoree_role', h.role,
    'honoree_message', h.message,
    'honoree_photo_path', h.photo_path,
    'event_title', e.title
  )
  from public.guest_invites i
  join public.events e on e.id = i.event_id and e.is_published = true
  left join public.honorees h on h.id = i.honoree_id and h.is_visible = true
  where i.token = p_token
  limit 1;
$$;

revoke all on function public.get_guest_invite(uuid) from public;
grant execute on function public.get_guest_invite(uuid) to anon, authenticated;

create or replace function public.submit_rsvp(
  p_guest_name text,
  p_attending boolean,
  p_party_size integer default 1,
  p_phone text default null,
  p_message text default '',
  p_invite_token uuid default null,
  p_honeypot text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_invited_name text;
  v_name text := btrim(coalesce(p_guest_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_party_size integer := coalesce(p_party_size, 1);
begin
  -- Quietly accept honeypot submissions without persisting them.
  if length(btrim(coalesce(p_honeypot, ''))) > 0 then
    return jsonb_build_object('ok', true);
  end if;

  if p_attending is null then raise exception 'Please choose an RSVP response'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Name must be 2 to 120 characters'; end if;
  if char_length(v_phone) > 32 then raise exception 'Phone number is too long'; end if;
  if char_length(v_message) > 1200 then raise exception 'Message is too long'; end if;
  if p_attending and (v_party_size < 1 or v_party_size > 8) then raise exception 'Party size must be from 1 to 8'; end if;
  if not p_attending then v_party_size := 0; end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = 'resala-third-gathering' and e.is_published = true
  limit 1;
  if v_event_id is null then raise exception 'RSVP is not open yet'; end if;

  if p_invite_token is not null then
    select i.guest_name into v_invited_name
    from public.guest_invites i
    where i.token = p_invite_token and i.event_id = v_event_id
    limit 1;
    if v_invited_name is null then raise exception 'Invitation link is invalid'; end if;
  end if;

  insert into public.rsvps (event_id, invite_token, guest_name, phone, attending, party_size, message)
  values (v_event_id, p_invite_token, v_name, v_phone, p_attending, v_party_size, v_message)
  on conflict (invite_token) do update set
    guest_name = excluded.guest_name,
    phone = excluded.phone,
    attending = excluded.attending,
    party_size = excluded.party_size,
    message = excluded.message,
    updated_at = now();

  insert into public.site_metrics (event_id, metric) values (v_event_id, 'rsvp_submitted');
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_rsvp(text, boolean, integer, text, text, uuid, text) from public;
grant execute on function public.submit_rsvp(text, boolean, integer, text, text, uuid, text) to anon, authenticated;

alter table public.events enable row level security;
alter table public.admin_allowlist enable row level security;
alter table public.program_items enable row level security;
alter table public.honorees enable row level security;
alter table public.guest_invites enable row level security;
alter table public.rsvps enable row level security;
alter table public.site_metrics enable row level security;

create policy "Published event and admins can read event" on public.events
for select to anon, authenticated using (is_published = true or public.is_event_admin());
create policy "Admins manage event" on public.events
for all to authenticated using (public.is_event_admin()) with check (public.is_event_admin());

create policy "Published program and admins can read" on public.program_items
for select to anon, authenticated using (
  public.is_event_admin() or (is_visible and exists (
    select 1 from public.events e where e.id = program_items.event_id and e.is_published = true
  ))
);
create policy "Admins manage program" on public.program_items
for all to authenticated using (public.is_event_admin()) with check (public.is_event_admin());

create policy "Published honorees and admins can read" on public.honorees
for select to anon, authenticated using (
  public.is_event_admin() or (is_visible and exists (
    select 1 from public.events e where e.id = honorees.event_id and e.is_published = true
  ))
);
create policy "Admins manage honorees" on public.honorees
for all to authenticated using (public.is_event_admin()) with check (public.is_event_admin());

create policy "Admins manage guest invites" on public.guest_invites
for all to authenticated using (public.is_event_admin()) with check (public.is_event_admin());

create policy "Admins read RSVP responses" on public.rsvps
for select to authenticated using (public.is_event_admin());
create policy "Admins update RSVP responses" on public.rsvps
for update to authenticated using (public.is_event_admin()) with check (public.is_event_admin());
create policy "Admins delete RSVP responses" on public.rsvps
for delete to authenticated using (public.is_event_admin());

create policy "Public can record anonymous event metrics" on public.site_metrics
for insert to anon, authenticated with check (
  metric in ('page_view', 'rsvp_click', 'rsvp_submitted') and exists (
    select 1 from public.events e where e.id = site_metrics.event_id and e.is_published = true
  )
);
create policy "Admins read aggregate event metrics" on public.site_metrics
for select to authenticated using (public.is_event_admin());

-- No direct grants or policies expose the email allowlist or invite records.
grant select on public.events, public.program_items, public.honorees to anon, authenticated;
grant insert, update, delete on public.events, public.program_items, public.honorees to authenticated;
grant select, insert, update, delete on public.guest_invites, public.rsvps to authenticated;
grant insert, select on public.site_metrics to anon, authenticated;

-- Public bucket supports display of images approved for the invitation; only allowlisted admins may upload/change/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('honoree-photos', 'honoree-photos', true, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public reads approved honoree photo objects" on storage.objects
for select to anon, authenticated using (bucket_id = 'honoree-photos');
create policy "Admins upload honoree photos" on storage.objects
for insert to authenticated with check (bucket_id = 'honoree-photos' and public.is_event_admin());
create policy "Admins update honoree photos" on storage.objects
for update to authenticated using (bucket_id = 'honoree-photos' and public.is_event_admin()) with check (bucket_id = 'honoree-photos' and public.is_event_admin());
create policy "Admins delete honoree photos" on storage.objects
for delete to authenticated using (bucket_id = 'honoree-photos' and public.is_event_admin());

-- The RSVP form is intentionally closed until the organizer publishes the event after adding confirmed details.
