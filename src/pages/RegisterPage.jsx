import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api.js';

const MONO = "'Courier New', Courier, monospace";

function BgCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    let W, H;
    const resize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random() * 0.6,
      r: Math.random() < 0.1 ? 1.5 : 0.6,
      a: 0.2 + Math.random() * 0.7, sp: 0.005 + Math.random() * 0.01, ph: Math.random() * 6.28,
    }));
    let wv = 0, raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const sk = ctx.createLinearGradient(0, 0, 0, H);
      sk.addColorStop(0, '#010408'); sk.addColorStop(1, '#020c14');
      ctx.fillStyle = sk; ctx.fillRect(0, 0, W, H);
      stars.forEach(s => {
        s.ph += s.sp;
        ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${s.a*(0.5+0.5*Math.sin(s.ph))})`; ctx.fill();
      });
      wv += 0.4;
      for (let i = 0; i < 5; i++) {
        const wy = H*(0.65+i*0.07);
        ctx.beginPath(); ctx.moveTo(0, wy);
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, wy + Math.sin((x+wv+i*40)*0.022)*(3+i*1.5));
        ctx.strokeStyle = `rgba(0,245,212,${0.018+i*0.012})`; ctx.lineWidth=1; ctx.stroke();
      }
      const vg = ctx.createRadialGradient(W/2,H/2,H*0.1,W/2,H/2,W*0.9);
      vg.addColorStop(0,'transparent'); vg.addColorStop(1,'rgba(1,4,8,0.72)');
      ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />;
}

export default function RegisterPage() {
  const [form,    setForm]    = useState({ handle: '', email: '', password: '' });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusF,  setFocusF]  = useState('');
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      await api.post('/api/auth/register', form);
      setSuccess('Account created! Setting sail...');
      setTimeout(() => navigate('/login'), 1400);
    } catch (err) {
      setError(err.response?.data || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const inputStyle = name => ({
    width: '100%', background: focusF === name ? 'rgba(0,245,212,0.04)' : '#0a0f18',
    border: `1px solid ${focusF === name ? 'rgba(0,245,212,0.45)' : 'rgba(0,245,212,0.10)'}`,
    color: '#c8dde8', padding: '0.7rem 0.95rem',
    fontFamily: MONO, fontSize: '0.9rem',
    marginBottom: '1.3rem', outline: 'none',
    transition: 'all 0.18s', boxSizing: 'border-box',
    boxShadow: focusF === name ? '0 0 18px rgba(0,245,212,0.08)' : 'none',
  });

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: MONO }}>
      <BgCanvas />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '390px', position: 'relative',
          background: 'linear-gradient(160deg, rgba(4,9,20,0.97) 0%, rgba(2,6,14,0.99) 100%)',
          border: '1px solid rgba(0,245,212,0.10)',
          boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(0,245,212,0.04)',
          animation: 'cardIn 0.35s ease',
        }}>
          {/* Top accent */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, #00f5d4, #00f5d455, transparent)' }} />

          <div style={{ padding: '2.4rem 2.6rem 2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}>🏴</div>
              <h2 style={{ color: '#00f5d4', fontSize: '1.3rem', fontWeight: 900, letterSpacing: '0.25em', margin: 0 }}>REGISTER</h2>
              <p style={{ color: '#0f2535', fontSize: '10px', letterSpacing: '4px', margin: '6px 0 0' }}>CLAIM YOUR NAME ON THE OCEAN</p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.25)',
                color: '#ff4466', fontSize: '11px', padding: '8px 12px',
                letterSpacing: '1px', marginBottom: '1.2rem', textAlign: 'center',
              }}>{error}</div>
            )}
            {success && (
              <div style={{
                background: 'rgba(0,245,212,0.08)', border: '1px solid rgba(0,245,212,0.25)',
                color: '#00f5d4', fontSize: '11px', padding: '8px 12px',
                letterSpacing: '1px', marginBottom: '1.2rem', textAlign: 'center',
              }}>{success}</div>
            )}

            <form onSubmit={handleSubmit}>
              <label style={{ color: '#1e3a4e', fontSize: '10px', letterSpacing: '3px', display: 'block', marginBottom: '6px' }}>PIRATE HANDLE</label>
              <input
                style={inputStyle('handle')} type="text" name="handle"
                value={form.handle} onChange={handleChange} required maxLength={30}
                placeholder="Your pirate name"
                onFocus={() => setFocusF('handle')} onBlur={() => setFocusF('')}
              />
              <label style={{ color: '#1e3a4e', fontSize: '10px', letterSpacing: '3px', display: 'block', marginBottom: '6px' }}>EMAIL</label>
              <input
                style={inputStyle('email')} type="email" name="email"
                value={form.email} onChange={handleChange} required
                onFocus={() => setFocusF('email')} onBlur={() => setFocusF('')}
              />
              <label style={{ color: '#1e3a4e', fontSize: '10px', letterSpacing: '3px', display: 'block', marginBottom: '6px' }}>PASSWORD</label>
              <input
                style={inputStyle('password')} type="password" name="password"
                value={form.password} onChange={handleChange} required minLength={6}
                onFocus={() => setFocusF('password')} onBlur={() => setFocusF('')}
              />
              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '0.85rem',
                  background: loading ? 'rgba(0,245,212,0.25)' : 'linear-gradient(135deg, #00f5d4, #00c8b0)',
                  color: '#010810', border: 'none', fontFamily: MONO,
                  fontWeight: 900, fontSize: '0.9rem', letterSpacing: '0.2em',
                  cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.3rem',
                  boxShadow: loading ? 'none' : '0 0 28px rgba(0,245,212,0.30)',
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow='0 0 50px rgba(0,245,212,0.50)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow='0 0 28px rgba(0,245,212,0.30)'; }}
              >{loading ? '▸ REGISTERING...' : 'JOIN THE OCEAN'}</button>
            </form>

            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.10), transparent)', margin: '1.5rem 0' }} />
            <Link to="/login" style={{ color: '#0f2535', display: 'block', textAlign: 'center', fontSize: '11px', letterSpacing: '2px', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color='#00f5d4'}
              onMouseLeave={e => e.currentTarget.style.color='#0f2535'}
            >Already sailing? Login</Link>
          </div>
        </div>
      </div>
      <style>{`@keyframes cardIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } } * { box-sizing:border-box; } body { margin:0; }`}</style>
    </div>
  );
}
