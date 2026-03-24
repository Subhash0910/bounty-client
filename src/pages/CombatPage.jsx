import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { CombatScene } from '../scenes/index.js';
import WantedPoster from '../components/WantedPoster.jsx';
import api from '../services/api.js';

const MONO = "'Courier New', Courier, monospace";

// ─── Glassmorphism action button ────────────────────────────────────────────
function ActionBtn({ icon, label, sub, color, disabled, onClick }) {
  const [hov, setHov] = useState(false);
  const active = hov && !disabled;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '200px', height: '76px',
        background: active
          ? `linear-gradient(160deg, ${color}18 0%, ${color}08 100%)`
          : 'linear-gradient(160deg, rgba(5,10,20,0.85) 0%, rgba(5,10,20,0.70) 100%)',
        border: `1px solid ${disabled ? '#1a2535' : active ? color : color + '55'}`,
        borderRadius: '2px',
        boxShadow: active
          ? `0 0 32px ${color}44, inset 0 1px 0 ${color}22`
          : disabled ? 'none' : `0 0 8px ${color}18, inset 0 1px 0 ${color}10`,
        color: disabled ? '#2a3a4a' : color,
        fontFamily: MONO,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '3px', padding: '0',
        transition: 'all 0.18s ease',
        transform: active ? 'translateY(-2px)' : 'none',
        opacity: disabled ? 0.30 : 1,
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Top shimmer line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: active ? `linear-gradient(90deg, transparent, ${color}88, transparent)` : 'transparent',
        transition: 'background 0.18s',
      }} />
      <span style={{ fontSize: '20px', lineHeight: 1, filter: disabled ? 'grayscale(1)' : 'none' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '4px' }}>{label}</span>
      <span style={{ fontSize: '10px', color: disabled ? '#1e2e3e' : '#556677', letterSpacing: '0.5px', textAlign: 'center', padding: '0 6px' }}>{sub}</span>
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CombatPage() {
  const { islandId } = useParams();
  const navigate      = useNavigate();
  const gameRef       = useRef(null);
  const phaserRef     = useRef(null);
  const lockRef       = useRef(false);

  const [island,      setIsland]      = useState(null);
  const [combat,      setCombat]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [overlay,     setOverlay]     = useState(null);
  const [log,         setLog]         = useState([]);

  const bounty = Number(localStorage.getItem('bounty') || 0);

  // ── Boot Phaser then fetch ─────────────────────────────────────────────────
  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: gameRef.current,
      width:  window.innerWidth,
      height: window.innerHeight,
      transparent: false,
      backgroundColor: '#010408',
      scene: [CombatScene],
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      // Disable Phaser's default banner
      banner: false,
    });
    phaserRef.current = game;
    const onResize = () => game.scale.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    (async () => {
      try {
        const [iRes, sRes] = await Promise.all([
          api.get(`/api/islands/${islandId}`),
          api.post(`/api/islands/${islandId}/sail`),
        ]);
        setIsland(iRes.data);
        setCombat(sRes.data);
        game.events.emit('initCombat', { ...sRes.data, islandName: iRes.data.name });
        setLog([`⚓ You sail toward ${iRes.data.name}. Steel your nerves.`]);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to start encounter.');
      }
    })();
    return () => { window.removeEventListener('resize', onResize); game.destroy(true); };
  }, [islandId]);

  // ── Turn handler ───────────────────────────────────────────────────────────
  const takeTurn = useCallback(async (approach) => {
    if (lockRef.current || !combat || combat.status !== 'ONGOING') return;
    lockRef.current = true; setLoading(true);
    try {
      const res   = await api.post('/api/encounter/turn', { approach });
      const state = res.data;
      setCombat(state);
      phaserRef.current?.events.emit('combatUpdate', { ...state, lastApproach: approach });
      const msgs = {
        ATTACK: state.playerHealth < combat.playerHealth
          ? `⚔️ Clash! You deal damage but take ${combat.playerHealth - state.playerHealth} in return.`
          : `⚔️ Your cannons roar! Direct hit!`,
        INTIMIDATE: state.enemyHealth < combat.enemyHealth
          ? `👁 Your reputation strikes fear — enemy morale crumbles!`
          : `👁 They stand firm. Your name means nothing here.`,
        NEGOTIATE: state.status === 'PLAYER_WON'
          ? `🤝 They accept your terms. The island is yours.`
          : `🤝 Rejected! Enemy strikes back!`,
      };
      setLog(prev => [msgs[approach] || approach, ...prev].slice(0, 3));
      if (state.status === 'PLAYER_WON') {
        const nb = bounty + (state.bountyChange ?? 0);
        localStorage.setItem('bounty', nb);
        const ic = Number(localStorage.getItem('islandsConquered') || 0) + 1;
        localStorage.setItem('islandsConquered', ic);
        localStorage.setItem('wantedPoster', JSON.stringify({
          handle: localStorage.getItem('handle'), bounty: nb,
          tier: localStorage.getItem('tier') || 'Drifter',
          islandsConquered: ic, seasonRank: null,
        }));
        setTimeout(() => setOverlay('victory'), 800);
      }
      if (state.status === 'PLAYER_LOST') setTimeout(() => setOverlay('defeat'), 800);
    } catch {
      setLog(prev => ['⚠️ Connection lost — try again.', ...prev].slice(0, 3));
    } finally {
      lockRef.current = false; setLoading(false);
    }
  }, [combat, bounty]);

  const ongoing  = combat?.status === 'ONGOING';
  const btnOff   = !ongoing || loading;
  const intOk    = bounty >= 1000;
  const intSub   = !intOk ? 'REQUIRES 1,000 BOUNTY' : bounty >= 10000 ? '30 MORALE DMG  •  NO RETALIATION' : '10 MORALE DMG';
  const round    = combat?.round ?? 1;
  const poster   = JSON.parse(localStorage.getItem('wantedPoster') || 'null');

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', fontFamily: MONO, background:'#010408' }}>

      {/* Phaser canvas — fills everything */}
      <div ref={gameRef} style={{ position:'absolute', inset:0, zIndex:0 }} />

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '56px',
        background: 'linear-gradient(180deg, rgba(1,4,8,0.96) 0%, rgba(1,4,8,0.75) 70%, transparent 100%)',
        display: 'flex', alignItems: 'center',
        padding: '0 28px', gap: '18px', zIndex: 30,
        borderBottom: '1px solid rgba(0,245,212,0.06)',
      }}>
        {/* Island name + lore */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1px', flex: 1, overflow:'hidden', minWidth:0 }}>
          <span style={{ color:'#00f5d4', fontWeight:700, fontSize:'13px', letterSpacing:'3px', whiteSpace:'nowrap' }}>
            {island?.name || '——'}
          </span>
          <span style={{ color:'#2a3f52', fontSize:'11px', fontStyle:'italic', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {island?.lore || ''}
          </span>
        </div>
        {/* Center round */}
        <div style={{ textAlign:'center', flexShrink:0 }}>
          <div style={{ color:'#ffd700', fontSize:'11px', letterSpacing:'8px', fontWeight:700 }}>ROUND {round}</div>
          <div style={{ color:'#2a3f52', fontSize:'9px', letterSpacing:'2px', marginTop:'2px' }}>COMBAT</div>
        </div>
        {/* Back */}
        <button
          onClick={() => navigate('/world')}
          style={{
            background:'transparent',
            border:'1px solid rgba(255,68,102,0.25)',
            color:'#334455', fontFamily:MONO, fontSize:'11px',
            padding:'5px 16px', cursor:'pointer', flexShrink:0,
            letterSpacing:'3px', transition:'all 0.18s',
            borderRadius:'1px',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='#ff4466'; e.currentTarget.style.color='#ff4466'; e.currentTarget.style.boxShadow='0 0 12px #ff446633'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,68,102,0.25)'; e.currentTarget.style.color='#334455'; e.currentTarget.style.boxShadow='none'; }}
        >
          ← BACK
        </button>
      </div>

      {/* ══ COMBAT LOG ═══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        bottom: '150px',
        left: '50%', transform: 'translateX(-50%)',
        width: '560px', zIndex: 30,
        display: 'flex', flexDirection: 'column', gap: '3px',
        pointerEvents: 'none',
      }}>
        {log.map((line, i) => (
          <div key={`${line}-${i}`} style={{
            background: 'rgba(2,6,14,0.78)',
            backdropFilter: 'blur(6px)',
            borderLeft: `2px solid ${i === 0 ? '#00f5d466' : '#00f5d418'}`,
            borderRight: '1px solid rgba(0,245,212,0.05)',
            padding: '7px 18px',
            color: i === 0 ? '#99bbcc' : '#334455',
            fontSize: '12px',
            letterSpacing: '0.3px',
            lineHeight: '1.5',
            animation: i === 0 ? 'logIn 0.28s ease' : 'none',
            transition: 'opacity 0.4s',
          }}>
            {line}
          </div>
        ))}
      </div>

      {/* Processing indicator */}
      {loading && (
        <div style={{
          position:'absolute', bottom:'152px', left:'50%', transform:'translateX(-50%)',
          color:'#00f5d4', fontSize:'11px', letterSpacing:'5px', zIndex:31,
          animation:'blink 0.55s ease-in-out infinite', whiteSpace:'nowrap',
        }}>▸ PROCESSING</div>
      )}

      {/* ══ ACTION BAR ═══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '130px',
        background: 'linear-gradient(0deg, rgba(1,4,8,0.98) 0%, rgba(1,4,8,0.90) 55%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '20px', zIndex: 30,
        paddingBottom: '18px',
        borderTop: '1px solid rgba(0,245,212,0.04)',
      }}>
        {/* Divider lines between buttons */}
        <ActionBtn icon="⚔️"  label="ATTACK"     color="#00f5d4" sub="15–25 DMG  •  10–20 TAKEN" disabled={btnOff}             onClick={() => takeTurn('ATTACK')} />
        <div style={{ width:'1px', height:'50px', background:'linear-gradient(180deg,transparent,#1a2535,transparent)' }} />
        <ActionBtn icon="👁"  label="INTIMIDATE" color="#9b59b6" sub={intSub}                    disabled={btnOff || !intOk}   onClick={() => takeTurn('INTIMIDATE')} />
        <div style={{ width:'1px', height:'50px', background:'linear-gradient(180deg,transparent,#1a2535,transparent)' }} />
        <ActionBtn icon="🤝" label="NEGOTIATE"  color="#ffd700" sub="40% CHANCE  •  HALF REWARD" disabled={btnOff}             onClick={() => takeTurn('NEGOTIATE')} />
      </div>

      {/* ══ ERROR ════════════════════════════════════════════════════════════ */}
      {error && (
        <div style={{ position:'absolute', inset:0, background:'rgba(1,4,8,0.92)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:50, gap:'1.5rem' }}>
          <p style={{ color:'#ff4466', fontFamily:MONO, letterSpacing:'2px' }}>{error}</p>
          <button style={{ background:'transparent', border:'1px solid #00f5d4', color:'#00f5d4', padding:'0.7rem 2rem', fontFamily:MONO, cursor:'pointer', letterSpacing:'3px' }} onClick={() => navigate('/world')}>← BACK TO OCEAN</button>
        </div>
      )}

      {/* ══ VICTORY OVERLAY ══════════════════════════════════════════════════ */}
      {overlay === 'victory' && (
        <div style={{
          position:'absolute', inset:0,
          background:'radial-gradient(ellipse at center, rgba(0,40,35,0.97) 0%, rgba(1,4,8,0.98) 70%)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          zIndex:50, gap:'14px',
          animation:'fadeOverlay 0.6s ease',
        }}>
          {/* Decorative top line */}
          <div style={{ width:'120px', height:'1px', background:'linear-gradient(90deg,transparent,#ffd700,transparent)', marginBottom:'4px' }} />
          <p style={{ fontFamily:MONO, fontSize:'10px', color:'#445566', letterSpacing:'10px', margin:0 }}>ISLAND CLAIMED</p>
          <h1 style={{ fontFamily:MONO, fontSize:'68px', fontWeight:900, color:'#ffd700', margin:0, letterSpacing:'0.18em', textShadow:'0 0 60px #ffd70088, 0 0 120px #ffd70033' }}>
            VICTORY
          </h1>
          <p style={{ fontFamily:MONO, fontSize:'22px', color:'#ffd700', margin:0, textShadow:'0 0 20px #ffd70055' }}>
            +{(combat?.bountyChange || 0).toLocaleString()} BOUNTY
          </p>
          <p style={{ fontFamily:MONO, fontSize:'13px', color:'#00f5d4', fontStyle:'italic', margin:0, letterSpacing:'2px' }}>
            {island?.name} is yours.
          </p>
          <div style={{ width:'120px', height:'1px', background:'linear-gradient(90deg,transparent,#00f5d444,transparent)', margin:'4px 0' }} />
          {poster && <WantedPoster player={poster} />}
          <button
            style={{
              background:'linear-gradient(135deg,rgba(0,245,212,0.10),rgba(0,245,212,0.04))',
              border:'1px solid #00f5d4', color:'#00f5d4',
              padding:'10px 36px', fontFamily:MONO, fontSize:'13px',
              cursor:'pointer', letterSpacing:'4px', marginTop:'8px',
              boxShadow:'0 0 28px #00f5d433',
              transition:'all 0.18s', borderRadius:'1px',
            }}
            onMouseEnter={e=>{ e.currentTarget.style.boxShadow='0 0 50px #00f5d466'; e.currentTarget.style.background='rgba(0,245,212,0.15)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.boxShadow='0 0 28px #00f5d433'; e.currentTarget.style.background='linear-gradient(135deg,rgba(0,245,212,0.10),rgba(0,245,212,0.04))'; }}
            onClick={() => navigate('/world')}
          >⚓ BACK TO OCEAN</button>
        </div>
      )}

      {/* ══ DEFEAT OVERLAY ═══════════════════════════════════════════════════ */}
      {overlay === 'defeat' && (
        <div style={{
          position:'absolute', inset:0,
          background:'radial-gradient(ellipse at center, rgba(30,0,8,0.97) 0%, rgba(1,4,8,0.98) 70%)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          zIndex:50, gap:'14px',
          animation:'fadeOverlay 0.6s ease',
        }}>
          <div style={{ width:'120px', height:'1px', background:'linear-gradient(90deg,transparent,#ff4466,transparent)', marginBottom:'4px' }} />
          <h1 style={{ fontFamily:MONO, fontSize:'68px', fontWeight:900, color:'#ff4466', margin:0, letterSpacing:'0.18em', textShadow:'0 0 60px #ff446688, 0 0 120px #ff446622' }}>
            DEFEATED
          </h1>
          <p style={{ fontFamily:MONO, fontSize:'18px', color:'#ff4466', margin:0 }}>
            {(combat?.bountyChange || 0).toLocaleString()} BOUNTY LOST
          </p>
          <p style={{ fontFamily:MONO, fontSize:'12px', color:'#334455', fontStyle:'italic', margin:0, letterSpacing:'1px' }}>
            The ocean does not forgive weakness.
          </p>
          <div style={{ width:'120px', height:'1px', background:'linear-gradient(90deg,transparent,#ff446644,transparent)', margin:'4px 0' }} />
          <div style={{ display:'flex', gap:'14px', marginTop:'8px' }}>
            <button
              style={{ background:'linear-gradient(135deg,rgba(255,68,102,0.10),rgba(255,68,102,0.04))', border:'1px solid #ff4466aa', color:'#ff4466', padding:'10px 28px', fontFamily:MONO, fontSize:'12px', cursor:'pointer', letterSpacing:'3px', borderRadius:'1px', transition:'all 0.18s' }}
              onMouseEnter={e=>{ e.currentTarget.style.boxShadow='0 0 28px #ff446644'; }}
              onMouseLeave={e=>{ e.currentTarget.style.boxShadow='none'; }}
              onClick={() => window.location.reload()}
            >🔄 TRY AGAIN</button>
            <button
              style={{ background:'linear-gradient(135deg,rgba(0,245,212,0.08),rgba(0,245,212,0.02))', border:'1px solid #00f5d455', color:'#00f5d4', padding:'10px 28px', fontFamily:MONO, fontSize:'12px', cursor:'pointer', letterSpacing:'3px', borderRadius:'1px', transition:'all 0.18s' }}
              onMouseEnter={e=>{ e.currentTarget.style.boxShadow='0 0 28px #00f5d433'; }}
              onMouseLeave={e=>{ e.currentTarget.style.boxShadow='none'; }}
              onClick={() => navigate('/world')}
            >← BACK TO OCEAN</button>
          </div>
        </div>
      )}

      {/* Global keyframes */}
      <style>{`
        @keyframes logIn       { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blink       { 0%,100%{opacity:1;} 50%{opacity:0.25;} }
        @keyframes fadeOverlay { from { opacity:0; } to { opacity:1; } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
