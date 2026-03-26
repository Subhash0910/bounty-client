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

function DifficultyStars({ difficulty, color }) {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{
          fontSize: '14px',
          color: i <= difficulty ? color : '#1a2a3a',
          filter: i <= difficulty ? `drop-shadow(0 0 5px ${color}99)` : 'none',
          transition: 'all 0.15s',
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

      <div ref={gameRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* ══ TOP HUD BAR ══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '54px', zIndex: 40,
        background: 'rgba(1,4,8,0.97)',
        borderBottom: '2px solid rgba(0,245,212,0.15)',
        display: 'flex', alignItems: 'center', padding: '0 22px', gap: '20px',
        boxShadow: '0 2px 20px rgba(0,0,0,0.8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: 'radial-gradient(circle, #0f2828 60%, #00f5d411)',
            border: '2px solid rgba(0,245,212,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', flexShrink: 0,
          }}>🏴</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 900, letterSpacing: '3px' }}>
              {handle.toUpperCase()}
            </span>
            <span style={{ color: '#ffd700', fontSize: '11px', letterSpacing: '1px', fontWeight: 700 }}>
              ₦ {bounty.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ color: '#4a6a8a', fontSize: '10px', letterSpacing: '7px', fontWeight: 700 }}>SEASON 1 · WORLD MAP</div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent', fontFamily: MONO,
              border: '1px solid rgba(255,68,102,0.35)', color: '#cc3355',
              fontSize: '10px', letterSpacing: '3px', padding: '5px 14px', cursor: 'pointer',
              transition: 'all 0.14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff4466'; e.currentTarget.style.color = '#ff4466'; e.currentTarget.style.boxShadow = '0 0 12px #ff446633'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,68,102,0.35)'; e.currentTarget.style.color = '#cc3355'; e.currentTarget.style.boxShadow = 'none'; }}
          >LOGOUT</button>
        </div>
      </div>

      {/* ══ ISLAND DETAIL PANEL ══════════════════════════════════════════════ */}
      {selected && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: '300px', zIndex: 50,
          background: 'rgba(2,5,14,0.99)',
          borderLeft: `2px solid ${typeColor}55`,
          boxShadow: `-20px 0 60px rgba(0,0,0,0.9)`,
          display: 'flex', flexDirection: 'column',
          animation: 'slidePanel 0.2s ease',
        }}>

          {/* Color accent top */}
          <div style={{
            height: '4px', flexShrink: 0,
            background: `linear-gradient(90deg, ${typeColor}, ${typeColor}44, transparent)`,
            boxShadow: `0 0 20px ${typeColor}55`,
          }} />

          <div style={{ padding: '22px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

            {/* Type badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '9px', letterSpacing: '4px', color: typeColor, fontWeight: 900 }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: typeColor, boxShadow: `0 0 10px ${typeColor}` }} />
              {selected.type} TERRITORY
            </div>

            {/* Island name */}
            <h2 style={{
              color: '#ffffff', fontSize: '1.3rem', fontWeight: 900,
              margin: 0, letterSpacing: '1.5px', lineHeight: 1.25,
              textShadow: `0 0 24px ${typeColor}44`,
            }}>{selected.name}</h2>

            <DifficultyStars difficulty={selected.difficulty} color={typeColor} />

            {/* Type description */}
            <div style={{ fontSize: '10px', color: `${typeColor}99`, letterSpacing: '1px', fontStyle: 'italic' }}>
              {TYPE_DESC[selected.type] || ''}
            </div>

            {/* Stats block */}
            <div style={{
              background: 'rgba(0,0,0,0.4)',
              border: `1px solid ${typeColor}22`,
              display: 'flex', flexDirection: 'column',
            }}>
              <StatLine label="BOUNTY REWARD" value={`₦ ${Number(selected.bountyReward).toLocaleString()}`} color="#ffd700" />
              <div style={{ height: '1px', background: 'rgba(0,245,212,0.07)' }} />
              <StatLine label="DIFFICULTY" value={`${selected.difficulty} / 5`} color={typeColor} />
              <div style={{ height: '1px', background: 'rgba(0,245,212,0.07)' }} />
              <StatLine
                label="CONTROLLED BY"
                value={selected.ownerHandle ? `⚑ ${selected.ownerHandle}` : 'UNCLAIMED'}
                color={selected.ownerHandle ? '#00f5d4' : '#4a5a6a'}
              />
            </div>

            {/* Lore */}
            {selected.lore && (
              <p style={{
                color: '#8aacbc', fontSize: '11px', fontStyle: 'italic',
                lineHeight: '1.8', margin: 0,
                borderLeft: `3px solid ${typeColor}55`,
                paddingLeft: '12px',
              }}>"{selected.lore}"</p>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ padding: '16px 20px', borderTop: `1px solid ${typeColor}22`, flexShrink: 0 }}>
            <button
              onMouseEnter={() => setHovSail(true)}
              onMouseLeave={() => setHovSail(false)}
              onClick={() => navigate(`/combat/${selected.id}`)}
              style={{
                width: '100%', padding: '14px',
                background: hovSail
                  ? `linear-gradient(135deg, ${typeColor}35, ${typeColor}18)`
                  : `linear-gradient(135deg, ${typeColor}18, ${typeColor}08)`,
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
                fontFamily: MONO, fontSize: '10px', letterSpacing: '3px', cursor: 'pointer',
                transition: 'all 0.14s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#9ab5c5'; e.currentTarget.style.borderColor = 'rgba(0,245,212,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#4a6a7a'; e.currentTarget.style.borderColor = 'rgba(0,245,212,0.12)'; }}
            >DISMISS</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slidePanel {
          from { transform: translateX(30px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #010408; }
        ::-webkit-scrollbar-thumb { background: #1a3a4a; }
      `}</style>
    </div>
  );
}
