import { useEffect, useMemo, useState } from 'react';
import { formatEventDate, formatEventTime, loadInvite, photoUrl } from '../lib/data';
import { DEFAULT_INVITE, type EventRecord } from '../lib/types';

type Piece = { left: number; delay: number; duration: number; size: number; color: string; round: boolean };

function Confetti() {
  const pieces = useMemo<Piece[]>(() => {
    const colors = ['#4a9fd4', '#8fc9ec', '#c9a44c', '#e3c778', '#ffffff', '#2f80b6'];
    return Array.from({ length: 22 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 9,
      duration: 9 + Math.random() * 9,
      size: 5 + Math.random() * 8,
      color: colors[i % colors.length],
      round: Math.random() > 0.6,
    }));
  }, []);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.7,
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
          }}
        />
      ))}
    </div>
  );
}

export function Invitation() {
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    loadInvite()
      .then((data) => { if (live) setEvent(data); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const slogan = event?.slogan?.trim() || DEFAULT_INVITE.slogan;
  const title = event?.title?.trim() || DEFAULT_INVITE.title;
  const word = event?.honorary_word?.trim() || DEFAULT_INVITE.honorary_word;
  const orgName = event?.org_name?.trim() || DEFAULT_INVITE.org_name;
  const imageUrl = photoUrl(event?.hero_image_path ?? null);
  const dateText = formatEventDate(event?.event_at ?? null);
  const timeText = formatEventTime(event?.event_at ?? null);
  const venue = event?.venue?.trim() || '';

  return (
    <div className="invite-stage">
      <Confetti />
      <div className="stage-orb stage-orb-a" aria-hidden="true" />
      <div className="stage-orb stage-orb-b" aria-hidden="true" />

      <main className={`invite-card${loading ? ' is-loading' : ''}`}>
        <div className="card-frame">
          <span className="frame-corner tl" aria-hidden="true" />
          <span className="frame-corner tr" aria-hidden="true" />
          <span className="frame-corner bl" aria-hidden="true" />
          <span className="frame-corner br" aria-hidden="true" />

          <header className="card-org">
            <img className="org-logo" src={`${import.meta.env.BASE_URL}assets/resala-logo.png`} alt="شعار جمعية رسالة" />
            <span className="org-name">{orgName}</span>
          </header>

          <figure className="card-photo">
            {imageUrl
              ? <img src={imageUrl} alt={title} />
              : <span className="photo-empty">مكان الصورة</span>}
          </figure>

          <p className="card-eyebrow">{title}</p>
          <h1 className="card-slogan">{slogan}</h1>

          <div className="card-divider"><i>✧</i></div>

          <p className="card-word">{word}</p>

          {(dateText || venue) && (
            <div className="card-details">
              {dateText && (
                <span className="detail"><b>الموعد</b>{dateText}{timeText ? ` — ${timeText}` : ''}</span>
              )}
              {venue && <span className="detail"><b>المكان</b>{venue}</span>}
            </div>
          )}

          <footer className="card-seal">
            <span className="seal">رسالة</span>
            <small>حكايات الخير مستمرة</small>
          </footer>
        </div>
      </main>
    </div>
  );
}
