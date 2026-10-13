export type EventRecord = {
  id: string;
  slug: string;
  title: string;
  slogan: string;
  honorary_word: string;
  org_name: string;
  event_at: string | null;
  venue: string | null;
  map_url: string | null;
  hero_image_path: string | null;
  is_published: boolean;
};

export type InviteForm = {
  title: string;
  slogan: string;
  honorary_word: string;
  org_name: string;
  venue: string;
  map_url: string;
  event_at: string;
};

export const EVENT_SLUG = 'resala-third-gathering';

export const DEFAULT_INVITE: InviteForm = {
  title: 'قافلة طبية',
  slogan: 'الخير بيجمعنا',
  honorary_word: 'بتشريف من جمعية رسالة، نتشرف بدعوتكم لحضور القافلة الطبية، ولنكمل معًا حكاية الخير والعطاء.',
  org_name: 'جمعية رسالة — قوافل طبية',
  venue: '',
  map_url: '',
  event_at: '',
};
