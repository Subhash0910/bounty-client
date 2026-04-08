import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import ThreeWorld from '../engine/ThreeWorld.js';
import PixiStage  from '../engine/PixiStage.js';
import AudioManager from '../engine/AudioManager.js';
import EventBus  from '../engine/EventBus.js';
import WeaponCard from '../components/WeaponCard.jsx';
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
  AGGRESSIVE: { color: '#ff4466', icon: '⚔️',  label: 'AGGRESSIVE', tip: 'Countered by EVADE', counter: 'EVADE' },
  DEFENSIVE:  { color: '#4a9eff', icon: '🛡',  label: 'DEFENSIVE',  tip: 'Countered by BOARD',  counter: 'BOARD' },
  DESPERATE:  { color: '#ff8800', icon: '💀',  label: 'DESPERATE',  tip: 'Countered by ATTACK', counter: 'ATTACK' },
};

const COOLDOWNS = { EVADE: 1, SABOTAGE: 2, BOARD: 0, ATTACK: 0, NEGOTIATE: 0 };
const COUNTERS  = { EVADE: 'AGGRESSIVE', BOARD: 'DEFENSIVE', ATTACK: 'DESPERATE' };

function EffectBadge({ effect }) {
  const m = EFFECT_META[effect];
  if (!m) return null;
  return (
    <span title={m.tip} style={{ fontSize:'9px', letterSpacing:'2px', padding:'2px 7px', border:`1px solid ${m.color}55`, color:m.color, background:`${m.color}14`, whiteSpace:'nowrap' }}>
      {m.icon} {effect}
    </span>
  );
}

function HealthBar({ label, hp, maxHp = 100, color, side = 'left', effects = [], flash }) {
  const pct     = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const danger  = pct < 30;
  const warning = pct < 55;
  const barColor = danger ? '#ff4466' : warning ? '#ffaa00' : color;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px', width:'240px' }}>
      <div style={{ display:'flex', justifyContent:side==='left'?'flex-start':'flex-end', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
        <span style={{ color:danger?'#ff6688':color, fontSize:'11px', letterSpacing:'3px', fontWeight:900 }}>
          {side==='left' ? label : `${hp} / ${maxHp}`}
        </span>
        <span style={{ color:danger?'#ff4466':'#7aabb5', fontSize:'11px', letterSpacing:'2px' }}>
          {side==='left' ? `${hp} / ${maxHp}` : label}
        </span>
      </div>
      <div style={{ height:'8px', background:'rgba(0,0,0,0.8)', border:`1px solid ${barColor}44`, position:'relative', overflow:'hidden',
        outline:flash?`1px solid ${barColor}`:'none', boxShadow:flash?`0 0 18px ${barColor}88`:'none', transition:'outline 0.1s,box-shadow 0.1s' }}>
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`,
          background:flash?'#ffffff':danger?'linear-gradient(90deg,#ff2244,#ff4466)':`linear-gradient(90deg,${barColor}bb,${barColor})`,
          boxShadow:`0 0 12px ${barColor}88`,
          transition:flash?'background 0.05s':'width 0.4s cubic-bezier(0.4,0,0.2,1),background 0.2s' }} />
        {danger && <div style={{ position:'absolute', left:0, top:0, right:0, bottom:0, background:'rgba(255,68,102,0.15)', animation:'hpPulse 0.8s ease-in-out infinite' }} />}
      </div>
      {effects.length>0 && (
        <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', justifyContent:side==='left'?'flex-start':'flex-end' }}>
          {effects.map(ef => <EffectBadge key={ef} effect={ef} />)}
        </div>
      )}
    </div>
  );
}

function TidePressureBar({ value, max=10 }) {
  const pct    = (value/max)*100;
  const danger = value >= 8;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', width:'130px' }}>
      <span style={{ fontSize:'8px', letterSpacing:'3px', color:danger?'#ff8800':'#3a5060', fontWeight:danger?900:400 }}>TIDE PRESSURE</span>
      <div style={{ width:'100%', height:'6px', background:'rgba(0,0,0,0.7)', border:`1px solid ${danger?'#ff880055':'#1a3040'}`, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`,
          background:danger?'linear-gradient(90deg,#ff6600,#ff8800)':'linear-gradient(90deg,#1a6a8a,#2a9ab0)',
          boxShadow:danger?'0 0 10px #ff880099':'none', transition:'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize:'9px', color:danger?'#ff8800':'#2a4a5a', letterSpacing:'1px', fontWeight:danger?900:400 }}>{value} / {max}</span>
    </div>
  );
}

function StanceBadge({ stance }) {
  const m = STANCE_META[stance];
  if (!m) return null;
  return (
    <div title={m.tip} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', padding:'5px 12px', border:`1px solid ${m.color}55`, background:`${m.color}0f` }}>
      <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
        <span style={{ fontSize:'11px' }}>{m.icon}</span>
        <span style={{ fontSize:'9px', color:m.color, letterSpacing:'3px', fontWeight:900 }}>{m.label}</span>
      </div>
      <span style={{ fontSize:'8px', color:`${m.color}99`, letterSpacing:'2px' }}>USE {m.counter}</span>
    </div>
  );
}

function RollBadge({ roll, label }) {
  if (!roll) return null;
  const high = roll>=22, low = roll<=12;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'5px 10px',
      border:`1px solid ${high?'#ffd70055':low?'#ff446655':'#1a3a4a'}`,
      background:high?'rgba(255,215,0,0.08)':low?'rgba(255,68,102,0.08)':'rgba(0,6,14,0.7)', minWidth:'50px' }}>
      <span style={{ fontSize:'8px', color:'#3a5060', letterSpacing:'2px' }}>{label}</span>
      <span style={{ fontSize:'20px', fontWeight:900, color:high?'#ffd700':low?'#ff4466':'#aac8d8', lineHeight:1.2 }}>{roll}</span>
    </div>
  );
}

