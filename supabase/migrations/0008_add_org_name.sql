-- Add org_name column if migration 0007 was not applied
alter table public.events
  add column if not exists org_name text not null default 'جمعية رسالة — قوافل طبية'
  check (char_length(org_name) between 1 and 160);

alter table public.events
  add column if not exists slogan text not null default 'الخير بيجمعنا'
  check (char_length(slogan) between 1 and 200);

-- Update existing row
update public.events
set org_name = coalesce(nullif(btrim(org_name), ''), 'جمعية رسالة — قوافل طبية'),
    slogan = coalesce(nullif(btrim(slogan), ''), 'الخير بيجمعنا'),
    updated_at = now()
where slug = 'resala-third-gathering';
