import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { CombatScene } from '../scenes/index.js';
import WantedPoster from '../components/WantedPoster.jsx';
import api from '../services/api.js';

// ────────────────────────────────────────────────────────────────────────
const mono = "'Courier New', Courier, monospace";

const BTN = {
  base: {
    width: '220px', height: '70px', fontFamily: mono,
    background: 'transparent', cursor: 'pointer',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '4px', transition: 'box-shadow 0.15s, background 0.15s',
    padding: 0, userSelect: 'none',
  },
};

function ActionButton({ label, icon, sub, color, disabled, onClick }) {
  const [hovered, setHovered] = useState(false);
  const style = {
    ...BTN.base,
    border:     `1px solid ${disabled ? '#112233' : color + 'aa'}`,
    color:      disabled ? '#223344' : color,
    opacity:    disabled ? 0.28 : 1,
    cursor:     disabled ? 'not-allowed' : 'pointer',
    background: hovered && !disabled ? color + '11' : 'transparent',
    boxShadow:  hovered && !disabled ? `0 0 28px ${color}44` : 'none',
  };
  return (
    <button
      style={style}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: '18px', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '4px' }}>{label}</span>
      <span style={{ fontSize: '11px', color: disabled ? '#223344' : '#667788', letterSpacing: '1px' }}>{sub}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
