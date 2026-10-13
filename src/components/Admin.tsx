import { useEffect, useState, type FormEvent } from 'react';
import { loadInvite, photoUrl, saveInvite, toLocalInput, uploadInviteImage } from '../lib/data';
import { hasSupabaseConfig } from '../lib/supabase';
import { DEFAULT_INVITE, type EventRecord, type InviteForm } from '../lib/types';

export function Admin({ onExit }: { onExit: () => void }) {
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [form, setForm] = useState<InviteForm>(DEFAULT_INVITE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    loadInvite()
      .then((data) => {
        if (!live) return;
        setEvent(data);
        setForm({
          org_name: data?.org_name ?? DEFAULT_INVITE.org_name,
          title: data?.title ?? DEFAULT_INVITE.title,
          slogan: data?.slogan ?? DEFAULT_INVITE.slogan,
          honorary_word: data?.honorary_word ?? DEFAULT_INVITE.honorary_word,
          venue: data?.venue ?? '',
          map_url: data?.map_url ?? '',
          event_at: toLocalInput(data?.event_at ?? null),
        });
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  function update<K extends keyof InviteForm>(key: K, value: InviteForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function pickImage(file: File | null) {
    setImageFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice('');
    setBusy(true);

    let heroPath = event?.hero_image_path ?? null;
    if (imageFile) {
      const uploaded = await uploadInviteImage(imageFile);
      if (uploaded.error || !uploaded.path) {
        setBusy(false);
        setNotice(`تعذّر رفع الصورة: ${uploaded.error ?? ''}`);
        return;
      }
      heroPath = uploaded.path;
    }

    const error = await saveInvite({
      title: form.title.trim() || DEFAULT_INVITE.title,
      slogan: form.slogan.trim() || DEFAULT_INVITE.slogan,
      honorary_word: form.honorary_word.trim() || DEFAULT_INVITE.honorary_word,
      org_name: form.org_name.trim() || DEFAULT_INVITE.org_name,
      venue: form.venue.trim() || null,
      map_url: form.map_url.trim() || null,
      event_at: form.event_at ? new Date(form.event_at).toISOString() : null,
      hero_image_path: heroPath,
    });

    setBusy(false);
    if (error) {
      setNotice(`تعذّر الحفظ: ${error}`);
      return;
    }
    setImageFile(null);
    if (preview) { URL.revokeObjectURL(preview); setPreview(null); }
    setNotice('تم حفظ التعديلات، والدعوة محدّثة للزوار.');
    const fresh = await loadInvite();
    setEvent(fresh);
  }

  const currentImage = preview ?? photoUrl(event?.hero_image_path ?? null);
  const ready = hasSupabaseConfig;

  return (
    <div className="admin-stage">
      <header className="admin-topbar">
        <div className="admin-brand">
          <img src={`${import.meta.env.BASE_URL}assets/resala-logo.png`} alt="شعار جمعية رسالة" />
          <div>
            <h1>إدارة الدعوة</h1>
            <p>جمعية رسالة — قوافل طبية</p>
          </div>
        </div>
        <a className="admin-ghost" href={window.location.pathname}>معاينة الدعوة ↗</a>
      </header>

      <form className="admin-card" onSubmit={submit}>
        <div className="admin-preview">
          <span className="admin-preview-label">الصورة الحالية</span>
          <div className="admin-preview-box">
            {currentImage
              ? <img src={currentImage} alt="" />
              : <span className="admin-preview-empty">لا توجد صورة بعد</span>}
          </div>
          <label className="admin-file">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
            <span>{imageFile ? imageFile.name : 'اختيار صورة (JPG / PNG / WebP · حتى ٥ ميجابايت)'}</span>
          </label>
        </div>

        <div className="admin-fields">
          <label className="admin-field">
            اسم الجهة
            <input value={form.org_name} onChange={(e) => update('org_name', e.target.value)} maxLength={160} placeholder="جمعية رسالة — قوافل طبية" />
          </label>
          <label className="admin-field">
            عنوان الدعوة
            <input value={form.title} onChange={(e) => update('title', e.target.value)} maxLength={180} placeholder="قافلة طبية" />
          </label>
          <label className="admin-field">
            السلوجن
            <input value={form.slogan} onChange={(e) => update('slogan', e.target.value)} maxLength={200} placeholder="الخير بيجمعنا" />
          </label>
          <label className="admin-field">
            الكلمة الشرفية
            <textarea value={form.honorary_word} onChange={(e) => update('honorary_word', e.target.value)} rows={4} maxLength={1200} placeholder="كلمة التهنئة أو الكلمة الشرفية التي تظهر في الدعوة" />
          </label>
          <div className="admin-row">
            <label className="admin-field">
              الموعد
              <input type="datetime-local" value={form.event_at} onChange={(e) => update('event_at', e.target.value)} />
            </label>
            <label className="admin-field">
              المكان
              <input value={form.venue} onChange={(e) => update('venue', e.target.value)} maxLength={240} placeholder="اسم القاعة أو العنوان" />
            </label>
          </div>
          <label className="admin-field">
            رابط الموقع على خرائط جوجل
            <input type="url" dir="ltr" value={form.map_url} onChange={(e) => update('map_url', e.target.value)} maxLength={1000} placeholder="https://maps.app.goo.gl/…" />
          </label>
        </div>

        <div className="admin-actions-bar">
          <button className="admin-save" type="submit" disabled={busy || !ready}>
            {busy ? 'جاري الحفظ…' : 'حفظ التعديلات'}
          </button>
          <button className="admin-ghost" type="button" onClick={onExit}>عرض الدعوة</button>
          {notice && <span className="admin-notice" role="status">{notice}</span>}
        </div>

        {!ready && <p className="admin-warn">إعدادات الاتصال بقاعدة البيانات غير مكتملة، فلا يمكن الحفظ الآن.</p>}
        {loading && <p className="admin-warn">جاري تحميل بيانات الدعوة…</p>}
      </form>
    </div>
  );
}
