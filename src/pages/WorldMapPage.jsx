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

function DifficultyStars({ difficulty, color }) {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{
          fontSize: '15px',
          color: i <= difficulty ? color : '#2a3a4a',
          filter: i <= difficulty ? `drop-shadow(0 0 5px ${color}99)` : 'none',
          transition: 'all 0.15s',
        }}>★</span>
      ))}
    </div>
  );
}

export default function WorldMapPage() {
  const navigate  = useNavigate();
  const gameRef   = useRef(null);
  const phaserRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [hovSail,  setHovSail]  = useState(false);

  const handle = localStorage.getItem('handle') || 'Drifter';
  const bounty = Number(localStorage.getItem('bounty') || 0);

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      transparent: true,
      parent: gameRef.current,
      backgroundColor: '#0a0a0f',
      scene: [WorldMapScene],
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      banner: false,
    });
    phaserRef.current = game;
    game.events.on('islandSelected', island => setSelected(island));
    const onResize = () => game.scale.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      game.events.off('islandSelected');
      game.destroy(true);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('handle');
    localStorage.removeItem('bounty');
    navigate('/');
  };

  const typeColor = selected ? (TYPE_COLORS[selected.type] || '#00f5d4') : '#00f5d4';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: MONO, background: '#0a0a0f' }}>

      {/* Phaser canvas */}
      <div ref={gameRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* ══ TOP HUD BAR ════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '56px', zIndex: 40,
        background: 'linear-gradient(180deg, rgba(1,4,8,0.97) 0%, rgba(1,4,8,0.80) 60%, transparent 100%)',
        borderBottom: '1px solid rgba(0,245,212,0.12)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: '20px',
      }}>
        {/* Player info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: 'radial-gradient(circle, #0f2828 60%, #00f5d411)',
            border: '1px solid rgba(0,245,212,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', flexShrink: 0,
          }}>🏴</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ color: '#00f5d4', fontSize: '12px', fontWeight: 700, letterSpacing: '3px' }}>
              {handle.toUpperCase()}
            </span>
            <span style={{ color: '#ffd700', fontSize: '11px', letterSpacing: '1px' }}>
              ₦ {bounty.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Center title */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ color: '#7a9ab5', fontSize: '10px', letterSpacing: '7px' }}>SEASON 1 · WORLD MAP</div>
        </div>

        {/* Logout */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent', fontFamily: MONO,
              border: '1px solid rgba(255,68,102,0.35)', color: '#cc3355',
              fontSize: '10px', letterSpacing: '3px', padding: '5px 14px', cursor: 'pointer',
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,68,102,0.8)'; e.currentTarget.style.color='#ff4466'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,68,102,0.35)'; e.currentTarget.style.color='#cc3355'; }}
          >LOGOUT</button>
        </div>
      </div>

      {/* ══ ISLAND DETAIL SIDE PANEL ═════════════════════════════════════════════════════ */}
      {selected && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: '310px', zIndex: 50,
          background: 'linear-gradient(180deg, rgba(3,7,16,0.98) 0%, rgba(2,5,12,0.99) 100%)',
          borderLeft: `1px solid ${typeColor}44`,
          boxShadow: `-24px 0 80px rgba(0,0,0,0.85), inset 1px 0 0 ${typeColor}22`,
          display: 'flex', flexDirection: 'column',
          animation: 'slidePanel 0.22s ease',
        }}>

          {/* Color accent top bar */}
          <div style={{
            height: '3px', flexShrink: 0,
            background: `linear-gradient(90deg, ${typeColor}, ${typeColor}44, transparent)`,
            boxShadow: `0 0 18px ${typeColor}66`,
          }} />

          {/* Content */}
          <div style={{ padding: '24px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>

            {/* Type badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              fontSize: '9px', letterSpacing: '5px', color: typeColor,
              opacity: 0.9,
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: typeColor, boxShadow: `0 0 8px ${typeColor}` }} />
              {selected.type} TERRITORY
            </div>

            {/* Island name */}
            <h2 style={{
              color: '#ddeeff', fontSize: '1.3rem', fontWeight: 900,
              margin: 0, letterSpacing: '1.5px', lineHeight: 1.25,
              textShadow: `0 0 30px ${typeColor}33`,
            }}>{selected.name}</h2>

            {/* Stars */}
            <DifficultyStars difficulty={selected.difficulty} color={typeColor} />

            {/* Stats block */}
            <div style={{
              background: 'rgba(0,245,212,0.03)',
              border: '1px solid rgba(0,245,212,0.12)',
              display: 'flex', flexDirection: 'column', gap: '0',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px' }}>
                <span style={{ color: '#8aaabb', fontSize: '11px', letterSpacing: '2px' }}>BOUNTY REWARD</span>
                <span style={{ color: '#ffd700', fontWeight: 700, fontSize: '13px', textShadow: '0 0 10px #ffd70055' }}>
                  ₦ {Number(selected.bountyReward).toLocaleString()}
                </span>
              </div>
              <div style={{ height: '1px', background: 'rgba(0,245,212,0.08)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px' }}>
                <span style={{ color: '#8aaabb', fontSize: '11px', letterSpacing: '2px' }}>DIFFICULTY</span>
                <span style={{ color: typeColor, fontWeight: 700, fontSize: '13px' }}>
                  {selected.difficulty} / 5
                </span>
              </div>
              <div style={{ height: '1px', background: 'rgba(0,245,212,0.08)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px' }}>
                <span style={{ color: '#8aaabb', fontSize: '11px', letterSpacing: '2px' }}>CONTROLLED BY</span>
                <span style={{
                  color: selected.ownerHandle ? '#00f5d4' : '#5a7a8a',
                  fontWeight: 700, fontSize: '11px', letterSpacing: '1px',
                }}>
                  {selected.ownerHandle ? `⚑ ${selected.ownerHandle}` : 'UNCLAIMED'}
                </span>
              </div>
            </div>

            {/* Lore */}
            {selected.lore && (
              <p style={{
                color: '#9ab5c5', fontSize: '11px', fontStyle: 'italic',
                lineHeight: '1.75', margin: 0,
                borderLeft: `2px solid ${typeColor}55`,
                paddingLeft: '12px',
              }}>"{selected.lore}"</p>
            )}
          </div>

          {/* ── Action buttons ──────────────────────────────────────────────────── */}
          <div style={{ padding: '18px 22px', borderTop: '1px solid rgba(0,245,212,0.08)', flexShrink: 0 }}>
            <button
              onMouseEnter={() => setHovSail(true)}
              onMouseLeave={() => setHovSail(false)}
              onClick={() => navigate(`/combat/${selected.id}`)}
              style={{
                width: '100%', padding: '13px',
                background: hovSail
                  ? `linear-gradient(135deg, ${typeColor}30, ${typeColor}15)`
                  : `linear-gradient(135deg, ${typeColor}18, ${typeColor}08)`,
                border: `1px solid ${hovSail ? typeColor : typeColor + '88'}`,
                color: typeColor, fontFamily: MONO, fontWeight: 900,
                fontSize: '13px', letterSpacing: '4px', cursor: 'pointer',
                boxShadow: hovSail ? `0 0 45px ${typeColor}44` : `0 0 18px ${typeColor}18`,
                transform: hovSail ? 'translateY(-1px)' : 'none',
                transition: 'all 0.18s', marginBottom: '10px',
              }}
            >⚓ SET SAIL</button>
            <button
              onClick={() => setSelected(null)}
              style={{
                width: '100%', padding: '8px', background: 'transparent',
                border: '1px solid rgba(0,245,212,0.12)', color: '#5a7a8a',
                fontFamily: MONO, fontSize: '10px', letterSpacing: '3px', cursor: 'pointer',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#9ab5c5'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#5a7a8a'; }}
            >DISMISS</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slidePanel {
          from { transform: translateX(36px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