function StatRow({ label, value, color='#7aabb5' }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid rgba(0,30,50,0.5)' }}>
      <span style={{ fontSize:'9px', color:'#3a5060', letterSpacing:'2px' }}>{label}</span>
      <span style={{ fontSize:'12px', color, fontWeight:900, letterSpacing:'1px' }}>{value}</span>
    </div>
  );
}

function LogLine({ text, index }) {
  const colors  = ['#c8e0f0','#6a8a9a','#3a5060','#2a3a48','#1e2a38'];
  const borders = ['#00f5d4cc','#00f5d455','#00f5d418','transparent','transparent'];
  return (
    <div style={{ background:index===0?'rgba(0,10,24,0.97)':'rgba(0,6,14,0.75)', borderLeft:`3px solid ${borders[index]||'transparent'}`,
      padding:'7px 14px', color:colors[index]||'#1a2a38', fontSize:index===0?'12px':'11px',
      letterSpacing:'0.3px', lineHeight:'1.6', animation:index===0?'logSlideIn 0.22s ease':'none',
      borderBottom:'1px solid rgba(0,20,40,0.4)' }}>{text}</div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function CombatPage() {
  const { islandId } = useParams();
  const navigate     = useNavigate();

  const threeCanvasRef = useRef(null);
  const pixiCanvasRef  = useRef(null);
  const threeWorldRef  = useRef(null);
  const pixiStageRef   = useRef(null);
  const lockRef        = useRef(false);
  const overlayRef     = useRef(null);
  // refs to card DOM nodes for press animation
  const cardRefs       = useRef({});

  const [island,   setIsland]   = useState(null);
  const [combat,   setCombat]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [overlay,  setOverlay]  = useState(null);
  const [log,      setLog]      = useState([]);
  const [pFlash,   setPFlash]   = useState(false);
  const [eFlash,   setEFlash]   = useState(false);
  const [cooldowns, setCooldowns] = useState({ ATTACK:0, BOARD:0, EVADE:0, SABOTAGE:0, NEGOTIATE:0 });
  const [pressedCard, setPressedCard] = useState(null);

  const statsRef = useRef({ dmgDealt:0, dmgTaken:0, crits:0, rounds:0 });
  const [stats,  setStats]  = useState({ dmgDealt:0, dmgTaken:0, crits:0, rounds:0 });

  const bounty = Number(localStorage.getItem('bounty') || 0);
  const poster = JSON.parse(localStorage.getItem('wantedPoster') || 'null');

  // ── Boot Three.js + PixiJS ───────────────────────────────────────────────
  useEffect(() => {
    if (!threeCanvasRef.current || !pixiCanvasRef.current) return;
    const world = new ThreeWorld(threeCanvasRef.current);
    threeWorldRef.current = world;
    world.loadShip('player', '/models/player_ship.glb', { x:-18, y:0, z:0, scale:0.55 }, false);
    world.loadShip('enemy',  '/models/enemy_ship.glb',  { x: 18, y:0, z:0, scale:0.55 }, true);
    const stage = new PixiStage(pixiCanvasRef.current);
    pixiStageRef.current = stage;
    AudioManager.startOcean();
    (async () => {
      try {
        const [iRes, sRes] = await Promise.all([
          api.get(`/api/islands/${islandId}`),
          api.post(`/api/islands/${islandId}/sail`),
        ]);
        setIsland(iRes.data);
        setCombat(sRes.data);
        AudioManager.startBattle();
        const stance = sRes.data.enemyStance || 'AGGRESSIVE';
        setTimeout(() => EventBus.emit('playTelegraph', { stance }), 800);
        setLog([
          `⚓ You sail toward ${iRes.data.name}. The air tastes of iron and salt.`,
          `🌊 Their ${stance.toLowerCase()} stance shows. Choose wisely.`,
        ]);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to start encounter.');
      }
    })();
    return () => {
      world.destroy(); stage.destroy(); AudioManager.stopAll(); EventBus.clear();
    };
  }, [islandId]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (!combat || combat.status!=='ONGOING' || loading) return;
      if (e.key==='1') takeTurn('ATTACK');
      if (e.key==='2') takeTurn('BOARD');
      if (e.key==='3') takeTurn('EVADE');
      if (e.key==='4') takeTurn('SABOTAGE');
      if (e.key==='5') takeTurn('NEGOTIATE');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [combat, loading, cooldowns]);

  // ── Cooldowns ──────────────────────────────────────────────────────────
  const tickCooldowns = useCallback((usedMove) => {
    setCooldowns(prev => {
      const next = {};
      for (const [k,v] of Object.entries(prev)) next[k] = Math.max(0,v-1);
      if (COOLDOWNS[usedMove]>0) next[usedMove] = COOLDOWNS[usedMove];
      return next;
    });
  }, []);

  // ── Card press animation ──────────────────────────────────────────────
  const animateCardPress = useCallback((approach) => {
    setPressedCard(approach);
    setTimeout(() => setPressedCard(null), 180);
  }, []);

  // ── Turn handler ─────────────────────────────────────────────────────────
  const takeTurn = useCallback(async (approach) => {
    if (lockRef.current || !combat || combat.status!=='ONGOING') return;
    if (cooldowns[approach]>0) return;
    lockRef.current = true; setLoading(true);
    animateCardPress(approach);

    try {
      const prevPHP = combat.playerHealth;
      const prevEHP = combat.enemyHealth;
      const res     = await api.post('/api/encounter/turn', { approach });
      const state   = res.data;
      setCombat(state);
      tickCooldowns(approach);

      const dmgDealt = Math.max(0, prevEHP - state.enemyHealth);
      const dmgTaken = Math.max(0, prevPHP - state.playerHealth);
      const isCrit   = state.lastPlayerRoll >= 24;

      // ── Update ship hull crack visuals ──────────────────────────────────
      const pixi = pixiStageRef.current;
      if (pixi) {
        pixi.updateHealth('player', state.playerHealth / 100);
        pixi.updateHealth('enemy',  state.enemyHealth  / 100);

        if (approach === 'ATTACK') {
          pixi.playAttack(true, () => { AudioManager.play('impact'); AudioManager.play('wood'); });
          AudioManager.play('cannon');
          if (dmgTaken > 0) setTimeout(() => {
            pixi.playAttack(false, () => AudioManager.play('impact'));
            AudioManager.play('cannon');
          }, 520);
        } else if (approach === 'BOARD') {
          pixi.playBoard();
          AudioManager.play('board');
        } else if (approach === 'EVADE') {
          pixi.playEvade(dmgTaken === 0);
          AudioManager.play('whoosh');
        } else if (approach === 'SABOTAGE') {
          pixi.playSabotage(true);
          AudioManager.play('sabotage');
        } else if (approach === 'NEGOTIATE') {
          pixi.playNegotiate(state.status==='PLAYER_WON' || state.enemyHealth < prevEHP);
          AudioManager.play(state.status==='PLAYER_WON' || state.enemyHealth < prevEHP ? 'coins' : 'whoosh');
        }
      }

      // HP flash
      if (dmgDealt>0) { setEFlash(true); setTimeout(()=>setEFlash(false),260); }
      if (dmgTaken>0 && state.status==='ONGOING') {
        setPFlash(true); setTimeout(()=>setPFlash(false),260);
        EventBus.emit('cameraShake', { intensity:0.4, duration:350 });
      }

      statsRef.current = {
        dmgDealt: statsRef.current.dmgDealt + dmgDealt,
        dmgTaken: statsRef.current.dmgTaken + dmgTaken,
        crits:    statsRef.current.crits    + (isCrit?1:0),
        rounds:   statsRef.current.rounds   + 1,
      };
      setStats({...statsRef.current});

      // Log messages
      const msgs = [];
      if (state.lastEventLine) msgs.push(state.lastEventLine);
      const stanceMeta = STANCE_META[combat.enemyStance];
      if (stanceMeta && COUNTERS[approach]===combat.enemyStance)
        msgs.push(`✨ COUNTER HIT — ${approach} crushes their ${combat.enemyStance} stance!`);
      if (state.lastEnemyRoll>0 && state.status==='ONGOING')
        msgs.push(`↩  Enemy retaliates — ${state.lastEnemyRoll} damage.`);
      const ph=state.playerHealth, eh=state.enemyHealth;
      if (ph<=20)                             msgs.push('⚠️  CRITICAL — one more hit ends you.');
      else if (ph<=40)                        msgs.push('🩸 You\'re badly wounded. Stay sharp.');
      if (eh<=20 && state.status==='ONGOING') msgs.push('💀 They\'re near the end. Finish them.');
      if (state.tidePressure>=8)              msgs.push('🌊 TIDE PRESSURE CRITICAL — surge imminent!');
      if (state.round>1 && state.round%4===0 && state.status==='ONGOING')
        msgs.push(`⏱  Round ${state.round}. The storm is closing in.`);
      setLog(prev => [...msgs, ...prev].slice(0,6));

      if (state.status==='ONGOING' && state.enemyStance)
        setTimeout(()=>EventBus.emit('playTelegraph',{stance:state.enemyStance}), 600);

      if (state.status==='PLAYER_WON') {
        const nb = bounty+(state.bountyChange??0);
        localStorage.setItem('bounty',nb);
        const ic = Number(localStorage.getItem('islandsConquered')||0)+1;
        localStorage.setItem('islandsConquered',ic);
        localStorage.setItem('wantedPoster', JSON.stringify({
          handle:localStorage.getItem('handle'), bounty:nb,
          tier:localStorage.getItem('tier')||'Drifter',
          islandsConquered:ic, seasonRank:null,
        }));
        pixi?.playVictory();
        AudioManager.play('victory'); AudioManager.stopBGM();
        setTimeout(()=>{ setOverlay('victory'); if(overlayRef.current) gsap.from(overlayRef.current,{opacity:0,scale:0.96,duration:0.5,ease:'power2.out'}); }, 1200);
      }
      if (state.status==='PLAYER_LOST') {
        pixi?.playDefeat();
        AudioManager.play('defeat'); AudioManager.stopBGM();
        setTimeout(()=>{ setOverlay('defeat'); if(overlayRef.current) gsap.from(overlayRef.current,{opacity:0,scale:1.04,duration:0.5,ease:'power2.out'}); }, 1400);
      }
    } catch {
      setLog(prev=>['⚠️  Signal lost. Try again.',...prev].slice(0,6));
    } finally {
      lockRef.current=false; setLoading(false);
    }
  }, [combat, bounty, cooldowns, tickCooldowns, animateCardPress]);

  const repairHull = useCallback(async () => {
    if (!combat || combat.status!=='ONGOING' || bounty<300) return;
    const newBounty = bounty-300;
    localStorage.setItem('bounty', newBounty);
    const newHp = Math.min(100, combat.playerHealth+30);
    setCombat(prev=>({...prev, playerHealth:newHp}));
    pixiStageRef.current?.updateHealth('player', newHp/100);
    setPFlash(true); setTimeout(()=>setPFlash(false),300);
    AudioManager.play('coins');
    setLog(prev=>['🔧 Hull repaired! +30 HP (-300 ₦)',...prev].slice(0,6));
  }, [combat, bounty]);

  const ongoing     = combat?.status==='ONGOING';
  const btnOff      = !ongoing || loading;
  const canSabotage = bounty>=500;
  const canRepair   = bounty>=300 && ongoing && (combat?.playerHealth??100)<100;
  const isAnchored  = combat?.anchored || (combat?.playerEffects||[]).includes('ANCHORED');
  const round       = combat?.round??1;
  const typeColor   = island?(TYPE_COLORS[island.type]||'#00f5d4'):'#00f5d4';
  const playerEffects = combat?.playerEffects||[];
  const enemyEffects  = combat?.enemyEffects ||[];
  const stance        = combat?.enemyStance  ||'AGGRESSIVE';
  const counterMove   = STANCE_META[stance]?.counter;

  // card press transform helper
  const cardStyle = (approach) => pressedCard===approach
    ? { transform:'scale(0.91) translateY(4px)', filter:'brightness(1.5)', transition:'transform 0.06s,filter 0.06s' }
    : { transform:'scale(1) translateY(0)', transition:'transform 0.18s,filter 0.18s' };

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', fontFamily:MONO, background:'#010408' }}>

      <canvas ref={threeCanvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:0 }} />
      <canvas ref={pixiCanvasRef}  style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:1, pointerEvents:'none' }} />

      {/* TOP BAR */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'60px',
        background:'rgba(1,3,10,0.97)', display:'flex', alignItems:'center',
        padding:'0 20px', gap:'16px', zIndex:30,
        borderBottom:`2px solid ${typeColor}33`, boxShadow:'0 2px 20px rgba(0,0,0,0.8)' }}>
        <div style={{ flex:1, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:typeColor, boxShadow:`0 0 8px ${typeColor}`, flexShrink:0 }} />
            <span style={{ color:'#ffffff', fontWeight:900, fontSize:'14px', letterSpacing:'2px', whiteSpace:'nowrap' }}>{island?.name||'——'}</span>
            {island?.type && <span style={{ color:typeColor, fontSize:'9px', letterSpacing:'4px' }}>{island.type}</span>}
            {island?.difficulty && <span style={{ color:'#4a6070', fontSize:'9px', letterSpacing:'3px' }}>{'★'.repeat(island.difficulty)}</span>}
          </div>
          <div style={{ color:'#6a8a9a', fontSize:'10px', fontStyle:'italic', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:'2px', paddingLeft:'14px' }}>{island?.lore||''}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', flexShrink:0 }}>
          <div style={{ color:'#ffd700', fontSize:'12px', letterSpacing:'8px', fontWeight:900, textShadow:'0 0 14px #ffd70066' }}>ROUND {round}</div>
          {combat && <TidePressureBar value={combat.tidePressure??0} max={10} />}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
          {combat && <StanceBadge stance={stance} />}
          {canRepair && (
            <button onClick={repairHull}
              style={{ background:'rgba(0,245,212,0.08)', border:'1px solid #00f5d455', color:'#00f5d4', fontFamily:MONO, fontSize:'9px', padding:'5px 12px', cursor:'pointer', letterSpacing:'2px', transition:'all 0.14s', flexShrink:0 }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,245,212,0.16)';e.currentTarget.style.boxShadow='0 0 16px #00f5d433';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,245,212,0.08)';e.currentTarget.style.boxShadow='none';}}
              title="Spend 300 bounty to repair +30 HP"
            >🔧 REPAIR −300₦</button>
          )}
          <button onClick={()=>navigate('/world')}
            style={{ background:'transparent', border:'1px solid rgba(255,68,102,0.3)', color:'#aa3355', fontFamily:MONO, fontSize:'10px', padding:'5px 14px', cursor:'pointer', flexShrink:0, letterSpacing:'3px', transition:'all 0.14s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#ff4466';e.currentTarget.style.color='#ff4466';e.currentTarget.style.boxShadow='0 0 14px #ff446633';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,68,102,0.3)';e.currentTarget.style.color='#aa3355';e.currentTarget.style.boxShadow='none';}}
          >← RETREAT</button>
        </div>
      </div>

      {/* LEFT SIDEBAR */}
      <div style={{ position:'absolute', top:'76px', left:'16px', width:'148px', zIndex:30,
        background:'rgba(0,4,12,0.95)', border:'1px solid rgba(0,245,212,0.10)', padding:'12px 14px', boxShadow:'0 4px 24px rgba(0,0,0,0.7)' }}>
        <div style={{ color:'#1e5060', fontSize:'8px', letterSpacing:'4px', marginBottom:'8px', fontWeight:900 }}>SESSION</div>
        <StatRow label="DMG DEALT" value={stats.dmgDealt} color="#00f5d4" />
        <StatRow label="DMG TAKEN" value={stats.dmgTaken} color="#ff4466" />
        <StatRow label="CRITS"     value={stats.crits}    color="#ffd700" />
        <StatRow label="ROUNDS"    value={stats.rounds}   color="#7aabb5" />
        <StatRow label="BOUNTY"    value={`₦${bounty.toLocaleString()}`} color="#ffd700" />
        {playerEffects.length>0 && (
          <>
            <div style={{ color:'#1a3a4a', fontSize:'7px', letterSpacing:'3px', margin:'10px 0 5px', fontWeight:900 }}>YOUR STATUS</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>{playerEffects.map(ef=><EffectBadge key={ef} effect={ef} />)}</div>
          </>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      {combat && (combat.lastPlayerRoll>0||combat.lastEnemyRoll>0) && (
        <div style={{ position:'absolute', top:'76px', right:'16px', width:'118px', zIndex:30,
          background:'rgba(0,4,12,0.95)', border:'1px solid rgba(0,245,212,0.10)', padding:'12px 10px',
          display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', boxShadow:'0 4px 24px rgba(0,0,0,0.7)' }}>
          <div style={{ color:'#1e5060', fontSize:'8px', letterSpacing:'4px', fontWeight:900 }}>LAST ROLL</div>
          <RollBadge roll={combat.lastPlayerRoll} label="YOURS" />
          <div style={{ color:'#1a2a38', fontSize:'9px', letterSpacing:'2px' }}>vs</div>
          <RollBadge roll={combat.lastEnemyRoll} label="THEIRS" />
          {enemyEffects.length>0 && (
            <>
              <div style={{ color:'#1a2a3a', fontSize:'7px', letterSpacing:'2px', marginTop:'4px', fontWeight:900 }}>ENEMY</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px', alignItems:'center' }}>{enemyEffects.map(ef=><EffectBadge key={ef} effect={ef} />)}</div>
            </>
          )}
        </div>
      )}

      {/* HP BARS */}
      {combat && (
        <div style={{ position:'absolute', bottom:'168px', left:'50%', transform:'translateX(-50%)',
          width:'580px', zIndex:30, display:'flex', justifyContent:'space-between', alignItems:'flex-start',
          padding:'0 4px', pointerEvents:'none' }}>
          <HealthBar label="YOU" hp={combat.playerHealth} maxHp={100} color="#00f5d4" side="left" effects={playerEffects} flash={pFlash} />
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', paddingTop:'4px' }}>
            <span style={{ color:'#2a3a48', fontSize:'9px', letterSpacing:'3px' }}>VS</span>
          </div>
          <HealthBar label={island?.name?.toUpperCase().slice(0,11)||'ENEMY'} hp={combat.enemyHealth} maxHp={100} color={typeColor} side="right" effects={enemyEffects} flash={eFlash} />
        </div>
      )}

      {/* COMBAT LOG */}
      <div style={{ position:'absolute', bottom:'280px', left:'50%', transform:'translateX(-50%)',
        width:'580px', zIndex:30, display:'flex', flexDirection:'column',
        pointerEvents:'none', border:'1px solid rgba(0,20,40,0.7)', boxShadow:'0 4px 20px rgba(0,0,0,0.6)', overflow:'hidden' }}>
        {log.map((line,i) => <LogLine key={`${line}-${i}`} text={line} index={i} />)}
      </div>

      {loading && (
        <div style={{ position:'absolute', bottom:'276px', left:'50%', transform:'translateX(-50%)',
          color:'#00f5d4', fontSize:'9px', letterSpacing:'6px', zIndex:31,
          animation:'blink 0.5s ease-in-out infinite', whiteSpace:'nowrap',
          textShadow:'0 0 10px #00f5d4', fontWeight:900 }}>▸ ▸ ▸  PROCESSING TURN</div>
      )}

      {/* ACTION BAR */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'156px',
        background:'rgba(1,3,10,0.98)', display:'flex', alignItems:'center',
        justifyContent:'center', gap:'8px', zIndex:30, paddingBottom:'10px',
        borderTop:`2px solid ${typeColor}22`, boxShadow:'0 -4px 30px rgba(0,0,0,0.8)' }}>

        <div style={cardStyle('ATTACK')}>
          <WeaponCard icon="💣" label="ATTACK" hotkey="1" color="#00f5d4" index={0}
            sub="14–25 DMG · crit on 24+" disabled={btnOff}
            onClick={()=>takeTurn('ATTACK')} cooldownLeft={cooldowns.ATTACK}
            isCounter={counterMove==='ATTACK'} visible={!!combat} />
        </div>
        <div style={{ width:'1px', height:'55px', background:'rgba(0,245,212,0.08)' }} />
        <div style={cardStyle('BOARD')}>
          <WeaponCard icon="⚔️" label="BOARD" hotkey="2" color="#ff8844" index={1}
            sub="15–30 DMG · 8–15 taken"
            disabled={btnOff||isAnchored} onClick={()=>takeTurn('BOARD')}
            cooldownLeft={cooldowns.BOARD}
            isCounter={!isAnchored&&counterMove==='BOARD'} visible={!!combat} />
        </div>
        <div style={{ width:'1px', height:'55px', background:'rgba(0,245,212,0.08)' }} />
        <div style={cardStyle('EVADE')}>
          <WeaponCard icon="💨" label="EVADE" hotkey="3" color="#4a9eff" index={2}
            sub="Dodge next hit · may ANCHOR"
            disabled={btnOff||isAnchored} onClick={()=>takeTurn('EVADE')}
            cooldownLeft={cooldowns.EVADE}
            isCounter={!isAnchored&&counterMove==='EVADE'} visible={!!combat} />
        </div>
        <div style={{ width:'1px', height:'55px', background:'rgba(0,245,212,0.08)' }} />
        <div style={cardStyle('SABOTAGE')}>
          <WeaponCard icon="🔥" label="SABOTAGE" hotkey="4" color="#9b59b6" index={3}
            sub={canSabotage?'RATTLE + 5–12 DMG':'NEED 500₦'}
            disabled={btnOff||!canSabotage} onClick={()=>takeTurn('SABOTAGE')}
            cooldownLeft={cooldowns.SABOTAGE} isCounter={false} visible={!!combat} />
        </div>
        <div style={{ width:'1px', height:'55px', background:'rgba(0,245,212,0.08)' }} />
        <div style={cardStyle('NEGOTIATE')}>
          <WeaponCard icon="🤝" label="NEGOTIATE" hotkey="5" color="#ffd700" index={4}
            sub="35% · HALF reward" disabled={btnOff}
            onClick={()=>takeTurn('NEGOTIATE')} cooldownLeft={cooldowns.NEGOTIATE}
            isCounter={false} visible={!!combat} />
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div style={{ position:'absolute', inset:0, background:'rgba(1,3,10,0.98)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:50, gap:'1.5rem' }}>
          <div style={{ color:'#ff4466', fontFamily:MONO, letterSpacing:'2px', fontSize:'12px', textAlign:'center', maxWidth:'400px', lineHeight:2 }}>{error}</div>
          <button style={{ background:'transparent', border:'1px solid #00f5d4', color:'#00f5d4', padding:'0.7rem 2rem', fontFamily:MONO, cursor:'pointer', letterSpacing:'3px', fontSize:'11px', transition:'all 0.14s' }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='0 0 24px #00f5d455'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
            onClick={()=>navigate('/world')}
          >← BACK TO OCEAN</button>
        </div>
      )}

      {/* VICTORY */}
      {overlay==='victory' && (
        <div ref={overlayRef} style={{ position:'absolute', inset:0,
          background:'radial-gradient(ellipse at 50% 40%,rgba(0,40,30,0.98) 0%,rgba(1,4,10,0.99) 65%)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:50, gap:'8px' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.12) 2px,rgba(0,0,0,0.12) 4px)', pointerEvents:'none', opacity:0.4 }} />
          <div style={{ width:'200px', height:'1px', background:'linear-gradient(90deg,transparent,#ffd700,transparent)' }} />
          <p style={{ fontFamily:MONO, fontSize:'9px', color:'#4a6a3a', letterSpacing:'12px', margin:0 }}>ISLAND CLAIMED</p>
          <h1 style={{ fontFamily:MONO, fontSize:'68px', fontWeight:900, color:'#ffd700', margin:'4px 0', letterSpacing:'0.15em', textShadow:'0 0 70px #ffd700aa,0 0 140px #ffd70033,0 4px 0 #aa8800' }}>VICTORY</h1>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'50px', height:'1px', background:'linear-gradient(90deg,transparent,#ffd70055)' }} />
            <p style={{ fontFamily:MONO, fontSize:'22px', color:'#ffd700', margin:0, textShadow:'0 0 22px #ffd70066', fontWeight:900 }}>+{(combat?.bountyChange||0).toLocaleString()} ₦</p>
            <div style={{ width:'50px', height:'1px', background:'linear-gradient(90deg,#ffd70055,transparent)' }} />
          </div>
          <div style={{ display:'flex', gap:'24px', margin:'4px 0' }}>
            {[['DMG DEALT',stats.dmgDealt,'#00f5d4'],['DMG TAKEN',stats.dmgTaken,'#ff4466'],['CRITS',stats.crits,'#ffd700'],['ROUNDS',stats.rounds,'#7aabb5']].map(([l,v,c])=>(
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:'22px', color:c, fontWeight:900 }}>{v}</div>
                <div style={{ fontSize:'8px', color:`${c}66`, letterSpacing:'2px' }}>{l}</div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily:MONO, fontSize:'12px', color:'#00f5d4', fontStyle:'italic', margin:0, letterSpacing:'2px' }}>{island?.name} bows to your flag.</p>
          <div style={{ width:'200px', height:'1px', background:'linear-gradient(90deg,transparent,#00f5d433,transparent)', margin:'4px 0' }} />
          {poster && <WantedPoster player={poster} />}
          <button style={{ background:'linear-gradient(135deg,rgba(0,245,212,0.15),rgba(0,245,212,0.06))', border:'1px solid #00f5d4', color:'#00f5d4', padding:'10px 40px', fontFamily:MONO, fontSize:'12px', cursor:'pointer', letterSpacing:'5px', marginTop:'8px', boxShadow:'0 0 30px #00f5d444', transition:'all 0.14s' }}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 0 55px #00f5d477';e.currentTarget.style.transform='translateY(-2px)';}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 0 30px #00f5d444';e.currentTarget.style.transform='none';}}
            onClick={()=>navigate('/world')}
          >⚓ CLAIM THE OCEAN</button>
        </div>
      )}

      {/* DEFEAT */}
      {overlay==='defeat' && (
        <div ref={overlayRef} style={{ position:'absolute', inset:0,
          background:'radial-gradient(ellipse at 50% 40%,rgba(30,0,8,0.98) 0%,rgba(1,3,10,0.99) 65%)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:50, gap:'8px' }}>
          <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.18) 2px,rgba(0,0,0,0.18) 4px)', pointerEvents:'none', opacity:0.5 }} />
          <div style={{ width:'200px', height:'1px', background:'linear-gradient(90deg,transparent,#ff4466,transparent)' }} />
          <p style={{ fontFamily:MONO, fontSize:'9px', color:'#5a1a2a', letterSpacing:'12px', margin:0 }}>BATTLE LOST</p>
          <h1 style={{ fontFamily:MONO, fontSize:'68px', fontWeight:900, color:'#ff4466', margin:'4px 0', letterSpacing:'0.15em', textShadow:'0 0 70px #ff4466aa,0 4px 0 #881122' }}>DEFEATED</h1>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'50px', height:'1px', background:'linear-gradient(90deg,transparent,#ff446655)' }} />
            <p style={{ fontFamily:MONO, fontSize:'18px', color:'#ff4466', margin:0, fontWeight:900 }}>− {Math.abs(combat?.bountyChange||0).toLocaleString()} ₦ LOST</p>
            <div style={{ width:'50px', height:'1px', background:'linear-gradient(90deg,#ff446655,transparent)' }} />
          </div>
          <div style={{ display:'flex', gap:'24px', margin:'4px 0' }}>
            {[['DEALT',stats.dmgDealt,'#00f5d4'],['TAKEN',stats.dmgTaken,'#ff4466'],['ROUNDS',stats.rounds,'#7aabb5']].map(([l,v,c])=>(
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:'20px', color:c, fontWeight:900 }}>{v}</div>
                <div style={{ fontSize:'8px', color:`${c}66`, letterSpacing:'2px' }}>{l}</div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily:MONO, fontSize:'11px', color:'#7a4a5a', fontStyle:'italic', margin:0, letterSpacing:'2px', maxWidth:'340px', textAlign:'center', lineHeight:1.9 }}>The ocean does not forgive weakness.</p>
          <div style={{ display:'flex', gap:'14px', marginTop:'8px' }}>
            <button style={{ background:'rgba(255,68,102,0.10)', border:'1px solid #ff446699', color:'#ff4466', padding:'10px 28px', fontFamily:MONO, fontSize:'11px', cursor:'pointer', letterSpacing:'3px', transition:'all 0.14s' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 0 28px #ff446655';e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none';}}
              onClick={()=>window.location.reload()}
            >🔄 TRY AGAIN</button>
            <button style={{ background:'rgba(0,245,212,0.06)', border:'1px solid #00f5d444', color:'#00f5d4', padding:'10px 28px', fontFamily:MONO, fontSize:'11px', cursor:'pointer', letterSpacing:'3px', transition:'all 0.14s' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 0 28px #00f5d444';e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none';}}
              onClick={()=>navigate('/world')}
            >← BACK TO OCEAN</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes logSlideIn { from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:none;} }
        @keyframes blink      { 0%,100%{opacity:1;}50%{opacity:0.15;} }
        @keyframes hpPulse    { 0%,100%{opacity:1;}50%{opacity:0.3;} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#010408;}::-webkit-scrollbar-thumb{background:#1a3a4a;}
      `}</style>
    </div>
  );
}
