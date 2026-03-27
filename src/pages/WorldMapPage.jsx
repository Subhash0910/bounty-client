import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { WorldMapScene } from '../scenes/index.js';

const MONO = "'Courier New', Courier, monospace";

const TYPE_COLORS = {
  DRIFTER:  '#4a9eff',
  MERCHANT: '#ffd700',
  WARLORD:  '#ff4444',
  VOID:     '#9b59b6',
};

const TYPE_DESC = {
  DRIFTER:  'Low risk. Good for early bounty.',
  MERCHANT: 'Medium risk. Trade routes guarded.',
  WARLORD:  'High risk. Heavy defences.',
  VOID:     'EXTREME. Enter at your own peril.',
};

const RANK_TIERS = [
  { min: 0,     label: 'CABIN BOY',    color: '#6a8a9a' },
  { min: 500,   label: 'DECKHAND',     color: '#4a9eff' },
  { min: 2000,  label: 'BUCCANEER',    color: '#00f5d4' },
  { min: 5000,  label: 'CORSAIR',      color: '#ffd700' },
  { min: 12000, label: 'WARLORD',      color: '#ff8800' },
  { min: 25000, label: 'DREAD PIRATE', color: '#ff4466' },
];

function getRank(bounty) {
  let rank = RANK_TIERS[0];
  for (const t of RANK_TIERS) { if (bounty >= t.min) rank = t; }
  return rank;
}

function DifficultyStars({ difficulty, color }) {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{
          fontSize: '14px',
          color: i <= difficulty ? color : '#1a2a3a',
          filter: i <= difficulty ? `drop-shadow(0 0 5px ${color}99)` : 'none',
        }}>★</span>
      ))}
    </div>
  );
}

function StatLine({ label, value, color = '#8aaabb' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
      <span style={{ color: '#6a8a9a', fontSize: '11px', letterSpacing: '2px' }}>{label}</span>
      <span style={{ color, fontWeight: 900, fontSize: '13px' }}>{value}</span>
    </div>
  );
}

