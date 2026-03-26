import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { CombatScene } from '../scenes/index.js';
import WantedPoster from '../components/WantedPoster.jsx';
import api from '../services/api.js';

const MONO = "'Courier New', Courier, monospace";

const TYPE_COLORS = {
  DRIFTER: '#4a9eff', MERCHANT: '#ffd700', WARLORD: '#ff4444', VOID: '#9b59b6',
};

const EFFECT_META = {
  BLEEDING:  { color: '#ff4466', icon: '🩸', tip: '-5 HP per round' },
  ANCHORED:  { color: '#ffaa00', icon: '⚓', tip: 'Cannot evade or board' },
  RATTLED:   { color: '#ff8800', icon: '💥', tip: '-5 to all damage' },
  FORTIFIED: { color: '#00f5d4', icon: '🛡', tip: 'Absorb 8 next damage' },
};

const STANCE_META = {
  AGGRESSIVE: { color: '#ff4466', icon: '⚔️',  label: 'AGGRESSIVE', tip: 'High damage, may RATTLE you' },
  DEFENSIVE:  { color: '#4a9eff', icon: '🛡',  label: 'DEFENSIVE',  tip: 'Low damage, harder to damage' },
  DESPERATE:  { color: '#ff8800', icon: '💀',  label: 'DESPERATE',  tip: 'Extreme damage, may ANCHOR you' },
};

// ─── Reusable helpers ────────────────────────────────────────────────────────
function EffectBadge({ effect }) {
  const m = EFFECT_META[effect];
  if (!m) return null;
  return (
    <span title={m.tip} style={{
      fontSize:'9px', letterSpacing:'2px', padding:'2px 7px',
      border:`1px solid ${m.color}55`,
      color: m.color, background:`${m.color}14`,
      borderRadius:'2px', whiteSpace:'nowrap',
    }}>{m.icon} {effect}</span>
  );
}

function HealthBar({ label, hp, maxHp = 100, color, side = 'left', effects = [] }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const danger  = pct < 30;
  const warning = pct < 55;
  const barColor = danger ? '#ff4466' : warning ? '#ffaa00' : color;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px', width:'240px' }}>
      <div style={{
        display:'flex',
        justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
        alignItems:'center', gap:'8px', flexWrap:'wrap',
      }}>
        <span style={{ color: danger ? '#ff6688' : color, fontSize:'10px', letterSpacing:'3px', fontWeight:700 }}>
          {side === 'left' ? label : `${hp} / ${maxHp}`}
        </span>
        <span style={{ color: danger ? '#ff4466' : '#7aabb5', fontSize:'10px', letterSpacing:'2px' }}>
          {side === 'left' ? `${hp} / ${maxHp}` : label}
        </span>
      </div>
      <div style={{ height:'5px', background:'rgba(0,0,0,0.6)', border:`1px solid ${barColor}33`, position:'relative', overflow:'hidden' }}>
        <div style={{
          position:'absolute', left:0, top:0, bottom:0,
          width:`${pct}%`,
          background: danger
            ? 'linear-gradient(90deg,#ff2244,#ff4466)'
            : `linear-gradient(90deg,${barColor}bb,${barColor})`,
          boxShadow:`0 0 10px ${barColor}88`,
          transition:'width 0.35s ease',
        }} />
        {danger && (
          <div style={{ position:'absolute',left:0,top:0,right:0,bottom:0, background:'rgba(255,68,102,0.12)', animation:'hpPulse 0.8s ease-in-out infinite' }} />
        )}
      </div>
      {effects.length > 0 && (
        <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', justifyContent: side==='left'?'flex-start':'flex-end' }}>
          {effects.map(ef => <EffectBadge key={ef} effect={ef} />)}
        </div>
      )}
    </div>
  );
}

