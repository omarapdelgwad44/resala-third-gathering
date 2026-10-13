import { supabase } from './supabase';
import { EVENT_SLUG, type EventRecord } from './types';

const COLUMNS = 'id,slug,title,slogan,org_name,honorary_word:intro,event_at,venue,map_url,hero_image_path,is_published';

export async function loadInvite(): Promise<EventRecord | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('events').select(COLUMNS).eq('slug', EVENT_SLUG).maybeSingle();
  return (data as EventRecord | null) ?? null;
}

export type InvitePatch = {
  title: string;
  slogan: string;
  honorary_word: string;
  org_name: string;
  venue: string | null;
  map_url: string | null;
  event_at: string | null;
  hero_image_path: string | null;
};

export async function saveInvite(patch: InvitePatch): Promise<string | null> {
  if (!supabase) return 'الاتصال بقاعدة البيانات غير مهيأ.';
  const { error } = await supabase
    .from('events')
    .update({
      title: patch.title,
      slogan: patch.slogan,
      intro: patch.honorary_word,
      org_name: patch.org_name,
      venue: patch.venue,
      map_url: patch.map_url,
      event_at: patch.event_at,
      hero_image_path: patch.hero_image_path,
      is_published: true,
      updated_at: new Date().toISOString(),
    })
    .eq('slug', EVENT_SLUG);
  return error ? error.message : null;
}

export async function uploadInviteImage(file: File): Promise<{ path?: string; error?: string }> {
  if (!supabase) return { error: 'الاتصال بقاعدة البيانات غير مهيأ.' };
  if (file.size > 4 * 1024 * 1024) return { error: 'حجم الصورة كبير — الحد الأقصى ٤ ميجابايت.' };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { error: 'مسموح بـ JPG أو PNG أو WebP فقط.' };
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('hero-images').upload(path, file, { contentType: file.type, upsert: false });
  return error ? { error: error.message } : { path };
}

export function photoUrl(path: string | null): string | null {
  if (!supabase || !path) return null;
  return supabase.storage.from('hero-images').getPublicUrl(path).data.publicUrl;
}

export function formatEventDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long', timeZone: 'Africa/Cairo' }).format(date);
}

export function formatEventTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(date);
}

export function toLocalInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
