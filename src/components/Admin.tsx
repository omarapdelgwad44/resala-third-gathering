import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { EVENT_SLUG, type EventRecord, type Honoree, type ProgramItem } from '../lib/types';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { photoUrl } from '../lib/data';

type Tab = 'event' | 'program' | 'honorees' | 'invites' | 'rsvps' | 'metrics';
type Rsvp = { id: string; guest_name: string; phone: string | null; attending: boolean; party_size: number; message: string; created_at: string };
type Metric = { metric: 'page_view' | 'rsvp_click' | 'rsvp_submitted'; created_at: string };
const tabNames: Record<Tab, string> = { event: 'بيانات اللقاء', program: 'برنامج الحفل', honorees: 'أهل الأثر', invites: 'الدعوات الشخصية', rsvps: 'ردود الحضور', metrics: 'أداء الموقع' };

function localDateTime(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function toCsv(rows: Rsvp[]) {
  const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return ['الاسم,الحضور,عدد الأفراد,الهاتف,الرسالة,وقت الرد', ...rows.map((r) => [r.guest_name, r.attending ? 'حاضر' : 'معتذر', r.party_size, r.phone, r.message, new Date(r.created_at).toLocaleString('ar-EG')].map(esc).join(','))].join('\r\n');
}

export function Admin({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('event');
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [program, setProgram] = useState<ProgramItem[]>([]);
  const [honorees, setHonorees] = useState<Honoree[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [busy, setBusy] = useState(false);
  const [newProgramTitle, setNewProgramTitle] = useState('');
  const [newProgramTime, setNewProgramTime] = useState('');
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [honoreeName, setHonoreeName] = useState('');
  const [honoreeRole, setHonoreeRole] = useState('');
  const [honoreeMessage, setHonoreeMessage] = useState('');
  const [honoreePhoto, setHonoreePhoto] = useState<File | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteHonoree, setInviteHonoree] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    const { data: eventData, error: eventError } = await supabase.from('events').select('*').eq('slug', EVENT_SLUG).single();
    if (eventError || !eventData) { setNotice('تعذّر تحميل بيانات اللقاء. تأكدي من صلاحية حساب الإدارة.'); setBusy(false); return; }
    const [p, h, r, m] = await Promise.all([
      supabase.from('program_items').select('*').eq('event_id', eventData.id).order('sort_order'),
      supabase.from('honorees').select('*').eq('event_id', eventData.id).order('sort_order'),
      supabase.from('rsvps').select('id,guest_name,phone,attending,party_size,message,created_at').eq('event_id', eventData.id).order('created_at', { ascending: false }).limit(500),
      supabase.from('site_metrics').select('metric,created_at').eq('event_id', eventData.id).order('created_at', { ascending: false }).limit(5000),
    ]);
    setEvent(eventData as EventRecord);
    setProgram((p.data ?? []) as ProgramItem[]);
    setHonorees((h.data ?? []) as Honoree[]);
    setRsvps((r.data ?? []) as Rsvp[]);
    setMetrics((m.data ?? []) as Metric[]);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!session || !supabase) { setIsAdmin(false); setChecking(false); return; }
    supabase.rpc('is_event_admin').then(({ data, error }) => {
      if (!alive) return;
      setIsAdmin(Boolean(data) && !error);
      setChecking(false);
      if (data && !error) void loadData();
    });
    return () => { alive = false; };
  }, [session, loadData]);

  const stats = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = metrics.filter((m) => new Date(m.created_at).getTime() >= since);
    return {
      views: recent.filter((m) => m.metric === 'page_view').length,
      clicks: recent.filter((m) => m.metric === 'rsvp_click').length,
      yes: rsvps.filter((r) => r.attending).length,
      no: rsvps.filter((r) => !r.attending).length,
    };
  }, [metrics, rsvps]);

  async function requestLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setNotice('جاري تسجيل الدخول…');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setNotice(error ? 'بيانات الدخول غير صحيحة. تحققي من البريد وكلمة المرور ثم حاولي مرة أخرى.' : 'تم تسجيل الدخول؛ جاري فتح لوحة الإدارة…');
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null); setIsAdmin(false); setNotice('تم تسجيل الخروج.');
  }

  async function saveEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !event) return;
    const f = new FormData(e.currentTarget);
    const isPublished = f.get('is_published') === 'on';
    const dateLocal = String(f.get('event_at') ?? '');
    const venue = String(f.get('venue') ?? '').trim();
    if (isPublished && (!dateLocal || !venue)) { setNotice('أضيفي الموعد والمكان قبل نشر الدعوة للعامة.'); return; }
    setBusy(true);
    const photoExt = heroImage?.type === 'image/png' ? 'png' : heroImage?.type === 'image/webp' ? 'webp' : 'jpg';
    const heroPath = heroImage ? `${crypto.randomUUID()}.${photoExt}` : (event.hero_image_path || null);
    if (heroImage) {
      // @ts-ignore
      const { error: uploadError } = await supabase.storage.from('hero-images').upload(heroPath, heroImage, { contentType: heroImage.type, upsert: false });
      if (uploadError) { setBusy(false); setNotice('تعذّر رفع الصورة الرئيسية. استخدمي JPG أو PNG أو WebP حتى ٤ ميجابايت.'); return; }
    }
    const patch = {
      title: String(f.get('title') ?? '').trim(),
      intro: String(f.get('intro') ?? '').trim(),
      event_at: dateLocal ? new Date(dateLocal).toISOString() : null,
      venue: venue || null,
      map_url: String(f.get('map_url') ?? '').trim() || null,
      is_published: isPublished,
      show_program: f.get('show_program') === 'on',
      show_honorees: f.get('show_honorees') === 'on',
      show_rsvp: f.get('show_rsvp') === 'on',
      hero_image_path: heroPath,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('events').update(patch).eq('id', event.id);
    setBusy(false);
    if (error) setNotice('تعذّر حفظ التغييرات. راجعي الاتصال ثم حاولي مجددًا.');
    else { setNotice(isPublished ? 'تم حفظ التغييرات ونشر الدعوة.' : 'تم حفظ التغييرات كمسودة غير منشورة.'); await loadData(); }
  }

  async function addProgram(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !event || !newProgramTitle.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('program_items').insert({ event_id: event.id, title: newProgramTitle.trim(), starts_at: newProgramTime || null, sort_order: program.length + 1, is_visible: true });
    setBusy(false);
    if (error) setNotice('تعذّر إضافة الفقرة.'); else { setNewProgramTitle(''); setNewProgramTime(''); setNotice('أُضيفت الفقرة.'); await loadData(); }
  }
  async function saveProgram(item: ProgramItem) {
    if (!supabase) return;
    const { error } = await supabase.from('program_items').update({ title: item.title, starts_at: item.starts_at, sort_order: item.sort_order, is_visible: item.is_visible }).eq('id', item.id);
    setNotice(error ? 'تعذّر حفظ الفقرة.' : 'تم حفظ الفقرة.');
    if (!error) await loadData();
  }
  async function deleteProgram(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('program_items').delete().eq('id', id);
    setNotice(error ? 'تعذّر حذف الفقرة.' : 'تم حذف الفقرة.');
    if (!error) await loadData();
  }

  async function addHonoree(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !event || !honoreeName.trim()) return;
    setBusy(true);
    let photoPath: string | null = null;
    if (honoreePhoto) {
      const ext = honoreePhoto.type === 'image/png' ? 'png' : honoreePhoto.type === 'image/webp' ? 'webp' : 'jpg';
      photoPath = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('honoree-photos').upload(photoPath, honoreePhoto, { contentType: honoreePhoto.type, upsert: false });
      if (uploadError) { setBusy(false); setNotice('تعذّر رفع الصورة. استخدمي JPG أو PNG أو WebP حتى ٤ ميجابايت.'); return; }
    }
    const { error } = await supabase.from('honorees').insert({ event_id: event.id, name: honoreeName.trim(), role: honoreeRole.trim(), message: honoreeMessage.trim(), photo_path: photoPath, sort_order: honorees.length + 1, is_visible: true });
    setBusy(false);
    if (error) setNotice('تعذّر إضافة الاسم.');
    else { setHonoreeName(''); setHonoreeRole(''); setHonoreeMessage(''); setHonoreePhoto(null); setNotice('أُضيفت بطاقة التكريم.'); await loadData(); }
  }
  async function toggleHonoree(person: Honoree) {
    if (!supabase) return;
    const { error } = await supabase.from('honorees').update({ is_visible: !person.is_visible }).eq('id', person.id);
    if (error) setNotice('تعذّر تحديث الظهور.'); else await loadData();
  }
  async function deleteHonoree(person: Honoree) {
    if (!supabase) return;
    if (person.photo_path) await supabase.storage.from('honoree-photos').remove([person.photo_path]);
    const { error } = await supabase.from('honorees').delete().eq('id', person.id);
    setNotice(error ? 'تعذّر حذف البطاقة.' : 'حُذفت بطاقة التكريم والصورة المرتبطة بها.');
    if (!error) await loadData();
  }

  async function createInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !event || !inviteName.trim()) return;
    const { data, error } = await supabase.from('guest_invites').insert({ event_id: event.id, guest_name: inviteName.trim(), personal_message: inviteMessage.trim(), honoree_id: inviteHonoree || null }).select('token').single();
    if (error || !data) { setNotice('تعذّر إنشاء الرابط الشخصي.'); return; }
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('invite', data.token);
    setInviteLink(url.toString()); setInviteName(''); setInviteMessage(''); setInviteHonoree(''); setNotice('تم إنشاء رابط الدعوة الشخصي.');
  }
  async function copyInvite() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setNotice('تم نسخ رابط الدعوة.');
  }
  function downloadCsv() {
    const blob = new Blob(['\ufeff', toCsv(rsvps)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = href; a.download = 'resala-rsvp.csv'; a.click(); URL.revokeObjectURL(href);
  }

  if (!hasSupabaseConfig || !supabase) return <div className="admin-page"><div className="login-card"><h2>إعداد الموقع</h2><p>إعدادات الاتصال بقاعدة البيانات غير مكتملة. أضيفي متغيرات Supabase إلى إعدادات البناء.</p><button className="admin-button" onClick={onExit}>العودة للدعوة</button></div></div>;
  if (checking) return <div className="admin-page"><p className="loading-note">بنراجع صلاحية الدخول…</p></div>;
  if (!session) return <div className="admin-page"><div className="login-card"><div className="admin-title"><img src={`${import.meta.env.BASE_URL}assets/resala-logo.png`} alt="شعار رسالة" /><div><h2>إدارة حكايات رسالة</h2><p>مساحة خاصة بفريق التنظيم</p></div></div><p>سجّلي الدخول ببريد الإدارة المصرّح به وكلمة المرور.</p><form onSubmit={requestLogin}><label className="admin-field">البريد الإلكتروني<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="admin-field">كلمة المرور<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="button button-blue" type="submit">تسجيل الدخول</button></form><p className="login-status" role="status">{notice}</p><button className="admin-button" onClick={onExit}>العودة للدعوة</button></div></div>;
  if (!isAdmin) return <div className="admin-page"><div className="login-card"><h2>الحساب غير مصرّح له</h2><p>تم تسجيل الدخول، لكن هذا البريد غير موجود في قائمة إدارة الموقع. تواصلي مع مالك المشروع لإضافته.</p><p className="login-status" role="status">{notice}</p><button className="admin-button" onClick={() => void signOut()}>تسجيل الخروج</button> <button className="admin-button" onClick={onExit}>العودة للدعوة</button></div></div>;

  return <main className="admin-page"><div className="admin-shell">
    <header className="admin-header"><div className="admin-title"><img src={`${import.meta.env.BASE_URL}assets/resala-logo.png`} alt="شعار رسالة" /><div><h1>إدارة حكايات رسالة</h1><p>{session.user.email} · {event?.is_published ? 'الدعوة منشورة' : 'مسودة خاصة'}</p></div></div><div className="admin-actions"><button className="admin-button" onClick={onExit}>معاينة الدعوة</button><button className="admin-button" onClick={() => void signOut()}>خروج آمن</button></div></header>
    <div className="admin-grid">
      <nav className="admin-nav" aria-label="أقسام لوحة الإدارة">{(Object.keys(tabNames) as Tab[]).map((key) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{tabNames[key]}</button>)}</nav>
      <div className="admin-main">
        <div className="admin-stats"><div className="admin-stat"><small>مشاهدات الصفحة · ٧ أيام</small><strong>{stats.views}</strong></div><div className="admin-stat"><small>نقرات تأكيد الحضور</small><strong>{stats.clicks}</strong></div><div className="admin-stat"><small>مؤكدون</small><strong>{stats.yes}</strong></div><div className="admin-stat"><small>اعتذارات</small><strong>{stats.no}</strong></div></div>
        {notice && <div className="admin-message" role="status">{notice}</div>}
        {tab === 'event' && event && <section className="admin-panel"><h2>بيانات الدعوة</h2><p>عدّلي نص الدعوة والتفاصيل. ستظل التغييرات خاصة حتى تفعّلي النشر.</p><form onSubmit={saveEvent}>
          <div className="admin-form-grid"><label className="admin-field">عنوان اللقاء<input name="title" required maxLength={180} defaultValue={event.title} /></label><label className="admin-field">المكان<input name="venue" maxLength={240} defaultValue={event.venue ?? ''} placeholder="اسم القاعة أو العنوان" /></label><label className="admin-field full">نص الترحيب<textarea name="intro" maxLength={1200} defaultValue={event.intro} /></label><label className="admin-field">الموعد والتوقيت المحلي<input name="event_at" type="datetime-local" defaultValue={localDateTime(event.event_at)} /></label><label className="admin-field">رابط الخريطة<input name="map_url" type="url" placeholder="https://…" defaultValue={event.map_url ?? ''} /></label></div>
          <div className="admin-form-grid"><label className="admin-field">الصورة الرئيسية<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setHeroImage(e.target.files?.[0] ?? null)} defaultValue={event.hero_image_path ? photoUrl(event.hero_image_path) || '' : ''} /></label></div>
          <div className="admin-checks"><label><input name="show_program" type="checkbox" defaultChecked={event.show_program} /> عرض البرنامج</label><label><input name="show_honorees" type="checkbox" defaultChecked={event.show_honorees} /> عرض قسم التكريم</label><label><input name="show_rsvp" type="checkbox" defaultChecked={event.show_rsvp} /> عرض RSVP</label></div>
          <div className="admin-checks"><label><input name="is_published" type="checkbox" defaultChecked={event.is_published} /> نشر الدعوة للعامة</label></div>
          <div className="consent-admin-note">قبل النشر: تأكدي من صحة التاريخ والمكان، ومن وجود موافقة أصحاب الصور والأسماء على عرضها.</div>
          <div className="admin-toolbar"><button className="button button-blue" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ التغييرات'}</button><span className="admin-status">{event.is_published ? 'الرابط العام متاح' : 'المحتوى غير منشور'}</span></div>
        </form></section>}
        {tab === 'program' && <section className="admin-panel"><h2>برنامج الحفل</h2><p>أضيفي فقرات اللقاء وأوقاتها، ثم احفظي كل تعديل.</p><div className="admin-list">{program.map((item) => <div className="admin-list-row" key={item.id}><label className="admin-field" style={{ flex: 1 }}>الفقرة<input value={item.title} onChange={(e) => setProgram((list) => list.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x))} /></label><label className="admin-field">الوقت<input type="time" value={item.starts_at?.slice(0, 5) ?? ''} onChange={(e) => setProgram((list) => list.map((x) => x.id === item.id ? { ...x, starts_at: e.target.value || null } : x))} /></label><label className="admin-field">ترتيب<input type="number" value={item.sort_order} onChange={(e) => setProgram((list) => list.map((x) => x.id === item.id ? { ...x, sort_order: Number(e.target.value) } : x))} /></label><label><input type="checkbox" checked={item.is_visible} onChange={(e) => setProgram((list) => list.map((x) => x.id === item.id ? { ...x, is_visible: e.target.checked } : x))} /> ظاهر</label><button className="admin-button" onClick={() => void saveProgram(item)}>حفظ</button><button className="admin-danger" onClick={() => void deleteProgram(item.id)}>حذف</button></div>)}</div><form className="admin-toolbar" onSubmit={addProgram}><input className="admin-button" value={newProgramTitle} onChange={(e) => setNewProgramTitle(e.target.value)} placeholder="اسم فقرة جديدة" required /><input className="admin-button" type="time" value={newProgramTime} onChange={(e) => setNewProgramTime(e.target.value)} /><button className="admin-button primary">إضافة فقرة</button></form></section>}
        {tab === 'honorees' && <section className="admin-panel"><h2>إضافة بطاقة تكريم</h2><p>ارفعي صورًا مصرحًا بنشرها فقط. الصور تُحفظ في مخزن عام للعرض، والرفع والحذف مقتصران على الإدارة.</p><div className="consent-admin-note">تأكدي من موافقة كل شخص قبل إضافة اسمه أو صورته. الصورة المرفوعة ستكون قابلة للمشاهدة ضمن الدعوة المنشورة.</div><form onSubmit={addHonoree} className="admin-honoree-form"><label className="admin-field">الاسم<input value={honoreeName} onChange={(e) => setHonoreeName(e.target.value)} maxLength={120} required /></label><label className="admin-field">صفة/فترة المشاركة<input value={honoreeRole} onChange={(e) => setHonoreeRole(e.target.value)} maxLength={120} placeholder="مثال: من فريق رسالة سابقًا" /></label><label className="admin-field wide">كلمة التقدير<textarea value={honoreeMessage} onChange={(e) => setHonoreeMessage(e.target.value)} maxLength={1200} /></label><label className="admin-field wide">صورة JPG / PNG / WebP · حتى ٤ ميجابايت<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setHonoreePhoto(e.target.files?.[0] ?? null)} /></label><button className="button button-red" disabled={busy}>{busy ? 'جاري الإضافة…' : 'إضافة إلى الأرشيف'}</button></form><h2 style={{ marginTop: 26 }}>البطاقات الحالية</h2><div className="admin-list">{honorees.length ? honorees.map((p) => { const url = photoUrl(p.photo_path); return <div className="admin-list-row" key={p.id}>{url ? <img className="small-photo" src={url} alt="" /> : <span className="small-photo" /> }<div style={{ flex: 1 }}><strong>{p.name}</strong><p>{p.role || 'دون وصف'}</p></div><button className="admin-button" onClick={() => void toggleHonoree(p)}>{p.is_visible ? 'إخفاء' : 'إظهار'}</button><button className="admin-danger" onClick={() => void deleteHonoree(p)}>حذف</button></div>; }) : <p className="admin-empty">لم تُضف بطاقات بعد.</p>}</div></section>}
        {tab === 'invites' && <section className="admin-panel"><h2>دعوة باسم شخص</h2><p>أنشئي رابطًا خاصًا يُظهر اسم المدعو، ويمكن ربطه ببطاقة تكريم. الرابط يحمل رمزًا عشوائيًا؛ عامليه كدعوة خاصة ولا تنشريه علنًا.</p><form onSubmit={createInvite} className="admin-form-grid"><label className="admin-field">اسم المدعو<input value={inviteName} onChange={(e) => setInviteName(e.target.value)} maxLength={120} required /></label><label className="admin-field">بطاقة التكريم (اختياري)<select value={inviteHonoree} onChange={(e) => setInviteHonoree(e.target.value)}><option value="">بدون ربط</option>{honorees.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label><label className="admin-field full">رسالة شخصية<textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} maxLength={1200} placeholder="رسالة قصيرة تظهر في بداية الدعوة" /></label><button className="button button-blue">إنشاء الرابط</button></form>{inviteLink && <div className="invite-result"><code>{inviteLink}</code><button className="admin-button primary" onClick={() => void copyInvite()}>نسخ الرابط</button></div>}<div className="consent-admin-note">لا تتضمن الروابط أسماء الأشخاص داخل عنوان URL؛ استخدميها مع المدعو نفسه فقط.</div></section>}
        {tab === 'rsvps' && <section className="admin-panel"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><div><h2>ردود الحضور</h2><p>الردود خاصة بالإدارة ولا تظهر للزوار. تُعرض أحدث ٥٠٠ إجابة.</p></div><button className="admin-button primary" onClick={downloadCsv}>تنزيل CSV</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>الاسم</th><th>الرد</th><th>عدد الأفراد</th><th>رقم التواصل</th><th>الرسالة</th><th>وصل في</th></tr></thead><tbody>{rsvps.length ? rsvps.map((r) => <tr key={r.id}><td>{r.guest_name}</td><td>{r.attending ? 'حاضر' : 'معتذر'}</td><td>{r.party_size}</td><td>{r.phone || '—'}</td><td>{r.message || '—'}</td><td>{new Date(r.created_at).toLocaleString('ar-EG')}</td></tr>) : <tr><td colSpan={6} className="admin-empty">لا توجد ردود حتى الآن.</td></tr>}</tbody></table></div></section>}
        {tab === 'metrics' && <section className="admin-panel"><h2>مؤشرات الموقع</h2><p>أرقام مجمعة خلال آخر ٧ أيام من قاعدة البيانات.</p><div className="admin-message">عدد مشاهدات الصفحة والنقرات تقريبي وغير فريد؛ لا نجمع عناوين IP أو بصمات متصفح أو مواقع جغرافية.</div><div className="admin-stats" style={{ marginTop: 13 }}><div className="admin-stat"><small>مشاهدات</small><strong>{stats.views}</strong></div><div className="admin-stat"><small>نقرات RSVP</small><strong>{stats.clicks}</strong></div><div className="admin-stat"><small>ردود حضور</small><strong>{stats.yes}</strong></div><div className="admin-stat"><small>اعتذارات</small><strong>{stats.no}</strong></div></div><p className="metric-note">تعتمد المؤشرات على زيارات الصفحة المحمّلة بعد نشر الدعوة، ولا تشمل قياسًا فريدًا للأشخاص.</p></section>}
        {busy && <p className="loading-note">جاري تحديث البيانات…</p>}
      </div>
    </div>
  </div></main>;
}