function TidePressureBar({ value, max = 10 }) {
  const pct = (value / max) * 100;
  const danger = value >= 8;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', width:'120px' }}>
      <span style={{ fontSize:'8px', letterSpacing:'3px', color: danger ? '#ff8800' : '#3a5060' }}>TIDE PRESSURE</span>
      <div style={{ width:'100%', height:'4px', background:'rgba(0,0,0,0.5)', border:`1px solid ${danger?'#ff880033':'#1a3040'}`, position:'relative', overflow:'hidden' }}>
        <div style={{
          position:'absolute', left:0, top:0, bottom:0,
          width:`${pct}%`,
          background: danger ? 'linear-gradient(90deg,#ff6600,#ff8800)' : 'linear-gradient(90deg,#1a6a8a,#2a9ab0)',
          boxShadow: danger ? '0 0 8px #ff880099' : 'none',
          transition:'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize:'8px', color: danger ? '#ff8800' : '#2a4a5a', letterSpacing:'1px' }}>{value} / {max}</span>
    </div>
  );
}

function StanceBadge({ stance }) {
  const m = STANCE_META[stance];
  if (!m) return null;
  return (
    <div title={m.tip} style={{
      display:'flex', alignItems:'center', gap:'5px',
      padding:'3px 10px', border:`1px solid ${m.color}44`,
      background:`${m.color}0e`, borderRadius:'2px',
    }}>
      <span style={{ fontSize:'10px' }}>{m.icon}</span>
      <span style={{ fontSize:'9px', color: m.color, letterSpacing:'3px', fontWeight:700 }}>{m.label}</span>
    </div>
  );
}

function RollBadge({ roll, label }) {
  if (!roll) return null;
  const high = roll >= 22;
  const low  = roll <= 12;
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'3px 8px', border:`1px solid ${high?'#ffd70055':low?'#ff446655':'#1a3a4a'}`,
      background: high?'rgba(255,215,0,0.07)':low?'rgba(255,68,102,0.07)':'rgba(0,6,14,0.5)',
      minWidth:'44px',
    }}>
      <span style={{ fontSize:'8px', color:'#3a5060', letterSpacing:'2px' }}>{label}</span>
      <span style={{ fontSize:'16px', fontWeight:900, color: high?'#ffd700':low?'#ff4466':'#aac8d8', lineHeight:1.2 }}>{roll}</span>
    </div>
  );
}

function StatRow({ label, value, color = '#7aabb5' }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid rgba(0,30,50,0.4)' }}>
      <span style={{ fontSize:'9px', color:'#3a5060', letterSpacing:'2px' }}>{label}</span>
      <span style={{ fontSize:'11px', color, fontWeight:700, letterSpacing:'1px' }}>{value}</span>
    </div>
  );
}

function LogLine({ text, index }) {
  const colors  = ['#b0d0e0', '#6a8a9a', '#3a5060', '#2a3a48', '#1e2a38'];
  const borders = ['#00f5d488', '#00f5d433', '#00f5d415', 'transparent', 'transparent'];
  return (
    <div style={{
      background: index===0 ? 'rgba(0,10,22,0.92)' : 'rgba(0,6,14,0.6)',
      backdropFilter:'blur(8px)',
      borderLeft:`3px solid ${borders[index]||'transparent'}`,
      padding:'7px 14px',
      color: colors[index] || '#1a2a38',
      fontSize: index===0 ? '12px' : '10.5px',
      letterSpacing:'0.3px', lineHeight:'1.6',
      animation: index===0 ? 'logSlideIn 0.25s ease' : 'none',
    }}>{text}</div>
  );
}

