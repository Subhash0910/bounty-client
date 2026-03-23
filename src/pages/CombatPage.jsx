import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { CombatScene } from '../scenes/index.js';
import WantedPoster from '../components/WantedPoster.jsx';
import api from '../services/api.js';

// ── Styles ─────────────────────────────────────────────────────────────
const S = {
  page: {
    width: '100vw', height: '100vh',
    background: '#0a0a0f', overflow: 'hidden',
    position: 'relative',
    fontFamily: "'Courier New', Courier, monospace",
    display: 'flex', flexDirection: 'column',
  },
  flavorBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    padding: '10px 24px',
    background: '#0a0a0fcc',
    borderBottom: '1px solid #00f5d411',
    zIndex: 20,
    display: 'flex', alignItems: 'center', gap: '1rem',
  },
  flavorName: { color: '#00f5d4', fontWeight: '700', fontSize: '0.9rem', letterSpacing: '0.15em' },
  flavorLore: { color: '#445566', fontSize: '0.75rem', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  canvas: { width: '100%', flex: 1, position: 'absolute', top: 0, left: 0, bottom: '130px' },
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '130px',
    background: '#0a0a0fee',
    borderTop: '1px solid #00f5d411',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '1.5rem',
    padding: '0 2rem',
    zIndex: 20,
  },
  actionBtn: (disabled, color = '#00f5d4') => ({
    background: 'transparent',
    border: `1px solid ${disabled ? '#223344' : color + '88'}`,
    color: disabled ? '#223344' : color,
    padding: '0.7rem 1.8rem',
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: '700', fontSize: '0.9rem',
    letterSpacing: '0.1em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    minWidth: '160px',
    transition: 'box-shadow 0.2s',
    boxShadow: disabled ? 'none' : `0 0 12px ${color}33`,
  }),
  btnSub: { display: 'block', fontSize: '0.65rem', fontWeight: '400', color: '#334455', marginTop: '4px', letterSpacing: '0.05em' },
  overlay: {
    position: 'absolute', inset: 0,
    background: '#0a0a0fdd',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 50,
    gap: '1.5rem',
  },
  overlayTitle: (win) => ({
    fontSize: '3rem', fontWeight: '900',
    letterSpacing: '0.3em',
    color: win ? '#ffd700' : '#ff4466',
    textShadow: `0 0 40px ${win ? '#ffd70088' : '#ff446688'}`,
  }),
  overlayBtn: (color = '#00f5d4') => ({
    background: 'transparent',
    border: `1px solid ${color}`,
    color, padding: '0.7rem 2rem',
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: '700', fontSize: '0.9rem',
    letterSpacing: '0.1em', cursor: 'pointer',
    boxShadow: `0 0 20px ${color}44`,
  }),
  deltaText: (win) => ({
    fontSize: '1.2rem',
    color: win ? '#ffd700' : '#ff4466',
    letterSpacing: '0.1em',
  }),
  loadingText: {
    position: 'absolute', bottom: '145px', left: '50%',
    transform: 'translateX(-50%)',
    color: '#00f5d488', fontSize: '0.8rem',
    letterSpacing: '0.2em', zIndex: 25,
  },
};

