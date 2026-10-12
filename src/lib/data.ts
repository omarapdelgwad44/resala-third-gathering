import { supabase } from './supabase';
import { EVENT_SLUG, type EventRecord, type ProgramItem, type Honoree, type GuestInvite } from './types';

export type PublicSiteData = {
  event: EventRecord | null;
  program: ProgramItem[];
  honorees: Honoree[];
};

export async function loadPublicSite(): Promise<PublicSiteData> {
  if (!supabase) return { event: null, program: [], honorees: [] };
  const { data: event } = await supabase
    .from('events')
    .select('id,slug,title,intro,event_at,venue,map_url,is_published,show_program,show_honorees,show_rsvp')
    .eq('slug', EVENT_SLUG)
    .eq('is_published', true)
    .maybeSingle();
  if (!event) return { event: null, program: [], honorees: [] };

  const [programResult, honoreeResult] = await Promise.all([
    supabase.from('program_items').select('*').eq('event_id', event.id).eq('is_visible', true).order('sort_order'),
    supabase.from('honorees').select('*').eq('event_id', event.id).eq('is_visible', true).order('sort_order'),
  ]);
  return {
    event: event as EventRecord,
    program: (programResult.data ?? []) as ProgramItem[],
    honorees: (honoreeResult.data ?? []) as Honoree[],
  };
}

export async function loadGuestInvite(token: string): Promise<GuestInvite | null> {
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data, error } = await supabase.rpc('get_guest_invite', { p_token: token });
  if (error || !data || typeof data !== 'object') return null;
  return data as GuestInvite;
}

export async function recordMetric(eventId: string, metric: 'page_view' | 'rsvp_click') {
  if (!supabase) return;
  await supabase.from('site_metrics').insert({ event_id: eventId, metric });
}

export function photoUrl(path: string | null): string | null {
  if (!supabase || !path) return null;
  return supabase.storage.from('honoree-photos').getPublicUrl(path).data.publicUrl;
}

export function formatEventDate(value: string | null): { date: string; time: string } {
  if (!value) return { date: 'سيُعلن الموعد قريبًا', time: 'ترقّبوا التفاصيل' };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full', timeZone: 'Africa/Cairo' }).format(date),
    time: new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(date),
  };
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('');
}
