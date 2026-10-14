-- Transportation details shown under the venue/map section on the invitation card.

alter table public.events
  add column if not exists transport text
  check (transport is null or char_length(transport) <= 1000);
