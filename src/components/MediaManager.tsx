import { useEffect, useState, type FormEvent } from 'react';
import { photoUrl } from '../lib/data';
import { supabase } from '../lib/supabase';
import type { EventMedia, EventMediaPlacement } from '../lib/types';

const placements: Record<EventMediaPlacement, string> = {
  gallery: 'معرض الصور',
  hero_small: 'الهيرو · البرواز الجانبي',
  hero_bottom: 'الهيرو · البرواز السفلي',
};

export function MediaManager({
  eventId,
  items,
  onReload,
  onNotice,
}: {
  eventId: string;
  items: EventMedia[];
  onReload: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [placement, setPlacement] = useState<EventMediaPlacement>('gallery');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState(items);

  useEffect(() => setDrafts(items), [items]);

  function updateDraft(id: string, patch: Partial<EventMedia>) {
    setDrafts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function uploadImage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !file) return;
    if (file.size > 4 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onNotice('اختاري صورة JPG أو PNG أو WebP بحجم لا يتجاوز ٤ ميجابايت.');
      return;
    }

    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const storagePath = `${crypto.randomUUID()}.${extension}`;
    setBusy(true);
    const { error: uploadError } = await supabase.storage.from('event-media').upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setBusy(false);
      onNotice('تعذّر رفع الصورة.');
      return;
    }

    const existing = placement === 'gallery' ? null : items.find((item) => item.placement === placement) ?? null;
    const sortOrder = placement === 'gallery'
      ? Math.max(0, ...items.filter((item) => item.placement === 'gallery').map((item) => item.sort_order)) + 1
      : 0;
    const values = {
      storage_path: storagePath,
      placement,
      alt_text: altText.trim(),
      caption: caption.trim(),
      sort_order: sortOrder,
      is_visible: true,
    };

    if (existing) {
      const { error } = await supabase.from('event_media').update(values).eq('id', existing.id);
      if (error) {
        await supabase.storage.from('event-media').remove([storagePath]);
        setBusy(false);
        onNotice('تعذّر استبدال صورة الهيرو.');
        return;
      }
      await supabase.storage.from('event-media').remove([existing.storage_path]);
    } else {
      const { error } = await supabase.from('event_media').insert({ event_id: eventId, ...values });
      if (error) {
        await supabase.storage.from('event-media').remove([storagePath]);
        setBusy(false);
        onNotice('تعذّر إضافة الصورة.');
        return;
      }
    }

    setFile(null);
    setAltText('');
    setCaption('');
    setPlacement('gallery');
    setBusy(false);
    onNotice(existing ? 'تم استبدال صورة الهيرو.' : 'أُضيفت الصورة.');
    await onReload();
  }

  async function saveImage(item: EventMedia) {
    if (!supabase || !item.alt_text.trim()) {
      onNotice('اكتبي وصفاً مناسباً للصورة.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('event_media').update({
      placement: item.placement,
      alt_text: item.alt_text.trim(),
      caption: item.caption.trim(),
      sort_order: item.sort_order,
      is_visible: item.is_visible,
    }).eq('id', item.id);
    setBusy(false);
    onNotice(error ? 'تعذّر حفظ التعديل. قد يكون موضع الهيرو مستخدماً بالفعل.' : 'تم حفظ تعديل الصورة.');
    if (!error) await onReload();
  }

  async function deleteImage(item: EventMedia) {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from('event_media').delete().eq('id', item.id);
    if (error) {
      setBusy(false);
      onNotice('تعذّر حذف الصورة.');
      return;
    }
    await supabase.storage.from('event-media').remove([item.storage_path]);
    setBusy(false);
    onNotice('حُذفت الصورة من الموقع.');
    await onReload();
  }

  return (
    <section className="admin-panel">
      <h2>معرض الصور والهيرو</h2>
      <p>الصورة الرئيسية للهيرو من قسم بيانات اللقاء. ارفعي هنا صور المعرض أو غيّري صور البراويز الجانبية والسفلية.</p>
      <form className="admin-media-upload" onSubmit={uploadImage}>
        <label className="admin-field">الصورة · JPG / PNG / WebP · حتى ٤ ميجابايت
          <input key={file ? 'selected' : 'empty'} type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="admin-field">موضع الصورة
          <select value={placement} onChange={(e) => setPlacement(e.target.value as EventMediaPlacement)}>
            {Object.entries(placements).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="admin-field">وصف الصورة
          <input value={altText} onChange={(e) => setAltText(e.target.value)} maxLength={240} required />
        </label>
        <label className="admin-field">تعليق أسفل الصورة
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} placeholder="اختياري" />
        </label>
        <button className="button button-blue" disabled={busy}>{busy ? 'جاري الرفع…' : 'رفع الصورة'}</button>
      </form>

      <h2 className="admin-media-subhead">الصور الحالية</h2>
      {items.length ? <div className="admin-media-grid">
        {drafts.map((item) => {
          const url = photoUrl(item.storage_path, 'event-media');
          return <article className="admin-media-item" key={item.id}>
            <img className="admin-media-preview" src={url ?? ''} alt={item.alt_text} />
            <div className="admin-media-fields">
              <label className="admin-field">وصف الصورة
                <input value={item.alt_text} onChange={(e) => updateDraft(item.id, { alt_text: e.target.value })} maxLength={240} />
              </label>
              <label className="admin-field">التعليق
                <input value={item.caption} onChange={(e) => updateDraft(item.id, { caption: e.target.value })} maxLength={500} />
              </label>
              <label className="admin-field">موضع الصورة
                <select value={item.placement} onChange={(e) => updateDraft(item.id, { placement: e.target.value as EventMediaPlacement })}>
                  {Object.entries(placements).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="admin-field">ترتيب المعرض
                <input type="number" value={item.sort_order} onChange={(e) => updateDraft(item.id, { sort_order: Number(e.target.value) })} />
              </label>
              <label className="admin-media-visible">
                <input type="checkbox" checked={item.is_visible} onChange={(e) => updateDraft(item.id, { is_visible: e.target.checked })} /> ظاهرة للزوار
              </label>
              <div className="admin-media-actions">
                <button className="admin-button primary" disabled={busy} onClick={() => void saveImage(item)}>حفظ</button>
                <button className="admin-danger" disabled={busy} onClick={() => void deleteImage(item)}>حذف</button>
              </div>
            </div>
          </article>;
        })}
      </div> : <p className="admin-empty">لم تُرفع صور للمعرض أو البراويز الجانبية بعد.</p>}
    </section>
  );
}