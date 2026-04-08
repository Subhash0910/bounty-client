import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

const MONO = "'Courier New', Courier, monospace";

/**
 * WeaponCard — animated action card replacing the old ActionBtn.
 * GSAP powers: slide-in stagger, counter pulse, click slam, hover lift.
 */
export default function WeaponCard({
  icon, label, sub, color, disabled, onClick, hotkey,
  cooldownLeft, isCounter, index = 0, visible = true,
}) {
  const ref = useRef(null);
  const pulseRef = useRef(null);

  // Slide in when visible
  useEffect(() => {
    if (!ref.current || !visible) return;
    gsap.fromTo(ref.current,
      { y: 80, opacity: 0, scale: 0.88 },
      { y: 0, opacity: 1, scale: 1,
        duration: 0.38,
        delay: index * 0.06,
        ease: 'back.out(1.8)' }
    );
  }, [visible]);

  // Counter pulse — breathes with gold glow
  useEffect(() => {
    if (!ref.current) return;
    if (isCounter && !disabled && cooldownLeft === 0) {
      pulseRef.current = gsap.to(ref.current, {
        scale: 1.07,
        boxShadow: `0 0 55px ${color}, 0 0 100px ${color}44`,
        duration: 0.85,
        repeat: -1, yoyo: true,
        ease: 'sine.inOut',
      });
    } else {
      pulseRef.current?.kill();
      gsap.to(ref.current, { scale: 1, boxShadow: `0 0 8px ${color}22`, duration: 0.3 });
    }
    return () => pulseRef.current?.kill();
  }, [isCounter, disabled, cooldownLeft]);

  const handleClick = () => {
    if (disabled || cooldownLeft > 0) return;
    // Physical slam down
    gsap.timeline()
      .to(ref.current, { scale: 0.9, duration: 0.07, ease: 'power2.in' })
      .to(ref.current, { scale: 1.0, duration: 0.18, ease: 'back.out(2)' });
    onClick?.();
  };

  const onCd = cooldownLeft > 0;
  const btnColor = isCounter ? '#ffd700' : color;

  return (
    <button
      ref={ref}
      disabled={disabled || onCd}
      onClick={handleClick}
      title={`[${hotkey}] ${label}`}
      onMouseEnter={() => {
        if (disabled || onCd) return;
        gsap.to(ref.current, { y: -8, scale: 1.04, boxShadow: `0 12px 40px ${btnColor}66`, duration: 0.18 });
      }}
      onMouseLeave={() => {
        if (isCounter && !disabled && !onCd) return;
        gsap.to(ref.current, { y: 0, scale: 1, boxShadow: `0 0 8px ${btnColor}22`, duration: 0.22 });
      }}
      style={{
        width: 148, height: 110,
        position: 'relative',
        background: onCd
          ? 'rgba(0,0,0,0.55)'
          : disabled ? 'rgba(2,6,14,0.5)' : `rgba(4,10,24,0.92)`,
        border: `1px solid ${onCd ? '#1a2a3a' : disabled ? '#ffffff0d' : btnColor + '55'}`,
        color: onCd ? '#2a3a4a' : disabled ? 'rgba(255,255,255,0.1)' : btnColor,
        fontFamily: MONO,
        cursor: (disabled || onCd) ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 3, padding: 0,
        opacity: (disabled && !onCd) ? 0.2 : onCd ? 0.4 : 1,
        userSelect: 'none',
        outline: 'none',
        boxShadow: `0 0 8px ${btnColor}22`,
        // no transition — GSAP handles all animation
      }}
    >
      {/* Top glow line */}
      <div style={{
        position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
        background: disabled || onCd ? 'transparent' : `linear-gradient(90deg,transparent,${btnColor}cc,transparent)`,
      }} />

      {/* Hotkey */}
      <div style={{ position: 'absolute', top: 5, right: 7, color: `${btnColor}66`, fontSize: 8, letterSpacing: 1 }}>
        [{hotkey}]
      </div>

      {/* Cooldown badge */}
      {onCd && (
        <div style={{ position: 'absolute', top: 5, left: 7, fontSize: 8, color: '#ff880099', letterSpacing: 2, background: 'rgba(255,136,0,0.1)', padding: '1px 5px' }}>
          CD {cooldownLeft}
        </div>
      )}

      {/* Counter label */}
      {isCounter && !disabled && !onCd && (
        <div style={{ position: 'absolute', top: 5, left: 7, fontSize: 7, color: '#ffd70099', letterSpacing: 2, background: '#ffd70018', padding: '1px 5px' }}>
          ⚡ COUNTER
        </div>
      )}

      <span style={{
        fontSize: 24, lineHeight: 1,
        filter: (disabled || onCd) ? 'grayscale(1) opacity(0.3)' : isCounter ? 'drop-shadow(0 0 10px #ffd700)' : `drop-shadow(0 0 6px ${btnColor})`,
      }}>
        {icon}
      </span>

      <span style={{ fontWeight: 900, fontSize: 11, letterSpacing: 4, marginTop: 2 }}>
        {label}
      </span>

      <span style={{
        fontSize: 8, letterSpacing: 0.5,
        color: onCd ? '#1a2a3a' : disabled ? 'rgba(255,255,255,0.06)' : '#5a7a8a',
        textAlign: 'center', padding: '0 8px', lineHeight: 1.5,
      }}>
        {sub}
      </span>
    </button>
  );
}