function ActionBtn({ icon, label, sub, color, disabled, onClick, hotkey, tag }) {
  const [hov, setHov] = useState(false);
  const active = hov && !disabled;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={`[${hotkey}] ${label}: ${sub}`}
      style={{
        width:'170px', height:'96px', position:'relative',
        background: active
          ? `linear-gradient(160deg,${color}22,${color}0a)`
          : disabled ? 'rgba(2,6,14,0.4)' : 'rgba(4,9,22,0.88)',
        border:`1px solid ${disabled?'rgba(255,255,255,0.04)':active?color:color+'44'}`,
        borderRadius:'2px', overflow:'hidden',
        boxShadow: active ? `0 0 40px ${color}55,inset 0 1px 0 ${color}33` : `0 0 10px ${color}18`,
        color: disabled ? 'rgba(255,255,255,0.1)' : color,
        fontFamily:MONO, cursor:disabled?'not-allowed':'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:'2px', padding:'0',
        transition:'all 0.14s ease',
        transform: active ? 'translateY(-3px) scale(1.02)' : 'none',
        opacity: disabled ? 0.28 : 1,
        backdropFilter:'blur(10px)', userSelect:'none',
      }}
    >
      <div style={{ position:'absolute',top:0,left:0,right:0,height:'1px',background:active?`linear-gradient(90deg,transparent,${color}aa,transparent)`:'transparent',transition:'background 0.14s' }} />
      <div style={{ position:'absolute',top:'5px',right:'7px',color:disabled?'rgba(255,255,255,0.05)':color+'77',fontSize:'8px',letterSpacing:'1px' }}>[{hotkey}]</div>
      {tag && <div style={{ position:'absolute',top:'5px',left:'7px',fontSize:'7px',color:color+'99',letterSpacing:'2px',background:`${color}18`,padding:'1px 5px',borderRadius:'1px' }}>{tag}</div>}
      <span style={{ fontSize:'20px',lineHeight:1,filter:disabled?'grayscale(1) opacity(0.3)':'drop-shadow(0 0 5px currentColor)' }}>{icon}</span>
      <span style={{ fontWeight:900,fontSize:'12px',letterSpacing:'4px',marginTop:'2px' }}>{label}</span>
      <span style={{ fontSize:'8px',color:disabled?'rgba(255,255,255,0.06)':'#5a7a8a',letterSpacing:'0.6px',textAlign:'center',padding:'0 8px',lineHeight:1.4 }}>{sub}</span>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CombatPage() {
  const { islandId } = useParams();
  const navigate     = useNavigate();
  const gameRef      = useRef(null);
  const phaserRef    = useRef(null);
  const lockRef      = useRef(false);

  const [island,  setIsland]  = useState(null);
  const [combat,  setCombat]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [overlay, setOverlay] = useState(null);
  const [log,     setLog]     = useState([]);
  const [shake,   setShake]   = useState(false);

  // Live match stats
  const statsRef = useRef({ dmgDealt: 0, dmgTaken: 0, crits: 0, rounds: 0 });
  const [stats,   setStats]   = useState({ dmgDealt: 0, dmgTaken: 0, crits: 0, rounds: 0 });

  const bounty   = Number(localStorage.getItem('bounty') || 0);
  const poster   = JSON.parse(localStorage.getItem('wantedPoster') || 'null');

  // ── Boot Phaser + sail ──────────────────────────────────────────────────
  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: gameRef.current,
      width: window.innerWidth, height: window.innerHeight,
      transparent: false, backgroundColor: '#010408',
      scene: [CombatScene],
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
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
        setLog([
          `⚓ You sail toward ${iRes.data.name}. The air tastes of iron and salt.`,
          `🌊 Their ${sRes.data.enemyStance?.toLowerCase() || 'unknown'} stance shows. Choose wisely.`,
        ]);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to start encounter. Sail from the world map.');
      }
    })();
    return () => { window.removeEventListener('resize', onResize); game.destroy(true); };
  }, [islandId]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (!combat || combat.status !== 'ONGOING' || loading) return;
      if (e.key === '1') takeTurn('ATTACK');
      if (e.key === '2') takeTurn('BOARD');
      if (e.key === '3') takeTurn('EVADE');
      if (e.key === '4') takeTurn('SABOTAGE');
      if (e.key === '5') takeTurn('NEGOTIATE');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [combat, loading]);

  // ── Turn handler ───────────────────────────────────────────────────────
  const takeTurn = useCallback(async (approach) => {
    if (lockRef.current || !combat || combat.status !== 'ONGOING') return;
    lockRef.current = true; setLoading(true);
    try {
      const prevPHP = combat.playerHealth;
      const prevEHP = combat.enemyHealth;
      const res   = await api.post('/api/encounter/turn', { approach });
      const state = res.data;
      setCombat(state);
      phaserRef.current?.events.emit('combatUpdate', { ...state, lastApproach: approach });

      const dmgDealt = Math.max(0, prevEHP  - state.enemyHealth);
      const dmgTaken = Math.max(0, prevPHP  - state.playerHealth);
      const isCrit   = state.lastPlayerRoll >= 24;

      // Update live stats
      statsRef.current = {
        dmgDealt: statsRef.current.dmgDealt + dmgDealt,
        dmgTaken: statsRef.current.dmgTaken + dmgTaken,
        crits:    statsRef.current.crits    + (isCrit ? 1 : 0),
        rounds:   statsRef.current.rounds   + 1,
      };
      setStats({ ...statsRef.current });

      // Screen shake when player takes damage
      if (dmgTaken > 0 && state.status === 'ONGOING') {
        setShake(true); setTimeout(() => setShake(false), 440);
      }

      // Build log from server event + local context
      const msgs = [];
      if (state.lastEventLine) msgs.push(state.lastEventLine);
      if (state.lastEnemyRoll > 0 && state.status === 'ONGOING')
        msgs.push(`↩  Enemy retaliates — ${state.lastEnemyRoll} damage.`);

      // Tension messages
      const ph = state.playerHealth, eh = state.enemyHealth;
      if (ph <= 20)                              msgs.push('⚠️  CRITICAL — one more hit ends you.');
      else if (ph <= 40)                         msgs.push('🩸 You\'re badly wounded. Stay sharp.');
      if (eh <= 20 && state.status === 'ONGOING') msgs.push('💀 They\'re near the end. Finish them.');
      if (state.tidePressure >= 8)               msgs.push(`🌊 TIDE PRESSURE CRITICAL — surge imminent!`);
      if (state.round > 1 && state.round % 4 === 0 && state.status === 'ONGOING')
        msgs.push(`⏱  Round ${state.round}. The storm is closing in.`);

      setLog(prev => [...msgs, ...prev].slice(0, 6));

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
        setTimeout(() => setOverlay('victory'), 850);
      }
      if (state.status === 'PLAYER_LOST') setTimeout(() => setOverlay('defeat'), 850);
    } catch {
      setLog(prev => ['⚠️  Signal lost. Try again.', ...prev].slice(0, 6));
    } finally {
      lockRef.current = false; setLoading(false);
    }
  }, [combat, bounty]);

  const ongoing      = combat?.status === 'ONGOING';
  const btnOff       = !ongoing || loading;
  const canSabotage  = bounty >= 500;
  const isAnchored   = combat?.anchored || (combat?.playerEffects || []).includes('ANCHORED');
  const canBoard     = !isAnchored;
  const canEvade     = !isAnchored;
  const round        = combat?.round ?? 1;
  const typeColor    = island ? (TYPE_COLORS[island.type] || '#00f5d4') : '#00f5d4';
  const playerEffects = combat?.playerEffects || [];
  const enemyEffects  = combat?.enemyEffects  || [];
  const stance        = combat?.enemyStance   || 'AGGRESSIVE';

  useEffect(() => {
    if (island && phaserRef.current)
      phaserRef.current.events.emit('setEnemyLabel', island.name.toUpperCase().slice(0, 14));
  }, [island]);

  return (
    <div style={{
      width:'100vw', height:'100vh', overflow:'hidden', position:'relative',
      fontFamily:MONO, background:'#010408',
      animation: shake ? 'screenShake 0.44s ease' : 'none',
    }}>
      <div ref={gameRef} style={{ position:'absolute', inset:0, zIndex:0 }} />

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:'64px',
        background:'linear-gradient(180deg,rgba(1,3,10,0.98) 0%,rgba(1,3,10,0.80) 70%,transparent 100%)',
        display:'flex', alignItems:'center', padding:'0 24px', gap:'16px', zIndex:30,
        borderBottom:`1px solid ${typeColor}15`,
      }}>
        {/* Island info */}
        <div style={{ flex:1, overflow:'hidden', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'5px',height:'5px',borderRadius:'50%',background:typeColor,boxShadow:`0 0 7px ${typeColor}`,flexShrink:0 }} />
            <span style={{ color:'#ddeeff',fontWeight:900,fontSize:'13px',letterSpacing:'2px',whiteSpace:'nowrap' }}>
              {island?.name || '——'}
            </span>
            {island?.type && <span style={{ color:typeColor,fontSize:'8px',letterSpacing:'4px',opacity:0.8 }}>{island.type}</span>}
            {island?.difficulty && <span style={{ color:'#3a5060',fontSize:'8px',letterSpacing:'3px' }}>{'★'.repeat(island.difficulty)}</span>}
          </div>
          <div style={{ color:'#5a7a8a',fontSize:'10px',fontStyle:'italic',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:'2px',paddingLeft:'13px' }}>
            {island?.lore || ''}
          </div>
        </div>

        {/* Round / pressure center */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', flexShrink:0 }}>
          <div style={{ color:'#ffd700',fontSize:'11px',letterSpacing:'8px',fontWeight:900,textShadow:'0 0 12px #ffd70055' }}>ROUND {round}</div>
          {combat && <TidePressureBar value={combat.tidePressure ?? 0} max={10} />}
        </div>

        {/* Stance + retreat */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
          {combat && <StanceBadge stance={stance} />}
          <button
            onClick={() => navigate('/world')}
            style={{ background:'transparent',border:'1px solid rgba(255,68,102,0.25)',color:'#aa3355',fontFamily:MONO,fontSize:'10px',padding:'5px 14px',cursor:'pointer',flexShrink:0,letterSpacing:'3px',transition:'all 0.16s' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor='#ff4466'; e.currentTarget.style.color='#ff4466'; e.currentTarget.style.boxShadow='0 0 14px #ff446633'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,68,102,0.25)'; e.currentTarget.style.color='#aa3355'; e.currentTarget.style.boxShadow='none'; }}
          >← RETREAT</button>
        </div>
      </div>

      {/* ══ LEFT SIDEBAR — Live Stats ════════════════════════════════════════ */}
      <div style={{
        position:'absolute', top:'80px', left:'16px',
        width:'140px', zIndex:30,
        background:'rgba(0,4,12,0.88)', backdropFilter:'blur(10px)',
        border:'1px solid rgba(0,245,212,0.07)',
        padding:'12px 14px',
      }}>
        <div style={{ color:'#2a6070', fontSize:'8px', letterSpacing:'4px', marginBottom:'8px' }}>SESSION</div>
        <StatRow label="DMG DEALT"  value={stats.dmgDealt} color="#00f5d4" />
        <StatRow label="DMG TAKEN"  value={stats.dmgTaken} color="#ff4466" />
        <StatRow label="CRITS"      value={stats.crits}    color="#ffd700" />
        <StatRow label="ROUNDS"     value={stats.rounds}   color="#7aabb5" />
        {playerEffects.length > 0 && (
          <>
            <div style={{ color:'#2a4a5a', fontSize:'7px', letterSpacing:'3px', margin:'10px 0 5px' }}>YOUR STATUS</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              {playerEffects.map(ef => <EffectBadge key={ef} effect={ef} />)}
            </div>
          </>
        )}
      </div>

      {/* ══ RIGHT SIDEBAR — Roll Dice ════════════════════════════════════════ */}
      {combat && (combat.lastPlayerRoll > 0 || combat.lastEnemyRoll > 0) && (
        <div style={{
          position:'absolute', top:'80px', right:'16px',
          width:'110px', zIndex:30,
          background:'rgba(0,4,12,0.88)', backdropFilter:'blur(10px)',
          border:'1px solid rgba(0,245,212,0.07)',
          padding:'12px 10px',
          display:'flex', flexDirection:'column', alignItems:'center', gap:'10px',
        }}>
          <div style={{ color:'#2a6070', fontSize:'8px', letterSpacing:'4px' }}>LAST ROLL</div>
          <RollBadge roll={combat.lastPlayerRoll} label="YOURS" />
          <div style={{ color:'#1a2a38', fontSize:'8px', letterSpacing:'2px' }}>vs</div>
          <RollBadge roll={combat.lastEnemyRoll}  label="THEIRS" />
          {enemyEffects.length > 0 && (
            <>
              <div style={{ color:'#2a3a4a', fontSize:'7px', letterSpacing:'2px', marginTop:'4px' }}>ENEMY STATUS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px', alignItems:'center' }}>
                {enemyEffects.map(ef => <EffectBadge key={ef} effect={ef} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ HP BARS ══════════════════════════════════════════════════════════ */}
      {combat && (
        <div style={{
          position:'absolute', bottom:'160px', left:'50%', transform:'translateX(-50%)',
          width:'560px', zIndex:30,
          display:'flex', justifyContent:'space-between', alignItems:'flex-start',
          padding:'0 4px', pointerEvents:'none',
        }}>
          <HealthBar label="YOU" hp={combat.playerHealth} maxHp={100} color="#00f5d4" side="left" effects={playerEffects} />
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', paddingTop:'4px' }}>
            <span style={{ color:'#1a2a38', fontSize:'8px', letterSpacing:'3px' }}>VS</span>
          </div>
          <HealthBar
            label={island?.name?.toUpperCase().slice(0, 11) || 'ENEMY'}
            hp={combat.enemyHealth} maxHp={100}
            color={typeColor} side="right" effects={enemyEffects}
          />
        </div>
      )}

      {/* ══ COMBAT LOG ═══════════════════════════════════════════════════════ */}
      <div style={{
        position:'absolute', bottom:'270px', left:'50%', transform:'translateX(-50%)',
        width:'560px', zIndex:30, display:'flex', flexDirection:'column', gap:'2px',
        pointerEvents:'none',
      }}>
        {log.map((line, i) => <LogLine key={`${line}-${i}`} text={line} index={i} />)}
      </div>

      {/* ══ PROCESSING ═══════════════════════════════════════════════════════ */}
      {loading && (
        <div style={{
          position:'absolute', bottom:'268px', left:'50%', transform:'translateX(-50%)',
          color:'#00f5d4', fontSize:'9px', letterSpacing:'6px', zIndex:31,
          animation:'blink 0.5s ease-in-out infinite', whiteSpace:'nowrap',
          textShadow:'0 0 8px #00f5d4',
        }}>▸ ▸ ▸  PROCESSING TURN</div>
      )}

      {/* ══ ACTION BAR ═══════════════════════════════════════════════════════ */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:'148px',
        background:'linear-gradient(0deg,rgba(1,3,10,0.99) 0%,rgba(1,3,10,0.90) 55%,transparent 100%)',
        display:'flex', alignItems:'center', justifyContent:'center',
        gap:'10px', zIndex:30, paddingBottom:'12px',
        borderTop:`1px solid ${typeColor}0a`,
      }}>
        <ActionBtn
          icon="💣" label="ATTACK" hotkey="1" color="#00f5d4"
          sub="14–25 DMG · crit on 24+"
          disabled={btnOff}
          onClick={() => takeTurn('ATTACK')}
        />
        <div style={{ width:'1px',height:'50px',background:'rgba(0,245,212,0.06)' }} />
        <ActionBtn
          icon="⚔️" label="BOARD" hotkey="2" color="#ff8844"
          sub="15–30 DMG · 8–15 taken"
          tag={isAnchored ? 'LOCKED' : 'RISKY'}
          disabled={btnOff || !canBoard}
          onClick={() => takeTurn('BOARD')}
        />
        <div style={{ width:'1px',height:'50px',background:'rgba(0,245,212,0.06)' }} />
        <ActionBtn
          icon="💨" label="EVADE" hotkey="3" color="#4a9eff"
          sub="Dodge next hit · may ANCHOR"
          tag={isAnchored ? 'LOCKED' : undefined}
          disabled={btnOff || !canEvade}
          onClick={() => takeTurn('EVADE')}
        />
        <div style={{ width:'1px',height:'50px',background:'rgba(0,245,212,0.06)' }} />
        <ActionBtn
          icon="🔥" label="SABOTAGE" hotkey="4" color="#9b59b6"
          sub={canSabotage ? 'RATTLE + 5–12 DMG' : 'NEED 500 BOUNTY'}
          tag={canSabotage ? 'TACTICAL' : 'LOCKED'}
          disabled={btnOff || !canSabotage}
          onClick={() => takeTurn('SABOTAGE')}
        />
        <div style={{ width:'1px',height:'50px',background:'rgba(0,245,212,0.06)' }} />
        <ActionBtn
          icon="🤝" label="NEGOTIATE" hotkey="5" color="#ffd700"
          sub="35% · HALF reward"
          disabled={btnOff}
          onClick={() => takeTurn('NEGOTIATE')}
        />
      </div>

      {/* ══ ERROR ════════════════════════════════════════════════════════════ */}
      {error && (
        <div style={{ position:'absolute',inset:0,background:'rgba(1,3,10,0.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:50,gap:'1.5rem' }}>
          <div style={{ color:'#ff4466',fontFamily:MONO,letterSpacing:'2px',fontSize:'12px',textAlign:'center',maxWidth:'400px',lineHeight:2 }}>{error}</div>
          <button
            style={{ background:'transparent',border:'1px solid #00f5d4',color:'#00f5d4',padding:'0.7rem 2rem',fontFamily:MONO,cursor:'pointer',letterSpacing:'3px',fontSize:'11px',transition:'all 0.16s' }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='0 0 24px #00f5d455'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
            onClick={()=>navigate('/world')}
          >← BACK TO OCEAN</button>
        </div>
      )}

      {/* ══ VICTORY ══════════════════════════════════════════════════════════ */}
      {overlay === 'victory' && (
        <div style={{
          position:'absolute',inset:0,
          background:'radial-gradient(ellipse at 50% 40%,rgba(0,40,30,0.97) 0%,rgba(1,4,10,0.99) 65%)',
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          zIndex:50,gap:'8px',animation:'fadeOverlay 0.65s ease',
        }}>
          <div style={{ position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.14) 2px,rgba(0,0,0,0.14) 4px)',pointerEvents:'none',opacity:0.4 }} />
          <div style={{ width:'180px',height:'1px',background:'linear-gradient(90deg,transparent,#ffd700,transparent)' }} />
          <p style={{ fontFamily:MONO,fontSize:'9px',color:'#4a6a3a',letterSpacing:'12px',margin:0 }}>ISLAND CLAIMED</p>
          <h1 style={{ fontFamily:MONO,fontSize:'66px',fontWeight:900,color:'#ffd700',margin:'4px 0',letterSpacing:'0.15em',textShadow:'0 0 70px #ffd700aa,0 0 140px #ffd70033,0 4px 0 #aa8800' }}>VICTORY</h1>
          <div style={{ display:'flex',alignItems:'center',gap:'10px' }}>
            <div style={{ width:'50px',height:'1px',background:'linear-gradient(90deg,transparent,#ffd70055)' }} />
            <p style={{ fontFamily:MONO,fontSize:'22px',color:'#ffd700',margin:0,textShadow:'0 0 22px #ffd70066',fontWeight:900 }}>+{(combat?.bountyChange||0).toLocaleString()} ₦</p>
            <div style={{ width:'50px',height:'1px',background:'linear-gradient(90deg,#ffd70055,transparent)' }} />
          </div>
          {/* Match stats summary */}
          <div style={{ display:'flex',gap:'24px',margin:'4px 0' }}>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'20px',color:'#00f5d4',fontWeight:900 }}>{stats.dmgDealt}</div><div style={{ fontSize:'8px',color:'#2a6040',letterSpacing:'2px' }}>DMG DEALT</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'20px',color:'#ff4466',fontWeight:900 }}>{stats.dmgTaken}</div><div style={{ fontSize:'8px',color:'#602040',letterSpacing:'2px' }}>DMG TAKEN</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'20px',color:'#ffd700',fontWeight:900 }}>{stats.crits}</div><div style={{ fontSize:'8px',color:'#604020',letterSpacing:'2px' }}>CRITS</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'20px',color:'#7aabb5',fontWeight:900 }}>{stats.rounds}</div><div style={{ fontSize:'8px',color:'#2a4050',letterSpacing:'2px' }}>ROUNDS</div></div>
          </div>
          <p style={{ fontFamily:MONO,fontSize:'12px',color:'#00f5d4',fontStyle:'italic',margin:0,letterSpacing:'2px' }}>{island?.name} bows to your flag.</p>
          <div style={{ width:'180px',height:'1px',background:'linear-gradient(90deg,transparent,#00f5d433,transparent)',margin:'4px 0' }} />
          {poster && <WantedPoster player={poster} />}
          <button
            style={{ background:'linear-gradient(135deg,rgba(0,245,212,0.14),rgba(0,245,212,0.05))',border:'1px solid #00f5d4',color:'#00f5d4',padding:'10px 36px',fontFamily:MONO,fontSize:'12px',cursor:'pointer',letterSpacing:'5px',marginTop:'8px',boxShadow:'0 0 28px #00f5d444',transition:'all 0.16s' }}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 0 55px #00f5d477';e.currentTarget.style.transform='translateY(-2px)';}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 0 28px #00f5d444';e.currentTarget.style.transform='none';}}
            onClick={()=>navigate('/world')}
          >⚓ CLAIM THE OCEAN</button>
        </div>
      )}

      {/* ══ DEFEAT ═══════════════════════════════════════════════════════════ */}
      {overlay === 'defeat' && (
        <div style={{
          position:'absolute',inset:0,
          background:'radial-gradient(ellipse at 50% 40%,rgba(30,0,8,0.98) 0%,rgba(1,3,10,0.99) 65%)',
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          zIndex:50,gap:'8px',animation:'fadeOverlay 0.65s ease',
        }}>
          <div style={{ position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.18) 2px,rgba(0,0,0,0.18) 4px)',pointerEvents:'none',opacity:0.5 }} />
          <div style={{ width:'180px',height:'1px',background:'linear-gradient(90deg,transparent,#ff4466,transparent)' }} />
          <p style={{ fontFamily:MONO,fontSize:'9px',color:'#5a1a2a',letterSpacing:'12px',margin:0 }}>BATTLE LOST</p>
          <h1 style={{ fontFamily:MONO,fontSize:'66px',fontWeight:900,color:'#ff4466',margin:'4px 0',letterSpacing:'0.15em',textShadow:'0 0 70px #ff4466aa,0 4px 0 #881122' }}>DEFEATED</h1>
          <div style={{ display:'flex',alignItems:'center',gap:'10px' }}>
            <div style={{ width:'50px',height:'1px',background:'linear-gradient(90deg,transparent,#ff446655)' }} />
            <p style={{ fontFamily:MONO,fontSize:'18px',color:'#ff4466',margin:0,fontWeight:900 }}>− {Math.abs(combat?.bountyChange||0).toLocaleString()} ₦ LOST</p>
            <div style={{ width:'50px',height:'1px',background:'linear-gradient(90deg,#ff446655,transparent)' }} />
          </div>
          <div style={{ display:'flex',gap:'24px',margin:'4px 0' }}>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'18px',color:'#00f5d4',fontWeight:900 }}>{stats.dmgDealt}</div><div style={{ fontSize:'8px',color:'#2a5040',letterSpacing:'2px' }}>DEALT</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'18px',color:'#ff4466',fontWeight:900 }}>{stats.dmgTaken}</div><div style={{ fontSize:'8px',color:'#603040',letterSpacing:'2px' }}>TAKEN</div></div>
            <div style={{ textAlign:'center' }}><div style={{ fontSize:'18px',color:'#7aabb5',fontWeight:900 }}>{stats.rounds}</div><div style={{ fontSize:'8px',color:'#2a4050',letterSpacing:'2px' }}>ROUNDS</div></div>
          </div>
          <p style={{ fontFamily:MONO,fontSize:'11px',color:'#7a4a5a',fontStyle:'italic',margin:0,letterSpacing:'2px',maxWidth:'340px',textAlign:'center',lineHeight:1.9 }}>The ocean does not forgive weakness.</p>
          <div style={{ display:'flex',gap:'14px',marginTop:'8px' }}>
            <button
              style={{ background:'rgba(255,68,102,0.10)',border:'1px solid #ff446699',color:'#ff4466',padding:'10px 26px',fontFamily:MONO,fontSize:'11px',cursor:'pointer',letterSpacing:'3px',transition:'all 0.16s' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 0 28px #ff446655';e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none';}}
              onClick={()=>window.location.reload()}
            >🔄 TRY AGAIN</button>
            <button
              style={{ background:'rgba(0,245,212,0.06)',border:'1px solid #00f5d444',color:'#00f5d4',padding:'10px 26px',fontFamily:MONO,fontSize:'11px',cursor:'pointer',letterSpacing:'3px',transition:'all 0.16s' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 0 28px #00f5d444';e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none';}}
              onClick={()=>navigate('/world')}
            >← BACK TO OCEAN</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes logSlideIn  { from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:none;} }
        @keyframes blink       { 0%,100%{opacity:1;}50%{opacity:0.15;} }
        @keyframes fadeOverlay { from{opacity:0;}to{opacity:1;} }
        @keyframes hpPulse     { 0%,100%{opacity:1;}50%{opacity:0.35;} }
        @keyframes screenShake {
          0%{transform:none} 15%{transform:translate(-5px,2px) rotate(-0.4deg)}
          30%{transform:translate(5px,-2px) rotate(0.3deg)} 50%{transform:translate(-3px,1px)}
          70%{transform:translate(3px,-1px)} 85%{transform:translate(-2px,1px)} 100%{transform:none}
        }
        * { box-sizing:border-box; }
      `}</style>
    </div>
  );
}
