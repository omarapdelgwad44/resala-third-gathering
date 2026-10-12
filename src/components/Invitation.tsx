import { useEffect, useState, type FormEvent } from 'react';
import { loadGuestInvite, loadPublicSite, photoUrl, recordMetric } from '../lib/data';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { type EventRecord, type GuestInvite, type Honoree, type ProgramItem } from '../lib/types';

const fallbackIntro = 'في رسالة، كل حكاية خير وراها ناس كتير. تعالوا نرجع نتقابل، نفتكر أثرنا، ونحتفي باللي شاركونا الرحلة.';

export function Invitation() {
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [program, setProgram] = useState<ProgramItem[]>([]);
  const [honorees, setHonorees] = useState<Honoree[]>([]);
  const [invite, setInvite] = useState<GuestInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inviteToken = new URLSearchParams(window.location.search).get('invite');

  useEffect(() => {
    let live = true;
    Promise.all([
      loadPublicSite(),
      inviteToken ? loadGuestInvite(inviteToken) : Promise.resolve(null),
    ]).then(([site, guestInvite]) => {
      if (!live) return;
      setEvent(site.event);
      setProgram(site.program);
      setHonorees(site.honorees);
      setInvite(guestInvite);
      setLoading(false);
      if (site.event) void recordMetric(site.event.id, 'page_view');
    }).catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [inviteToken]);

  const title = event?.title ?? 'حكايتنا لسه مكملة';
  const intro = event?.intro ?? fallbackIntro;
  const date = event?.event_at ? new Date(event.event_at) : null;
  const dateText = date
    ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full', timeZone: 'Africa/Cairo' }).format(date)
    : 'الموعد يُعلن قريبًا';
  const timeText = date
    ? new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(date)
    : 'ترقّبوا التفاصيل';

  async function submitRsvp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !event || !event.show_rsvp) return;
    const form = new FormData(e.currentTarget);
    const attending = form.get('attending') === 'yes';
    setSubmitting(true);
    setRsvpStatus('');
    const { error } = await supabase.rpc('submit_rsvp', {
      p_guest_name: String(form.get('name') ?? '').trim(),
      p_attending: attending,
      p_party_size: attending ? Number(form.get('party_size') ?? 1) : 0,
      p_phone: String(form.get('phone') ?? '').trim() || null,
      p_message: String(form.get('message') ?? '').trim(),
      p_invite_token: inviteToken && /^[0-9a-f-]{36}$/i.test(inviteToken) ? inviteToken : null,
      p_honeypot: String(form.get('website') ?? ''),
    });
    setSubmitting(false);
    if (error) setRsvpStatus('حصلت مشكلة بسيطة أثناء إرسال الرد. حاول مرة أخرى بعد قليل.');
    else {
      setRsvpStatus('وصل ردّك، شكرًا لمشاركتنا الحكاية.');
      e.currentTarget.reset();
    }
  }

  const rsvpLink = async () => {
    if (event) await recordMetric(event.id, 'rsvp_click');
    document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="رسالة، إلى بداية الصفحة">
          <img src={`${import.meta.env.BASE_URL}assets/resala-logo.png`} alt="شعار جمعية رسالة" />
          <span className="brand-copy"><strong>جمعية رسالة</strong><small>أرشيف الحكايات · لقاء الثلث الثالث</small></span>
        </a>
        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <a href="#story">الحكاية</a><a href="#details">تفاصيل اللقاء</a><a href="#honorees">أهل الأثر</a>
          <button className="nav-rsvp" onClick={rsvpLink}>تأكيد الحضور <span>↗</span></button>
        </nav>
        <a className="edition-mark" href="#story"><span>رسالة</span><b>03</b><small>لقاء · ٢٠٢٦</small></a>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-wash" aria-hidden="true" />
          <div className="hero-wrap">
            <div className="hero-copy">
              <p className="eyebrow"><i /> دعوة من القلب · جمعية رسالة</p>
              <div className="season-label"><span>العدد الثالث</span><b>{title}</b></div>
              <h1>{invite?.guest_name ? <>أهلًا <em>{invite.guest_name}</em></> : <>حكايتنا<br /><em>لسه مكملة</em></>}</h1>
              <p className="hero-deck">{invite?.personal_message || intro}</p>
              <div className="hero-actions">
                <button className="button button-red" onClick={rsvpLink}>هكون معاكم <span>←</span></button>
            </div>
            <div className="hero-hero-frame" aria-label="صورة الشخصية الرئيسية">
                <a className="button button-outline" href="#story">اقرأ الحكاية</a>
              </div>
              <p className="hero-footnote">{event?.is_published ? 'لقاء يجمع ناس الخير من جديد' : 'معاينة — سيُعلن الموعد والمكان بعد اعتماد الإدارة'}</p>
            </div>
            <div className="hero-collage" aria-label="لوحة تذكارية من حكايات رسالة">
              <div className="collage-tape" />
              <article className="memory-frame frame-large"><div className="memory-art art-sunrise"><span className="art-scribble">الخير بيجمعنا</span><i /></div><b className="frame-caption">ناس · أثر · حكايات</b></article>
              <article className="memory-frame frame-small"><div className="memory-art art-hands"><span>مع بعض</span><i /><b>×</b></div><b className="frame-caption">كل حكاية تبدأ بحد</b></article>
              <article className="memory-frame frame-bottom"><div className="memory-art art-paper"><strong>أثر<br />يفضل</strong><span>رسالة</span></div><b className="frame-caption">والأثر مكمل بينا</b></article>
              <div className="collage-stamp"><b>03</b><small>لقاء الحكايات</small></div>
              <span className="collage-note">لمة ناسنا<br />قربت!</span>
            </div>
          </div>
          <div className="hero-index"><span>01</span><i /> <span>حكاية الخير</span></div>
        </section>

        <div className="ticker" aria-label="رسالة ترحّب بكم"><div>الخير بيجمعنا <b>✳</b> حكاياتنا مكملة <b>✳</b> أهل رسالة أهلنا <b>✳</b> أثرنا بيكبر بينا <b>✳</b> الخير بيجمعنا <b>✳</b></div></div>

        <section id="story" className="story-section section-shell">
          <div className="section-kicker">من الأرشيف · كلمة لناسنا</div>
          <div className="story-layout">
            <div className="story-number" aria-hidden="true">03<span>حكاية</span></div>
            <div className="story-copy"><h2>في ناس بتمشي…<br /><em>بس أثرها بيفضل.</em></h2><p>{intro}</p><p className="story-end">والنهارده، بنفتح ألبوم الحكايات من جديد — دعوة لكل اللي عاشوا الرحلة، ولكل حد بيكمّل طريق الخير.</p><div className="signature"><span /> من القلب، فريق رسالة</div></div>
          </div>
        </section>

        <section id="details" className="details-section">
          <div className="section-shell">
            <div className="section-head light"><div className="section-kicker">نستناكم</div><h2>ميعادنا قريب</h2><p>هنجمع كل التفاصيل هنا أول ما تتأكد — خلوكم قريبين.</p></div>
            <div className="details-row">
              <article className="detail-block"><span className="detail-label">اليوم والتاريخ</span><strong>{dateText}</strong><small>التوقيت المحلي · القاهرة</small></article>
              <article className="detail-block"><span className="detail-label">الساعة</span><strong>{timeText}</strong><small>مدة اللقاء تُعلن قريبًا</small></article>
              <article className="detail-block"><span className="detail-label">المكان</span><strong>{event?.venue || 'المكان يُعلن قريبًا'}</strong>{event?.map_url ? <a className="map-link" target="_blank" rel="noreferrer" href={event.map_url}>افتح الخريطة ←</a> : <small>تفاصيل الوصول قريبًا</small>}</article>
            </div>
            <div className="details-note"><span>✳</span> {event?.is_published ? 'مبسوطين إنكم هتكونوا معانا.' : 'التفاصيل لسه تحت الإعداد — الإدارة هتحدّث الصفحة قبل إرسال الدعوات.'}</div>
          </div>
        </section>

        <section className="program-section section-shell" hidden={event ? !event.show_program : false}>
          <div className="section-head"><div className="section-kicker">على مدار الليلة</div><h2>حكايات في انتظارنا</h2><p>برنامج بسيط، ولمة كبيرة، وناس وحشتنا.</p></div>
          <div className="program-list">
            {(program.length ? program : [
              { id: 'p1', title: 'استقبال وترحيب', starts_at: null, sort_order: 1 },
              { id: 'p2', title: 'كلمة شكر وتقدير', starts_at: null, sort_order: 2 },
              { id: 'p3', title: 'تكريم أهل الأثر', starts_at: null, sort_order: 3 },
            ]).map((item, index) => (
              <article className="program-item" key={item.id}><span className="program-no">0{index + 1}</span><strong>{item.title}</strong><time>{item.starts_at ? String(item.starts_at).slice(0, 5) : 'معًا في نفس الحكاية'}</time><i>✳</i></article>
            ))}
          </div>
        </section>

        <section id="honorees" className="honorees-section">
          <div className="section-shell">
            <div className="section-head light"><div className="section-kicker">من ناسنا · لأهلنا</div><h2>في حكايات ما بتتنسيش</h2><p>هنحتفي بناس شاركونا الرحلة وسابوا أثر حلو — بصورهم وحكاياتهم، بعد موافقتهم.</p></div>
            {honorees.length ? <div className="honoree-grid">{honorees.map((person, index) => {
              const url = photoUrl(person.photo_path);
              return <article className="honoree-card" key={person.id}><div className="honoree-photo">{url ? <img src={url} alt={`صورة ${person.name}`} loading="lazy" /> : <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>}<i>أثر</i></div><div className="honoree-card-copy"><small>من حكايات رسالة</small><h3>{person.name}</h3>{person.role && <p className="honoree-role">{person.role}</p>}<p>{person.message || 'شكرًا لأنكم كنتم جزءًا من الحكاية.'}</p></div></article>;
            })}</div> : <div className="honoree-empty"><div className="empty-seal">✳</div><p>صور أهل الأثر هتظهر هنا بعد ما الإدارة تضيفها<br />وتتأكد من موافقة أصحابها على النشر.</p></div>}
            <div className="photo-consent-note">كل الصور الشخصية تُرفع بموافقة أصحابها، ويمكن للإدارة إخفاؤها أو حذفها في أي وقت.</div>
          </div>
        </section>

        <section id="rsvp" className="rsvp-section" hidden={event ? !event.show_rsvp : false}>
          <div className="section-shell rsvp-layout">
            <div className="rsvp-intro"><div className="section-kicker">مستنيين ردّك</div><h2>هتكون<br /><em>معانا؟</em></h2><p>وجودك فارق في الحكاية. ابعتلنا رد سريع عشان نجهزلكم أحلى لمة.</p><span className="rsvp-doodle">منوّرين<br />بوجودكم!</span></div>
            {event?.is_published ? <form className="rsvp-form" onSubmit={submitRsvp}>
              {invite?.honoree_name && <div className="personal-banner"><strong>دعوة تكريم خاصة</strong><span>هنحتفي بـ{invite.honoree_name}</span></div>}
              <div className="form-row"><label>اسمك الكريم<input name="name" required minLength={2} maxLength={120} defaultValue={invite?.guest_name ?? ''} autoComplete="name" /></label><label>رقم للتواصل <small>(اختياري)</small><input name="phone" type="tel" maxLength={32} autoComplete="tel" placeholder="01…" /></label></div>
              <fieldset><legend>هتقدر تيجي؟</legend><label className="choice"><input type="radio" name="attending" value="yes" defaultChecked required /><span>إن شاء الله هكون موجود</span></label><label className="choice"><input type="radio" name="attending" value="no" /><span>مش هقدر المرة دي</span></label></fieldset>
              <label className="full-field">عدد الحضور <select name="party_size" defaultValue="1"><option value="1">فرد واحد</option><option value="2">فردان</option><option value="3">٣ أفراد</option><option value="4">٤ أفراد</option><option value="5">٥ أفراد</option><option value="6">٦ أفراد</option><option value="7">٧ أفراد</option><option value="8">٨ أفراد</option></select></label>
              <label className="full-field">كلمة حلوة للفريق <textarea name="message" maxLength={1200} placeholder="لو حابب تسيب لنا كلمة…" /></label>
              <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              <button className="button button-red form-submit" disabled={submitting}>{submitting ? 'جاري الإرسال…' : 'أرسل ردّك ←'}</button>
              <p className="privacy-copy">بيانات الرد بتظهر للإدارة فقط، ومش هنجمع بيانات تصفح أو موقع جغرافي.</p>
              {rsvpStatus && <p className="form-status" role="status">{rsvpStatus}</p>}
            </form> : <div className="rsvp-closed"><span className="lock-icon">✳</span><h3>{loading ? 'بنجهّز اللمة…' : 'هنفتح تأكيد الحضور قريبًا'}</h3><p>{hasSupabaseConfig ? 'الإدارة هتضيف الموعد والمكان الأول، وبعدها هتقدر تأكد حضورك من هنا.' : 'خدمة تأكيد الحضور هتتصل بعد إعداد قاعدة البيانات.'}</p></div>}
          </div>
        </section>

        <footer className="site-footer">
          <a className="footer-brand" href="#top"><img src={`${import.meta.env.BASE_URL}assets/resala-logo.png`} alt="" /><b>رسالة — حكايات الخير مستمرة</b></a>
          <p>كل حكاية خير وراها ناس… وكلنا مكملين الحكاية.</p>
          <small>جمعية رسالة · لقاء الثلث الثالث · ٢٠٢٦</small>
          <a className="admin-link" href={`${window.location.pathname}?admin=1`}>دخول الإدارة</a>
        </footer>
      </main>
    </>
  );
}
