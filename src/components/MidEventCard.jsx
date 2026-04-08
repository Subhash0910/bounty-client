import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const MONO = "'Courier New', Courier, monospace";

/**
 * MidEventCard — the animated parchment card that tears into the screen
 * mid-battle. Has a 6-second SVG countdown ring. Player picks A or B.
 * If timer expires, the bad option auto-triggers.
 *
 * Props:
 *   event  : { icon, title, desc, optionA, optionB, badOption }
 *   onChoose(option: 'A'|'B') — called when player decides
 */
export default function MidEventCard({ event, onChoose }) {
  const cardRef   = useRef(null);
  const ringRef   = useRef(null);
  const timerRef  = useRef(null);
  const [chosen, setChosen] = useState(null);

  const TIMER = 6;
  const CIRCUM = 283; // 2π × 45

  useEffect(() => {
    if (!cardRef.current) return;

    // 1. Sea freezes — notified via EventBus
    import('../engine/EventBus.js').then(({ default: bus }) => {
      bus.emit('freezeSea', true);
    });

    // 2. Card slams in from above
    gsap.fromTo(cardRef.current,
      { y: -window.innerHeight * 0.9, rotation: -6, opacity: 0, scale: 0.85 },
      { y: 0, rotation: 0, opacity: 1, scale: 1, duration: 0.55,
        ease: 'elastic.out(1, 0.65)' }
    );

    // 3. Countdown ring drains over TIMER seconds
    if (ringRef.current) {
      gsap.fromTo(ringRef.current,
        { strokeDashoffset: 0 },
        { strokeDashoffset: CIRCUM, duration: TIMER, ease: 'none',
          onComplete: () => {
            if (!chosen) autoTrigger();
          }
        }
      );
    }

    // 4. Flash border red at 2s remaining
    timerRef.current = setTimeout(() => {
      gsap.to(cardRef.current, {
        boxShadow: '0 0 60px #ff4466, 0 0 120px #ff446644',
        borderColor: '#ff4466',
        duration: 0.3, repeat: -1, yoyo: true,
      });
    }, (TIMER - 2) * 1000);

    return () => {
      clearTimeout(timerRef.current);
      import('../engine/EventBus.js').then(({ default: bus }) => {
        bus.emit('freezeSea', false);
      });
    };
  }, []);

  const autoTrigger = () => {
    // Card explodes/burns off screen
    gsap.to(cardRef.current, {
      y: window.innerHeight * 0.6,
      rotation: 12,
      opacity: 0,
      scale: 0.6,
      duration: 0.4,
      ease: 'power3.in',
      onComplete: () => onChoose(event.badOption || 'B'),
    });
  };

  const choose = (option) => {
    if (chosen) return;
    setChosen(option);
    gsap.killTweensOf(cardRef.current);
    gsap.killTweensOf(ringRef.current);
    // Slam off screen in chosen direction
    gsap.to(cardRef.current, {
      x: option === 'A' ? -window.innerWidth : window.innerWidth,
      rotation: option === 'A' ? -8 : 8,
      opacity: 0,
      duration: 0.35,
      ease: 'power3.in',
      onComplete: () => onChoose(option),
    });
  };

  if (!event) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      {/* Backdrop freeze overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(2px)',
      }} />

      {/* The Card */}
      <div ref={cardRef} style={{
        position: 'relative',
        width: '420px',
        background: 'linear-gradient(160deg, #05090f 0%, #020508 100%)',
        border: '1px solid #ffd70066',
        boxShadow: '0 0 40px #ffd70022, 0 0 80px #00000088, inset 0 0 40px #00000088',
        padding: '32px 28px 24px',
        pointerEvents: 'all',
      }}>
        {/* Burn-edge corners */}
        {['tl','tr','bl','br'].map(c => (
          <div key={c} style={{
            position: 'absolute',
            ...(c.includes('t') ? { top: -1 } : { bottom: -1 }),
            ...(c.includes('l') ? { left: -1 } : { right: -1 }),
            width: 18, height: 18,
            borderTop:    c.includes('t') ? '2px solid #ffd700' : 'none',
            borderBottom: c.includes('b') ? '2px solid #ffd700' : 'none',
            borderLeft:   c.includes('l') ? '2px solid #ffd700' : 'none',
            borderRight:  c.includes('r') ? '2px solid #ffd700' : 'none',
          }} />
        ))}

        {/* Top rule */}
        <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#ffd70066,transparent)', marginBottom: 16 }} />

        {/* Icon + Title */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>{event.icon}</div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: '#ffd700', letterSpacing: 6, fontWeight: 900 }}>
            {event.title}
          </div>
        </div>

        {/* Description */}
        <p style={{
          fontFamily: MONO, fontSize: 11, color: '#8aabb5',
          textAlign: 'center', lineHeight: 1.9, margin: '0 0 20px',
          letterSpacing: 0.5,
        }}>
          {event.desc}
        </p>

        {/* Options */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[{ id: 'A', data: event.optionA, col: '#00f5d4' }, { id: 'B', data: event.optionB, col: '#ff8844' }].map(({ id, data, col }) => (
            <button key={id} onClick={() => choose(id)} style={{
              flex: 1,
              background: `${col}0e`,
              border: `1px solid ${col}55`,
              color: col,
              fontFamily: MONO,
              fontSize: 10,
              padding: '10px 8px',
              cursor: 'pointer',
              letterSpacing: 2,
              lineHeight: 1.7,
              transition: 'all 0.14s',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${col}22`;
              e.currentTarget.style.boxShadow  = `0 0 20px ${col}44`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = `${col}0e`;
              e.currentTarget.style.boxShadow  = 'none';
            }}>
              <div style={{ fontWeight: 900, fontSize: 11, marginBottom: 4 }}>{data?.label}</div>
              <div style={{ color: `${col}aa`, fontSize: 9 }}>{data?.effect}</div>
            </button>
          ))}
        </div>

        {/* SVG Countdown Ring */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="45" fill="none" stroke="#1a3040" strokeWidth="10" />
            <circle
              ref={ringRef}
              cx="50" cy="50" r="45"
              fill="none"
              stroke="#ff4466"
              strokeWidth="10"
              strokeDasharray={CIRCUM}
              strokeDashoffset={0}
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontFamily: MONO, fontSize: 9, color: '#3a5060', letterSpacing: 3 }}>DECIDE NOW</span>
        </div>

        {/* Bottom rule */}
        <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#ffd70033,transparent)', marginTop: 16 }} />
      </div>
    </div>
  );
}
