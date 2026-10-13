-- Simplified invitation card: single editable document, no login required.
-- Content is edited directly from the browser with the publishable (anon) key,
-- which is an explicit product decision for this gathering.

alter table public.events
  add column if not exists slogan text not null default 'الخير بيجمعنا'
  check (char_length(slogan) between 1 and 200);

alter table public.events
  add column if not exists org_name text not null default 'جمعية رسالة — قوافل طبية'
  check (char_length(org_name) between 1 and 160);

update public.events
set is_published = true,
    org_name = coalesce(nullif(btrim(org_name), ''), 'جمعية رسالة — قوافل طبية'),
    slogan = coalesce(nullif(btrim(slogan), ''), 'الخير بيجمعنا'),
    updated_at = now()
where slug = 'resala-third-gathering';

-- Anyone with the link can edit the one invitation card.
grant update on public.events to anon;

drop policy if exists "Public can edit the invitation card" on public.events;
create policy "Public can edit the invitation card" on public.events
for update to anon, authenticated
using (slug = 'resala-third-gathering')
with check (slug = 'resala-third-gathering');

-- Anyone with the link can upload or replace the card photo.
drop policy if exists "Public uploads invitation photos" on storage.objects;
create policy "Public uploads invitation photos" on storage.objects
for insert to anon, authenticated with check (bucket_id = 'hero-images');

drop policy if exists "Public updates invitation photos" on storage.objects;
create policy "Public updates invitation photos" on storage.objects
for update to anon, authenticated
using (bucket_id = 'hero-images') with check (bucket_id = 'hero-images');

drop policy if exists "Public deletes invitation photos" on storage.objects;
create policy "Public deletes invitation photos" on storage.objects
for delete to anon, authenticated using (bucket_id = 'hero-images');
