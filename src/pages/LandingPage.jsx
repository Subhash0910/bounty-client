import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MONO = "'Courier New', Courier, monospace";

function AnimatedCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Stars
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.62,
      r: Math.random() < 0.12 ? 1.8 : 0.7,
      base: 0.2 + Math.random() * 0.8,
      speed: 0.004 + Math.random() * 0.009,
      phase: Math.random() * Math.PI * 2,
    }));

    // Ocean drifters
    const drifters = Array.from({ length: 55 }, () => ({
      x: Math.random(),
      y: 0.6 + Math.random() * 0.4,
      vx: -(0.00012 + Math.random() * 0.00025),
      r: 1 + Math.random() * 2.2,
      base: 0.04 + Math.random() * 0.12,
      phase: Math.random() * Math.PI * 2,
      speed: 0.006 + Math.random() * 0.01,
    }));

    let waveOffset = 0;
    let raf;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // ── Sky ──────────────────────────────────────────────────────────────
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.65);
      sky.addColorStop(0,   '#010408');
      sky.addColorStop(0.5, '#020912');
      sky.addColorStop(1,   '#03111e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.65);

      // ── Ocean ─────────────────────────────────────────────────────────────
      const sea = ctx.createLinearGradient(0, H * 0.60, 0, H);
      sea.addColorStop(0, '#020f1a');
      sea.addColorStop(1, '#010408');
      ctx.fillStyle = sea;
      ctx.fillRect(0, H * 0.60, W, H * 0.40);

      // ── Moon ─────────────────────────────────────────────────────────────
      const mx = W * 0.83, my = H * 0.12;
      // halo
      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 100);
      halo.addColorStop(0,   'rgba(220,220,190,0.07)');
      halo.addColorStop(0.4, 'rgba(220,220,190,0.03)');
      halo.addColorStop(1,   'transparent');
      ctx.fillStyle = halo;
      ctx.fillRect(mx - 100, my - 100, 200, 200);
      // body
      ctx.beginPath();
      ctx.arc(mx, my, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(238,238,215,0.88)';
      ctx.fill();
      // crescent cutout
      ctx.beginPath();
      ctx.arc(mx + 10, my - 5, 17, 0, Math.PI * 2);
      ctx.fillStyle = '#010810';
      ctx.fill();

      // ── Stars ────────────────────────────────────────────────────────────
      stars.forEach(s => {
        s.phase += s.speed;
        const a = s.base * (0.45 + 0.55 * Math.sin(s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      });

      // ── Horizon glow ─────────────────────────────────────────────────────
      const hg = ctx.createLinearGradient(0, H * 0.54, 0, H * 0.70);
      hg.addColorStop(0,   'transparent');
      hg.addColorStop(0.5, 'rgba(0,245,212,0.040)');
      hg.addColorStop(1,   'transparent');
      ctx.fillStyle = hg;
      ctx.fillRect(0, H * 0.54, W, H * 0.16);

      // ── Grid on ocean ────────────────────────────────────────────────────
      ctx.lineWidth = 1;
      const gridStep = Math.round(W / 18);
      for (let x = 0; x < W; x += gridStep) {
        ctx.beginPath(); ctx.moveTo(x, H * 0.60); ctx.lineTo(x, H);
        ctx.strokeStyle = 'rgba(0,245,212,0.022)'; ctx.stroke();
      }
      const rowStep = Math.round(H * 0.40 / 9);
      for (let r = 0; r < 9; r++) {
        const ry = H * 0.60 + r * rowStep;
        ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(W, ry);
        ctx.strokeStyle = 'rgba(0,245,212,0.018)'; ctx.stroke();
      }

      // ── Animated waves ───────────────────────────────────────────────────
      waveOffset += 0.55;
      for (let i = 0; i < 8; i++) {
        const wy = H * 0.635 + i * (H * 0.035);
        ctx.beginPath();
        ctx.moveTo(0, wy);
        for (let x = 0; x <= W; x += 7)
          ctx.lineTo(x, wy + Math.sin((x + waveOffset + i * 35) * 0.022) * (3.5 + i * 1.8));
        ctx.strokeStyle = `rgba(0,245,212,${0.022 + i * 0.013})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ── Ocean drifter particles ───────────────────────────────────────────
      drifters.forEach(p => {
        p.x += p.vx;
        p.phase += p.speed;
        if (p.x < -0.02) p.x = 1.02;
        const a = p.base * (0.4 + 0.6 * Math.abs(Math.sin(p.phase)));
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,245,212,${a})`;
        ctx.fill();
      });

      // ── Vignette ─────────────────────────────────────────────────────────
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, W * 0.85);
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, 'rgba(1,4,8,0.75)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [visible,   setVisible]   = useState(false);
  const [hovEnter,  setHovEnter]  = useState(false);
  const [hovLogin,  setHovLogin]  = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: MONO, background: '#010408' }}>

      <AnimatedCanvas />

      {/* Scan-line overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.025) 3px,rgba(0,0,0,0.025) 4px)',
      }} />

      {/* Main content */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transition: 'opacity 1.3s ease, transform 1.3s ease',
      }}>

        {/* Season badge */}
        <div style={{
          fontSize: '10px', letterSpacing: '8px', color: '#132230',
          marginBottom: '2.2rem', padding: '5px 22px',
          border: '1px solid rgba(0,245,212,0.07)',
          background: 'rgba(0,245,212,0.015)',
        }}>SEASON 1 &nbsp;·&nbsp; THE FIRST TIDE</div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(4.5rem, 13vw, 9.5rem)',
          fontWeight: 900, letterSpacing: '0.38em',
          color: '#00f5d4', margin: 0, lineHeight: 1,
          textShadow: '0 0 55px #00f5d4aa, 0 0 110px #00f5d444, 0 0 180px #00f5d420',
        }}>BOUNTY</h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '0.95rem', color: '#1e3a4a', letterSpacing: '0.35em',
          margin: '1.8rem 0 0', textAlign: 'center', lineHeight: 2.2,
        }}>
          SAIL &nbsp;·&nbsp; FIGHT &nbsp;·&nbsp; EARN YOUR BOUNTY
          <br />
          <span style={{ color: '#0f2535', fontSize: '0.78rem', letterSpacing: '0.18em' }}>
            THE OCEAN REMEMBERS
          </span>
        </p>

        {/* Decorative divider */}
        <div style={{
          width: '220px', height: '1px', margin: '2.6rem 0',
          background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.30), transparent)',
        }} />

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '1.2rem' }}>
          {/* Primary */}
          <button
            onMouseEnter={() => setHovEnter(true)}
            onMouseLeave={() => setHovEnter(false)}
            onClick={() => navigate('/register')}
            style={{
              padding: '0.95rem 3rem',
              background: hovEnter
                ? 'linear-gradient(135deg, #00f5d4, #00c8b0)'
                : 'linear-gradient(135deg, rgba(0,245,212,0.90), rgba(0,200,176,0.85))',
              color: '#010810', border: 'none', fontFamily: MONO,
              fontWeight: 900, fontSize: '0.9rem', letterSpacing: '0.22em',
              cursor: 'pointer',
              boxShadow: hovEnter
                ? '0 0 70px rgba(0,245,212,0.55), 0 8px 30px rgba(0,245,212,0.25)'
                : '0 0 30px rgba(0,245,212,0.30), 0 4px 14px rgba(0,245,212,0.12)',
              transform: hovEnter ? 'translateY(-3px) scale(1.02)' : 'translateY(0) scale(1)',
              transition: 'all 0.2s ease',
            }}
          >⚓ ENTER THE OCEAN</button>

          {/* Secondary */}
          <button
            onMouseEnter={() => setHovLogin(true)}
            onMouseLeave={() => setHovLogin(false)}
            onClick={() => navigate('/login')}
            style={{
              padding: '0.95rem 3rem',
              background: hovLogin ? 'rgba(0,245,212,0.06)' : 'transparent',
              color: hovLogin ? '#00f5d4' : '#1c3a4a',
              border: `1px solid ${hovLogin ? 'rgba(0,245,212,0.5)' : 'rgba(0,245,212,0.10)'}`,
              fontFamily: MONO, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.22em',
              cursor: 'pointer',
              boxShadow: hovLogin ? '0 0 30px rgba(0,245,212,0.15)' : 'none',
              transform: hovLogin ? 'translateY(-2px)' : 'translateY(0)',
              transition: 'all 0.2s ease',
            }}
          >LOGIN</button>
        </div>

        {/* Bottom feature tags */}
        <div style={{
          marginTop: '3.2rem', display: 'flex', gap: '2.8rem',
          color: '#0c1e2c', fontSize: '0.68rem', letterSpacing: '0.16em',
        }}>
          <span>5-MIN SESSIONS</span>
          <span style={{ color: '#07141e' }}>·</span>
          <span>12 ISLANDS</span>
          <span style={{ color: '#07141e' }}>·</span>
          <span>LIVE BOUNTY BOARD</span>
        </div>
      </div>

      <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>
    </div>
  );
}