export default function CombatPage() {
  const { islandId } = useParams();
  const navigate     = useNavigate();
  const gameRef      = useRef(null);
  const phaserRef    = useRef(null);
  const actionLockRef = useRef(false);

  const [island,        setIsland]        = useState(null);
  const [combatState,   setCombatState]   = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,         setError]         = useState('');
  const [overlay,       setOverlay]       = useState(null); // null | 'victory' | 'defeat'
  const [log,           setLog]           = useState([]);

  const playerBounty = Number(localStorage.getItem('bounty') || 0);

  // ── Init Phaser then fetch data ────────────────────────────────────────
  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: gameRef.current,
      width:  window.innerWidth,
      height: window.innerHeight,
      transparent: false,
      backgroundColor: '#050a14',
      scene: [CombatScene],
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    });
    phaserRef.current = game;

    const onResize = () => game.scale.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);

    (async () => {
      try {
        const [islandRes, sailRes] = await Promise.all([
          api.get(`/api/islands/${islandId}`),
          api.post(`/api/islands/${islandId}/sail`),
        ]);
        const isl   = islandRes.data;
        const state = sailRes.data;
        setIsland(isl);
        setCombatState(state);
        // Emit initCombat so scene sets HP bars without triggering FX
        game.events.emit('initCombat', { ...state, islandName: isl.name });
        setLog([`You sail toward ${isl.name}. Steel your nerves.`]);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to start encounter.');
      }
    })();

    return () => {
      window.removeEventListener('resize', onResize);
      game.destroy(true);
    };
  }, [islandId]);

  // ── Action handler ─────────────────────────────────────────────────
  const takeTurn = useCallback(async (approach) => {
    if (actionLockRef.current) return;
    if (!combatState || combatState.status !== 'ONGOING') return;
    actionLockRef.current = true;
    setActionLoading(true);
    try {
      const res   = await api.post('/api/encounter/turn', { approach });
      const state = res.data;
      setCombatState(state);
      phaserRef.current?.events.emit('combatUpdate', { ...state, lastApproach: approach });

      const msgs = {
        ATTACK: (state.playerHealth < combatState.playerHealth)
          ? `⚔️ Swords clash! You deal damage — but take ${combatState.playerHealth - state.playerHealth} in return.`
          : `⚔️ Your cannons roar! Direct hit on the enemy!`,
        INTIMIDATE: (state.enemyHealth < combatState.enemyHealth)
          ? `👁️ Your reputation strikes fear — enemy morale crumbles!`
          : `👁️ They stand firm. Your name means nothing here.`,
        NEGOTIATE: state.status === 'PLAYER_WON'
          ? `🤝 They accept your terms. The island is yours.`
          : `🤝 Rejected! Enemy strikes for 25 damage!`,
      };
      setLog(prev => [msgs[approach] || approach, ...prev].slice(0, 3));

      if (state.status === 'PLAYER_WON') {
        const newBounty = playerBounty + (state.bountyChange ?? 0);
        localStorage.setItem('bounty', newBounty);
        localStorage.setItem('islandsConquered',
          Number(localStorage.getItem('islandsConquered') || 0) + 1);
        localStorage.setItem('wantedPoster', JSON.stringify({
          handle:           localStorage.getItem('handle'),
          bounty:           newBounty,
          tier:             localStorage.getItem('tier') || 'Drifter',
          islandsConquered: Number(localStorage.getItem('islandsConquered') || 0),
          seasonRank:       null,
        }));
        setTimeout(() => setOverlay('victory'), 800);
      }
      if (state.status === 'PLAYER_LOST') {
        setTimeout(() => setOverlay('defeat'), 800);
      }
    } catch (e) {
      setLog(prev => ['⚠️ Connection lost — try again.', ...prev].slice(0, 3));
    } finally {
      actionLockRef.current = false;
      setActionLoading(false);
    }
  }, [combatState, playerBounty]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isOngoing     = combatState?.status === 'ONGOING';
  const btnDisabled   = !isOngoing || actionLoading;
  const intimidateReq = 1000;
  const intimidateOk  = playerBounty >= intimidateReq;
  const intimidateSub = !intimidateOk
    ? `REQUIRES ${intimidateReq.toLocaleString()} BOUNTY`
    : playerBounty >= 10000
      ? '30 MORALE DMG  •  NO RETALIATION'
      : '10 MORALE DMG';
  const wantedData    = JSON.parse(localStorage.getItem('wantedPoster') || 'null');
  const round         = combatState?.round ?? 1;

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', fontFamily: mono }}>

      {/* Phaser fills entire screen */}
      <div ref={gameRef} style={{ position:'absolute', inset:0, zIndex:0 }} />

      {/* ── TOP BAR */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:'48px',
        background:'linear-gradient(to bottom, #050a14ff 60%, #050a1400)',
        display:'flex', alignItems:'center', padding:'0 24px', gap:'16px',
        zIndex:30,
      }}>
        <span style={{ color:'#00f5d4', fontWeight:700, fontSize:'14px', letterSpacing:'0.15em', flexShrink:0 }}>
          {island?.name || '—'}
        </span>
        <span style={{
          color:'#334455', fontSize:'12px', fontStyle:'italic',
          flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
        }}>
          {island?.lore || ''}
        </span>
        <span style={{ color:'#ffd700', fontSize:'13px', letterSpacing:'6px', flexShrink:0 }}>
          ROUND {round}
        </span>
        <button
          onClick={() => navigate('/world')}
          style={{
            background:'transparent', border:'1px solid #223344', color:'#334455',
            fontFamily: mono, fontSize:'12px', padding:'4px 14px',
            cursor:'pointer', flexShrink:0, letterSpacing:'2px',
            transition:'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={e => { e.target.style.borderColor='#ff4466'; e.target.style.color='#ff4466'; }}
          onMouseLeave={e => { e.target.style.borderColor='#223344'; e.target.style.color='#334455'; }}
        >
          BACK
        </button>
      </div>

      {/* ── COMBAT LOG */}
      <div style={{
        position:'absolute', bottom:'140px', left:'50%',
        transform:'translateX(-50%)',
        width:'600px', zIndex:30,
        display:'flex', flexDirection:'column', gap:'4px',
      }}>
        {log.map((line, i) => (
          <div key={i} style={{
            background:'#05080faa',
            borderLeft:`2px solid ${i === 0 ? '#00f5d466' : '#00f5d411'}`,
            padding:'8px 20px',
            color: i === 0 ? '#aabbcc' : '#445566',
            fontSize:'12px', fontFamily: mono,
            animation: i === 0 ? 'fadeIn 0.3s ease' : 'none',
            transition:'opacity 0.3s',
          }}>
            {line}
          </div>
        ))}
      </div>

      {/* ── PROCESSING DOTS */}
      {actionLoading && (
        <div style={{
          position:'absolute', bottom:'138px', left:'50%',
          transform:'translateX(-50%)',
          color:'#00f5d4', fontSize:'13px', letterSpacing:'4px',
          zIndex:31, animation:'pulse 0.6s ease-in-out infinite',
        }}>
          PROCESSING...
        </div>
      )}

      {/* ── ACTION BAR */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:'120px',
        background:'linear-gradient(to top, #050a14ff 70%, #050a1400)',
        display:'flex', alignItems:'center', justifyContent:'center',
        gap:'24px', zIndex:30, paddingBottom:'16px',
      }}>
        <ActionButton
          icon="⚔️" label="ATTACK" color="#00f5d4"
          sub="15–25 DMG  •  10–20 TAKEN"
          disabled={btnDisabled}
          onClick={() => takeTurn('ATTACK')}
        />
        <ActionButton
          icon="👁️" label="INTIMIDATE" color="#9b59b6"
          sub={intimidateSub}
          disabled={btnDisabled || !intimidateOk}
          onClick={() => takeTurn('INTIMIDATE')}
        />
        <ActionButton
          icon="🤝" label="NEGOTIATE" color="#ffd700"
          sub="40% CHANCE  •  HALF REWARD"
          disabled={btnDisabled}
          onClick={() => takeTurn('NEGOTIATE')}
        />
      </div>

      {/* ── ERROR */}
      {error && (
        <div style={{
          position:'absolute', inset:0, background:'#050a14dd',
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', zIndex:50, gap:'1.5rem',
        }}>
          <p style={{ color:'#ff4466', fontFamily:mono }}>{error}</p>
          <button
            style={{ background:'transparent', border:'1px solid #00f5d4', color:'#00f5d4', padding:'0.7rem 2rem', fontFamily:mono, cursor:'pointer' }}
            onClick={() => navigate('/world')}
          >
            ← BACK TO OCEAN
          </button>
        </div>
      )}

      {/* ── VICTORY OVERLAY */}
      {overlay === 'victory' && (
        <div style={{
          position:'absolute', inset:0, background:'#050a14ee',
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', zIndex:50, gap:'1.2rem',
        }}>
          <p style={{ fontFamily:mono, fontSize:'11px', color:'#334455', letterSpacing:'8px', margin:0 }}>ISLAND CLAIMED</p>
          <h1 style={{
            fontFamily:mono, fontSize:'72px', fontWeight:900,
            color:'#ffd700', margin:0, letterSpacing:'0.2em',
            textShadow:'0 0 50px #ffd70088',
          }}>VICTORY</h1>
          <p style={{ fontFamily:mono, fontSize:'24px', color:'#ffd700', margin:0 }}>
            +{(combatState?.bountyChange || 0).toLocaleString()} BOUNTY
          </p>
          <p style={{ fontFamily:mono, fontSize:'14px', color:'#00f5d4', fontStyle:'italic', margin:0 }}>
            {island?.name} is yours.
          </p>
          {wantedData && <WantedPoster player={wantedData} />}
          <button
            style={{ background:'transparent', border:'1px solid #00f5d4', color:'#00f5d4', padding:'0.8rem 2.5rem', fontFamily:mono, fontSize:'14px', cursor:'pointer', boxShadow:'0 0 24px #00f5d444', letterSpacing:'3px', marginTop:'8px' }}
            onClick={() => navigate('/world')}
          >
            ⚓ BACK TO OCEAN
          </button>
        </div>
      )}

      {/* ── DEFEAT OVERLAY */}
      {overlay === 'defeat' && (
        <div style={{
          position:'absolute', inset:0, background:'#0a0304ee',
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', zIndex:50, gap:'1.2rem',
        }}>
          <h1 style={{
            fontFamily:mono, fontSize:'72px', fontWeight:900,
            color:'#ff4466', margin:0, letterSpacing:'0.2em',
            textShadow:'0 0 50px #ff446688',
          }}>DEFEATED</h1>
          <p style={{ fontFamily:mono, fontSize:'20px', color:'#ff4466', margin:0 }}>
            {(combatState?.bountyChange || 0).toLocaleString()} BOUNTY LOST
          </p>
          <p style={{ fontFamily:mono, fontSize:'13px', color:'#445566', fontStyle:'italic', margin:0 }}>
            The ocean does not forgive weakness.
          </p>
          <div style={{ display:'flex', gap:'1rem', marginTop:'12px' }}>
            <button
              style={{ background:'transparent', border:'1px solid #ff4466', color:'#ff4466', padding:'0.8rem 2rem', fontFamily:mono, fontSize:'13px', cursor:'pointer', letterSpacing:'2px' }}
              onClick={() => window.location.reload()}
            >
              🔄 TRY AGAIN
            </button>
            <button
              style={{ background:'transparent', border:'1px solid #00f5d4', color:'#00f5d4', padding:'0.8rem 2rem', fontFamily:mono, fontSize:'13px', cursor:'pointer', letterSpacing:'2px' }}
              onClick={() => navigate('/world')}
            >
              ← BACK TO OCEAN
            </button>
          </div>
        </div>
      )}

      {/* Keyframe CSS for fadeIn and pulse */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
      `}</style>
    </div>
  );
}
