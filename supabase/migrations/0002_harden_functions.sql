-- Harden callable SECURITY DEFINER functions against search_path substitution.
alter function public.is_event_admin() set search_path = '';
alter function public.get_guest_invite(uuid) set search_path = '';
alter function public.submit_rsvp(text, boolean, integer, text, text, uuid, text) set search_path = '';

-- Explicitly document that client roles cannot read the admin allowlist.
create policy "No direct client access to admin allowlist" on public.admin_allowlist
for select to anon, authenticated using (false);

create index site_metrics_event_created_idx on public.site_metrics(event_id, created_at desc);
create index rsvps_event_created_idx on public.rsvps(event_id, created_at desc);
