alter table public.events
  add column show_program boolean not null default true,
  add column show_honorees boolean not null default true,
  add column show_rsvp boolean not null default true;
