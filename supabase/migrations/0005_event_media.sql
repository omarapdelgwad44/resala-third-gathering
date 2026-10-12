create table public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  placement text not null check (placement in ('gallery', 'hero_main', 'hero_small', 'hero_bottom')),
  alt_text text not null check (char_length(alt_text) between 1 and 240),
  caption text not null default '' check (char_length(caption) <= 500),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index event_media_event_placement_order_idx
  on public.event_media(event_id, placement, sort_order);

create unique index event_media_unique_hero_slot_idx
  on public.event_media(event_id, placement)
  where placement <> 'gallery';

alter table public.event_media enable row level security;

create policy "Published event media and admins can read" on public.event_media
for select to anon, authenticated using (
  public.is_event_admin() or (is_visible and exists (
    select 1 from public.events e where e.id = event_media.event_id and e.is_published = true
  ))
);

create policy "Admins manage event media" on public.event_media
for all to authenticated using (public.is_event_admin()) with check (public.is_event_admin());

grant select on public.event_media to anon, authenticated;
grant insert, update, delete on public.event_media to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public reads event media objects" on storage.objects
for select to anon, authenticated using (bucket_id = 'event-media');

create policy "Admins upload event media objects" on storage.objects
for insert to authenticated with check (bucket_id = 'event-media' and public.is_event_admin());

create policy "Admins update event media objects" on storage.objects
for update to authenticated using (bucket_id = 'event-media' and public.is_event_admin())
with check (bucket_id = 'event-media' and public.is_event_admin());

create policy "Admins delete event media objects" on storage.objects
for delete to authenticated using (bucket_id = 'event-media' and public.is_event_admin());