// ── Component ─────────────────────────────────────────────────────────────
export default function CombatPage() {
  const { islandId } = useParams();
  const navigate     = useNavigate();
  const gameRef      = useRef(null);
  const phaserRef    = useRef(null);

  const [island,      setIsland]      = useState(null);
  const [combatState, setCombatState] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,       setError]       = useState('');
  const [playerBounty, setPlayerBounty] = useState(Number(localStorage.getItem('bounty') || 0));

  // ── Init Phaser + start encounter ───────────────────────────────────────────
  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: gameRef.current,
      width: window.innerWidth,
      height: window.innerHeight - 130,
      transparent: true,
      backgroundColor: '#0a0a0f',
      scene: [CombatScene],
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    });
    phaserRef.current = game;

    const onResize = () => game.scale.resize(window.innerWidth, window.innerHeight - 130);
    window.addEventListener('resize', onResize);

    // Start encounter
    (async () => {
      try {
        const [islandRes, sailRes] = await Promise.all([
          api.get(`/api/islands/${islandId}`),
          api.post(`/api/islands/${islandId}/sail`),
        ]);
        setIsland(islandRes.data);
        const state = sailRes.data;
        setCombatState(state);
        game.events.emit('updateCombat', state);
        game.events.emit('addLog', `You sail toward ${islandRes.data.name}. Combat begins!`);
      } catch (e) {
        setError(e.response?.data || 'Failed to start encounter.');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      window.removeEventListener('resize', onResize);
      game.destroy(true);
    };
  }, [islandId]);

  // ── Action handler ─────────────────────────────────────────────────────
  const takeTurn = useCallback(async (approach) => {
    if (actionLoading || !combatState || combatState.status !== 'ONGOING') return;
    setActionLoading(true);
    const game = phaserRef.current;
    try {
      const res = await api.post('/api/encounter/turn', { approach });
      const state = res.data;
      setCombatState(state);
      game?.events.emit('updateCombat', state);

      const logMsgs = {
        ATTACK:     `Round ${state.round - 1}: You ATTACK — swords clash in the dark.`,
        INTIMIDATE: `Round ${state.round - 1}: You INTIMIDATE — the enemy wavers.`,
        NEGOTIATE:  state.status === 'PLAYER_WON'
          ? 'Negotiation succeeds — enemy stands down!'
          : `Round ${state.round - 1}: Negotiation fails — enemy strikes hard!`,
      };
      game?.events.emit('addLog', logMsgs[approach] || approach);

      // On WIN — save wanted poster data
      if (state.status === 'PLAYER_WON') {
        const newBounty = playerBounty + (state.bountyChange ?? 0);
        setPlayerBounty(newBounty);
        localStorage.setItem('bounty', newBounty);
        localStorage.setItem('wantedPoster', JSON.stringify({
          handle:          localStorage.getItem('handle'),
          bounty:          newBounty,
          tier:            localStorage.getItem('tier') || 'Drifter',
          islandsConquered: Number(localStorage.getItem('islandsConquered') || 0) + 1,
          seasonRank:      null,
        }));
        localStorage.setItem('islandsConquered',
          Number(localStorage.getItem('islandsConquered') || 0) + 1);
      }
    } catch (e) {
      game?.events.emit('addLog', 'Server error — try again.');
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, combatState, playerBounty]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isOngoing   = combatState?.status === 'ONGOING';
  const isWon       = combatState?.status === 'PLAYER_WON';
  const isLost      = combatState?.status === 'PLAYER_LOST';
  const btnDisabled = !isOngoing || actionLoading || loading;
  const intimidateReq = 1000;
  const intimidateOk  = playerBounty >= intimidateReq;
  const wantedData    = JSON.parse(localStorage.getItem('wantedPoster') || 'null');

  return (
    <div style={S.page}>
      {/* Flavor bar */}
      <div style={S.flavorBar}>
        <span style={S.flavorName}>{island?.name || 'UNKNOWN ISLAND'}</span>
        <span style={S.flavorLore}>{island?.lore || ''}</span>
        <span style={{ color: '#334455', fontSize: '0.75rem' }}>
          DIFF {'★'.repeat(island?.difficulty || 1)}
        </span>
      </div>

      {/* Phaser canvas */}
      <div ref={gameRef} style={S.canvas} />

      {/* Loading/action indicator */}
      {actionLoading && <span style={S.loadingText}>PROCESSING...</span>}

      {/* Action buttons */}
      <div style={S.actionBar}>
        <button
          style={S.actionBtn(btnDisabled)}
          disabled={btnDisabled}
          onClick={() => takeTurn('ATTACK')}
        >
          ⚔️ ATTACK
          <span style={S.btnSub}>15–25 dmg &bull; 10–20 taken</span>
        </button>

        <button
          style={S.actionBtn(btnDisabled || !intimidateOk, '#9b59b6')}
          disabled={btnDisabled || !intimidateOk}
          onClick={() => takeTurn('INTIMIDATE')}
        >
          👁️ INTIMIDATE
          <span style={S.btnSub}>
            {intimidateOk
              ? playerBounty > 10000 ? '30 morale dmg' : '10 morale dmg'
              : `Requires ${intimidateReq.toLocaleString()} bounty`}
          </span>
        </button>

        <button
          style={S.actionBtn(btnDisabled, '#ffd700')}
          disabled={btnDisabled}
          onClick={() => takeTurn('NEGOTIATE')}
        >
          🤝 NEGOTIATE
          <span style={S.btnSub}>40% win at half reward</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ ...S.overlay, background: '#0a0a0fcc' }}>
          <p style={{ color: '#ff4466' }}>{error}</p>
          <button style={S.overlayBtn('#00f5d4')} onClick={() => navigate('/world')}>
            ← BACK TO OCEAN
          </button>
        </div>
      )}

      {/* VICTORY overlay */}
      {isWon && (
        <div style={S.overlay}>
          <h1 style={S.overlayTitle(true)}>VICTORY</h1>
          <p style={S.deltaText(true)}>
            +{(combatState.bountyChange || 0).toLocaleString()} BOUNTY EARNED
          </p>
          <p style={{ color: '#00f5d4', fontSize: '0.85rem', letterSpacing: '0.1em' }}>
            {island?.name} is now yours.
          </p>
          {wantedData && <WantedPoster player={wantedData} />}
          <button style={S.overlayBtn('#00f5d4')} onClick={() => navigate('/world')}>
            ⚓ BACK TO OCEAN
          </button>
        </div>
      )}

      {/* DEFEAT overlay */}
      {isLost && (
        <div style={S.overlay}>
          <h1 style={S.overlayTitle(false)}>DEFEATED</h1>
          <p style={S.deltaText(false)}>
            {(combatState.bountyChange || 0).toLocaleString()} BOUNTY LOST
          </p>
          <p style={{ color: '#556677', fontSize: '0.85rem', letterSpacing: '0.1em' }}>
            The ocean does not forgive weakness.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              style={S.overlayBtn('#ff4466')}
              onClick={() => window.location.reload()}
            >
              🔄 TRY AGAIN
            </button>
            <button style={S.overlayBtn('#00f5d4')} onClick={() => navigate('/world')}>
              ← BACK TO OCEAN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