export default function WorldMapPage() {
  const navigate  = useNavigate();
  const gameRef   = useRef(null);
  const phaserRef = useRef(null);
  const [selected,  setSelected]  = useState(null);
  const [hovSail,   setHovSail]   = useState(false);
  const [seaToast,  setSeaToast]  = useState(null);

  const handle = localStorage.getItem('handle') || 'Drifter';
  const bounty = Number(localStorage.getItem('bounty') || 0);
  const rank   = getRank(bounty);

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x

    const game = new Phaser.Game({
      type: Phaser.CANVAS,          // force Canvas (WebGL can also blur on some drivers)
      width:  window.innerWidth,
      height: window.innerHeight,
      transparent: false,
      parent: gameRef.current,
      backgroundColor: '#060a16',
      // ─── HiDPI / blur fix ───────────────────────────────────
      resolution: dpr,              // matches device pixel ratio — kills blur
      // ──────────────────────────────────────────
      scene: [WorldMapScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        resolution: dpr,
      },
      render: {
        antialias: false,           // sharp pixel rendering, no AA softening
        roundPixels: true,          // snap to whole pixels — kills sub-pixel blur
        pixelArt: false,
      },
      banner: false,
    });

    phaserRef.current = game;
    game.events.on('islandSelected', island => setSelected(island));
    game.events.on('seaEventResult', ({ gained, event: evId }) => {
      setSeaToast({ gained, evId });
      setTimeout(() => setSeaToast(null), 3200);
    });

    const onResize = () => game.scale.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      game.events.off('islandSelected');
      game.events.off('seaEventResult');
      game.destroy(true);
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const typeColor = selected ? (TYPE_COLORS[selected.type] || '#00f5d4') : '#00f5d4';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: MONO }}>

      <div ref={gameRef} style={{
        position: 'absolute', inset: 0, zIndex: 0,
        imageRendering: 'crisp-edges',   /* tells browser: no interpolation on this canvas */
      }} />

      {/* ══ TOP HUD ═══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '54px', zIndex: 40,
        background: 'rgba(1,4,8,0.97)',
        borderBottom: '2px solid rgba(0,245,212,0.18)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: '16px',
        boxShadow: '0 2px 24px rgba(0,0,0,0.9)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: `radial-gradient(circle, ${rank.color}22 60%, transparent)`,
            border: `2px solid ${rank.color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '17px', flexShrink: 0,
            boxShadow: `0 0 12px ${rank.color}33`,
          }}>🏴‍☠️</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 900, letterSpacing: '3px' }}>
              {handle.toUpperCase()}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: rank.color, fontSize: '9px', letterSpacing: '3px', fontWeight: 700 }}>{rank.label}</span>
              <span style={{ color: '#ffd700', fontSize: '10px', letterSpacing: '1px', fontWeight: 700 }}>₦ {bounty.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ color: '#3a5a7a', fontSize: '10px', letterSpacing: '7px', fontWeight: 700 }}>SEASON 1 · WORLD MAP</div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleLogout} style={{
            background: 'transparent', fontFamily: MONO,
            border: '1px solid rgba(255,68,102,0.35)', color: '#cc3355',
            fontSize: '10px', letterSpacing: '3px', padding: '5px 14px', cursor: 'pointer', transition: 'all 0.14s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='#ff4466'; e.currentTarget.style.color='#ff4466'; e.currentTarget.style.boxShadow='0 0 12px #ff446633'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,68,102,0.35)'; e.currentTarget.style.color='#cc3355'; e.currentTarget.style.boxShadow='none'; }}
          >LOGOUT</button>
        </div>
      </div>

      {/* ══ SEA EVENT TOAST ════════════════════════════════════════════════ */}
      {seaToast && (
        <div style={{
          position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, background: 'rgba(1,4,8,0.97)',
          border: `1px solid ${seaToast.gained >= 0 ? '#ffd70088' : '#ff446688'}`,
          color: seaToast.gained >= 0 ? '#ffd700' : '#ff4466',
          fontFamily: MONO, fontSize: '12px', letterSpacing: '3px', padding: '10px 28px',
          boxShadow: `0 0 30px ${seaToast.gained >= 0 ? '#ffd70033' : '#ff446633'}`,
          animation: 'toastIn 0.3s ease', whiteSpace: 'nowrap',
        }}>
          {seaToast.gained >= 0 ? `⚓ +${seaToast.gained} ₦ PLUNDERED` : `💀 AMBUSHED — ${Math.abs(seaToast.gained)} ₦ LOST`}
        </div>
      )}

      {/* ══ ISLAND DETAIL PANEL ═══════════════════════════════════════════ */}
      {selected && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '300px', zIndex: 50,
          background: 'rgba(2,5,14,0.99)',
          borderLeft: `2px solid ${typeColor}55`,
          boxShadow: `-20px 0 60px rgba(0,0,0,0.95)`,
          display: 'flex', flexDirection: 'column',
          animation: 'slidePanel 0.2s ease',
        }}>
          <div style={{
            height: '4px', flexShrink: 0,
            background: `linear-gradient(90deg, ${typeColor}, ${typeColor}44, transparent)`,
            boxShadow: `0 0 20px ${typeColor}55`,
          }} />
          <div style={{ padding: '22px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '9px', letterSpacing: '4px', color: typeColor, fontWeight: 900 }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: typeColor, boxShadow: `0 0 10px ${typeColor}` }} />
              {selected.type} TERRITORY
            </div>
            <h2 style={{ color: '#ffffff', fontSize: '1.3rem', fontWeight: 900, margin: 0, letterSpacing: '1.5px', lineHeight: 1.25, textShadow: `0 0 24px ${typeColor}44` }}>
              {selected.name}
            </h2>
            <DifficultyStars difficulty={selected.difficulty} color={typeColor} />
            <div style={{ fontSize: '10px', color: `${typeColor}88`, letterSpacing: '1px', fontStyle: 'italic' }}>
              {TYPE_DESC[selected.type] || ''}
            </div>
            <div style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${typeColor}22`, display: 'flex', flexDirection: 'column' }}>
              <StatLine label="BOUNTY REWARD" value={`₦ ${Number(selected.bountyReward).toLocaleString()}`} color="#ffd700" />
              <div style={{ height: '1px', background: 'rgba(0,245,212,0.07)' }} />
              <StatLine label="DIFFICULTY" value={`${selected.difficulty} / 5`} color={typeColor} />
              <div style={{ height: '1px', background: 'rgba(0,245,212,0.07)' }} />
              <StatLine
                label="CONTROLLED BY"
                value={selected.ownerHandle ? `⚑ ${selected.ownerHandle}` : 'UNCLAIMED'}
                color={selected.ownerHandle ? (selected.ownerHandle.toLowerCase() === handle.toLowerCase() ? '#ffd700' : '#00f5d4') : '#4a5a6a'}
              />
            </div>
            {selected.lore && (
              <p style={{ color: '#8aacbc', fontSize: '11px', fontStyle: 'italic', lineHeight: '1.8', margin: 0, borderLeft: `3px solid ${typeColor}55`, paddingLeft: '12px' }}>
                “{selected.lore}”
              </p>
            )}
          </div>
          <div style={{ padding: '16px 20px', borderTop: `1px solid ${typeColor}22`, flexShrink: 0 }}>
            <button
              onMouseEnter={() => setHovSail(true)}
              onMouseLeave={() => setHovSail(false)}
              onClick={() => navigate(`/combat/${selected.id}`)}
              style={{
                width: '100%', padding: '14px',
                background: hovSail ? `linear-gradient(135deg,${typeColor}35,${typeColor}18)` : `linear-gradient(135deg,${typeColor}18,${typeColor}08)`,
                border: `1px solid ${hovSail ? typeColor : typeColor + '77'}`,
                color: hovSail ? '#ffffff' : typeColor, fontFamily: MONO, fontWeight: 900,
                fontSize: '13px', letterSpacing: '4px', cursor: 'pointer',
                boxShadow: hovSail ? `0 0 50px ${typeColor}44` : `0 0 16px ${typeColor}18`,
                transform: hovSail ? 'translateY(-1px)' : 'none',
                transition: 'all 0.16s', marginBottom: '10px',
              }}
            >⚓ SET SAIL</button>
            <button
              onClick={() => setSelected(null)}
              style={{
                width: '100%', padding: '8px', background: 'transparent',
                border: '1px solid rgba(0,245,212,0.12)', color: '#4a6a7a',
                fontFamily: MONO, fontSize: '10px', letterSpacing: '3px', cursor: 'pointer', transition: 'all 0.14s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color='#9ab5c5'; e.currentTarget.style.borderColor='rgba(0,245,212,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color='#4a6a7a'; e.currentTarget.style.borderColor='rgba(0,245,212,0.12)'; }}
            >DISMISS</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slidePanel { from{transform:translateX(30px);opacity:0;} to{transform:translateX(0);opacity:1;} }
        @keyframes toastIn    { from{opacity:0;transform:translateX(-50%) translateY(12px);} to{opacity:1;transform:translateX(-50%) translateY(0);} }
        * { box-sizing: border-box; }
        canvas { image-rendering: crisp-edges; image-rendering: pixelated; }
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#010408;} ::-webkit-scrollbar-thumb{background:#1a3a4a;}
      `}</style>
    </div>
  );
}
