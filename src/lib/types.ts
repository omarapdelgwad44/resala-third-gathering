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
  title: 'حفلة الثلث الثاني << Zone 8 >>',
  slogan: 'After All of That, We're Here',
  honorary_word: 'بكل الحب، تتشرف جمعية رسالة بدعوتكم لحضور حفلتنا، ومشاركتنا لحظات مميزة مليانة فرحة وذكريات حلوة 💙✨\n\nوجودكم معانا هو اللي بيكمّل فرحتنا، ومستنيينكم تكونوا جزء من اليوم المميز ده، ونحتفل سوا بكل لحظة حلوة جمعتنا في رسالة. 💜\n\nمستنيينكم تنورونا، لأن فرحتنا مش هتكمل غير بيكم! 🎉',
  org_name: 'جمعية رسالة — قوافل طبية المهندسين',
  venue: '',
  map_url: '',
  event_at: '',
};
