export type EventRecord = {
  id: string;
  slug: string;
  title: string;
  intro: string;
  event_at: string | null;
  venue: string | null;
  map_url: string | null;
  is_published: boolean;
  show_program: boolean;
  show_honorees: boolean;
  show_rsvp: boolean;
};

export type ProgramItem = {
  id: string;
  event_id: string;
  title: string;
  starts_at: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type Honoree = {
  id: string;
  event_id: string;
  name: string;
  role: string;
  message: string;
  photo_path: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type GuestInvite = {
  guest_name: string;
  personal_message: string;
  honoree_name: string | null;
  honoree_role: string | null;
  honoree_message: string | null;
  honoree_photo_path: string | null;
  event_title: string;
};

export const EVENT_SLUG = 'resala-third-gathering';
