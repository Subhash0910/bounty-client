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
    const stars = Array.from({ length: 140 }, () => ({
      x: Math.random(), y: Math.random() * 0.65,
      r: Math.random() < 0.12 ? 1.8 : 0.6,
      a: 0.3 + Math.random() * 0.7, sp: 0.004 + Math.random() * 0.012, ph: Math.random() * 6.28,
    }));
    let wv = 0, raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const sk = ctx.createLinearGradient(0, 0, 0, H);
      sk.addColorStop(0, '#01030a'); sk.addColorStop(0.55, '#010b18'); sk.addColorStop(1, '#021224');
      ctx.fillStyle = sk; ctx.fillRect(0, 0, W, H);
      const mx = W * 0.15, my = H * 0.14;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 55);
      mg.addColorStop(0, 'rgba(200,220,255,0.22)'); mg.addColorStop(0.4, 'rgba(160,190,255,0.10)'); mg.addColorStop(1, 'transparent');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 55, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(200,215,255,0.55)'; ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#01030a'; ctx.beginPath(); ctx.arc(mx+7, my-4, 15, 0, Math.PI*2); ctx.fill();
      stars.forEach(s => {
        s.ph += s.sp;
        ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(200,220,255,${s.a*(0.5+0.5*Math.sin(s.ph))})`; ctx.fill();
      });
      wv += 0.35;
      for (let i = 0; i < 6; i++) {
        const wy = H * (0.62 + i * 0.065);
        ctx.beginPath(); ctx.moveTo(0, wy);
        for (let x = 0; x <= W; x += 6)
          ctx.lineTo(x, wy + Math.sin((x + wv * (1 - i*0.1) + i*55)*0.020)*(4+i*2));
        ctx.strokeStyle = `rgba(0,245,212,${0.015 + i*0.013})`; ctx.lineWidth = 1; ctx.stroke();
      }
      const vg = ctx.createRadialGradient(W/2,H/2,H*0.1,W/2,H/2,W*0.85);
      vg.addColorStop(0,'transparent'); vg.addColorStop(1,'rgba(1,4,10,0.78)');
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
    width: '100%',
    background: focusF === name ? 'rgba(0,245,212,0.05)' : 'rgba(1,6,16,0.85)',
    border: `1px solid ${focusF === name ? 'rgba(0,245,212,0.55)' : 'rgba(0,245,212,0.14)'}`,
    color: '#cce0ee',
    padding: '0.72rem 0.95rem',
    fontFamily: MONO, fontSize: '0.9rem',
    marginBottom: '1.3rem', outline: 'none',
    transition: 'all 0.18s', boxSizing: 'border-box',
    boxShadow: focusF === name ? '0 0 22px rgba(0,245,212,0.10), inset 0 0 8px rgba(0,245,212,0.03)' : 'none',
    letterSpacing: '0.5px',
  });

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: MONO }}>
      <BgCanvas />
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: '400px', position: 'relative',
          background: 'linear-gradient(160deg, rgba(3,8,20,0.97) 0%, rgba(2,5,14,0.99) 100%)',
          border: '1px solid rgba(0,245,212,0.12)',
          boxShadow: '0 0 100px rgba(0,0,0,0.85), 0 0 50px rgba(0,245,212,0.05)',
          animation: 'cardIn 0.38s ease',
        }}>
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #00f5d4, #00f5d499, transparent)' }} />

          <div style={{ padding: '2.5rem 2.6rem 2.1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.2rem' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '0.7rem', filter: 'drop-shadow(0 0 12px rgba(0,245,212,0.4))' }}>🏴</div>
              <h2 style={{ color: '#00f5d4', fontSize: '1.35rem', fontWeight: 900, letterSpacing: '0.28em', margin: 0, textShadow: '0 0 30px rgba(0,245,212,0.35)' }}>REGISTER</h2>
              <p style={{ color: '#6a9aaa', fontSize: '10px', letterSpacing: '4px', margin: '7px 0 0' }}>CLAIM YOUR NAME ON THE OCEAN</p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.28)',
                color: '#ff4466', fontSize: '11px', padding: '9px 13px',
                letterSpacing: '1px', marginBottom: '1.3rem', textAlign: 'center',
              }}>{error}</div>
            )}
            {success && (
              <div style={{
                background: 'rgba(0,245,212,0.08)', border: '1px solid rgba(0,245,212,0.28)',
                color: '#00f5d4', fontSize: '11px', padding: '9px 13px',
                letterSpacing: '1px', marginBottom: '1.3rem', textAlign: 'center',
                boxShadow: '0 0 20px rgba(0,245,212,0.08)',
              }}>{success}</div>
            )}

            <form onSubmit={handleSubmit}>
              <label style={{ color: '#7aaabb', fontSize: '10px', letterSpacing: '3px', display: 'block', marginBottom: '6px' }}>PIRATE HANDLE</label>
              <input
                style={inputStyle('handle')} type="text" name="handle"
                value={form.handle} onChange={handleChange} required maxLength={30}
                placeholder="Your pirate name"
                onFocus={() => setFocusF('handle')} onBlur={() => setFocusF('')}
              />
              <label style={{ color: '#7aaabb', fontSize: '10px', letterSpacing: '3px', display: 'block', marginBottom: '6px' }}>EMAIL</label>
              <input
                style={inputStyle('email')} type="email" name="email"
                value={form.email} onChange={handleChange} required
                onFocus={() => setFocusF('email')} onBlur={() => setFocusF('')}
              />
              <label style={{ color: '#7aaabb', fontSize: '10px', letterSpacing: '3px', display: 'block', marginBottom: '6px' }}>PASSWORD</label>
              <input
                style={inputStyle('password')} type="password" name="password"
                value={form.password} onChange={handleChange} required minLength={6}
                onFocus={() => setFocusF('password')} onBlur={() => setFocusF('')}
              />
              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '0.88rem',
                  background: loading ? 'rgba(0,245,212,0.20)' : 'linear-gradient(135deg, #00f5d4, #00c8b0)',
                  color: '#010810', border: 'none', fontFamily: MONO,
                  fontWeight: 900, fontSize: '0.9rem', letterSpacing: '0.22em',
                  cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.3rem',
                  boxShadow: loading ? 'none' : '0 0 32px rgba(0,245,212,0.35)',
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow='0 0 55px rgba(0,245,212,0.55)'; e.currentTarget.style.transform='translateY(-1px)'; }}}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.boxShadow='0 0 32px rgba(0,245,212,0.35)'; e.currentTarget.style.transform='none'; }}}
              >{loading ? '▸ REGISTERING...' : 'JOIN THE OCEAN'}</button>
            </form>

            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.12), transparent)', margin: '1.6rem 0' }} />
            <Link
              to="/login"
              style={{ color: '#5a8a9a', display: 'block', textAlign: 'center', fontSize: '11px', letterSpacing: '2px', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color='#00f5d4'}
              onMouseLeave={e => e.currentTarget.style.color='#5a8a9a'}
            >Already sailing? Login</Link>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes cardIn { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; } body { margin:0; }
        input::placeholder { color: rgba(100,150,170,0.35); }
      `}</style>
    </div>
  );
}
