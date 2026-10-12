alter table public.events
  add column if not exists hero_image_path text
  check (hero_image_path is null or char_length(hero_image_path) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hero-images', 'hero-images', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public reads hero image objects" on storage.objects
for select to anon, authenticated using (bucket_id = 'hero-images');

create policy "Admins upload hero image objects" on storage.objects
for insert to authenticated with check (bucket_id = 'hero-images' and public.is_event_admin());

create policy "Admins update hero image objects" on storage.objects
for update to authenticated using (bucket_id = 'hero-images' and public.is_event_admin())
with check (bucket_id = 'hero-images' and public.is_event_admin());

create policy "Admins delete hero image objects" on storage.objects
for delete to authenticated using (bucket_id = 'hero-images' and public.is_event_admin());