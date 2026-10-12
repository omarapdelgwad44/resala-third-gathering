-- Keep privileged implementations outside PostgREST's exposed public schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter function public.is_event_admin() set schema private;
alter function public.get_guest_invite(uuid) set schema private;
alter function public.submit_rsvp(text, boolean, integer, text, text, uuid, text) set schema private;

alter function private.is_event_admin() set search_path = '';
alter function private.get_guest_invite(uuid) set search_path = '';
alter function private.submit_rsvp(text, boolean, integer, text, text, uuid, text) set search_path = '';

revoke all on function private.is_event_admin() from public;
revoke all on function private.get_guest_invite(uuid) from public;
revoke all on function private.submit_rsvp(text, boolean, integer, text, text, uuid, text) from public;
grant execute on function private.is_event_admin() to anon, authenticated;
grant execute on function private.get_guest_invite(uuid) to anon, authenticated;
grant execute on function private.submit_rsvp(text, boolean, integer, text, text, uuid, text) to anon, authenticated;

create or replace function public.is_event_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_event_admin(); $$;

create or replace function public.get_guest_invite(p_token uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_guest_invite(p_token); $$;

create or replace function public.submit_rsvp(
  p_guest_name text,
  p_attending boolean,
  p_party_size integer,
  p_phone text,
  p_message text,
  p_invite_token uuid,
  p_honeypot text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.submit_rsvp(p_guest_name, p_attending, p_party_size, p_phone, p_message, p_invite_token, p_honeypot); $$;

revoke all on function public.is_event_admin() from public;
revoke all on function public.get_guest_invite(uuid) from public;
revoke all on function public.submit_rsvp(text, boolean, integer, text, text, uuid, text) from public;
grant execute on function public.is_event_admin() to anon, authenticated;
grant execute on function public.get_guest_invite(uuid) to anon, authenticated;
grant execute on function public.submit_rsvp(text, boolean, integer, text, text, uuid, text) to anon, authenticated;
