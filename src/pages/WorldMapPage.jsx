import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { WorldMapScene } from '../scenes/index.js';

const S = {
  page: {
    width: '100vw',
    height: '100vh',
    background: '#0a0a0f',
    overflow: 'hidden',
    position: 'relative',
    fontFamily: "'Courier New', Courier, monospace",
  },
  logoutBtn: {
    position: 'absolute',
    top: '16px',
    right: '20px',
    background: 'transparent',
    border: '1px solid #ff446644',
    color: '#ff4466',
    padding: '0.4rem 1.1rem',
    fontFamily: "'Courier New', Courier, monospace",
    cursor: 'pointer',
    fontSize: '0.8rem',
    letterSpacing: '0.1em',
    zIndex: 100,
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '3rem',
    pointerEvents: 'none',
    zIndex: 50,
  },
  panel: {
    background: '#0f0f1aee',
    border: '1px solid #00f5d433',
    padding: '2rem',
    width: '300px',
    pointerEvents: 'all',
    boxShadow: '0 0 40px #00f5d411',
  },
  panelTitle: {
    color: '#00f5d4',
    fontSize: '1.2rem',
    fontWeight: '700',
    letterSpacing: '0.2em',
    marginBottom: '0.5rem',
  },
  panelType: {
    fontSize: '0.75rem',
    letterSpacing: '0.15em',
    marginBottom: '1rem',
    paddingBottom: '0.8rem',
    borderBottom: '1px solid #00f5d422',
  },
  panelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    fontSize: '0.85rem',
  },
  panelLabel: { color: '#8899aa' },
  panelValue: { color: '#e0e0e0' },
  lore: {
    color: '#556677',
    fontSize: '0.78rem',
    fontStyle: 'italic',
    lineHeight: '1.5',
    margin: '1rem 0',
    borderLeft: '2px solid #00f5d422',
    paddingLeft: '0.75rem',
  },
  sailBtn: {
    width: '100%',
    background: '#00f5d4',
    color: '#0a0a0f',
    border: 'none',
    padding: '0.8rem',
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: '700',
    fontSize: '1rem',
    letterSpacing: '0.15em',
    cursor: 'pointer',
    marginTop: '0.5rem',
    boxShadow: '0 0 20px #00f5d455',
  },
  closeBtn: {
    width: '100%',
    background: 'transparent',
    border: '1px solid #00f5d422',
    color: '#445566',
    padding: '0.5rem',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.8rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
    letterSpacing: '0.1em',
  },
};

const TYPE_COLORS = {
  DRIFTER:  '#4a9eff',
  MERCHANT: '#ffd700',
  WARLORD:  '#ff4444',
  VOID:     '#9b59b6',
};

function difficultyStars(d) {
  return '★'.repeat(d) + '☆'.repeat(5 - d);
}

export default function WorldMapPage() {
  const navigate   = useNavigate();
  const gameRef    = useRef(null);
  const phaserRef  = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    // Init Phaser
    const config = {
      type: Phaser.AUTO,
      width:  window.innerWidth,
      height: window.innerHeight,
      transparent: true,
      parent: gameRef.current,
      backgroundColor: '#0a0a0f',
      scene: [WorldMapScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    const game = new Phaser.Game(config);
    phaserRef.current = game;

    // Listen for island click events from scene
    game.events.on('islandSelected', (island) => {
      setSelected(island);
    });

    // Resize handler
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

  const handleSail = () => {
    if (selected) navigate(`/combat/${selected.id}`);
  };

  return (
    <div style={S.page}>
      {/* Phaser canvas mount point */}
      <div ref={gameRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* Logout button */}
      <button style={S.logoutBtn} onClick={handleLogout}>LOGOUT</button>

      {/* Island detail overlay panel */}
      {selected && (
        <div style={S.overlay}>
          <div style={S.panel}>
            <p style={{ ...S.panelType, color: TYPE_COLORS[selected.type] || '#00f5d4' }}>
              {selected.type}
            </p>
            <h2 style={S.panelTitle}>{selected.name}</h2>

            <div style={S.panelRow}>
              <span style={S.panelLabel}>DIFFICULTY</span>
              <span style={{ ...S.panelValue, color: TYPE_COLORS[selected.type] }}>
                {difficultyStars(selected.difficulty)}
              </span>
            </div>
            <div style={S.panelRow}>
              <span style={S.panelLabel}>BOUNTY REWARD</span>
              <span style={{ ...S.panelValue, color: '#ffd700' }}>
                {Number(selected.bountyReward).toLocaleString()}
              </span>
            </div>
            <div style={S.panelRow}>
              <span style={S.panelLabel}>CONTROLLED BY</span>
              <span style={{ ...S.panelValue, color: selected.ownerHandle ? '#00f5d4' : '#445566' }}>
                {selected.ownerHandle || 'UNCLAIMED'}
              </span>
            </div>

            {selected.lore && (
              <p style={S.lore}>{selected.lore}</p>
            )}

            <button style={S.sailBtn} onClick={handleSail}>
              ⚓ SET SAIL
            </button>
            <button style={S.closeBtn} onClick={() => setSelected(null)}>
              DISMISS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
