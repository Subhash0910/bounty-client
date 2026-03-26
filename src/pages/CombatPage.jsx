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

// ─── Health Bar ───────────────────────────────────────────────────────────────
function HealthBar({ label, hp, maxHp = 100, color, side = 'left' }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const danger = pct < 30;
  const warning = pct < 55;
  const barColor = danger ? '#ff4466' : warning ? '#ffaa00' : color;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px', width:'260px' }}>
      <div style={{ display:'flex', justifyContent: side==='left'?'flex-start':'flex-end', alignItems:'center', gap:'8px' }}>
        <span style={{ color: danger?'#ff6688':color, fontSize:'10px', letterSpacing:'3px', fontWeight:700, textShadow: danger?`0 0 10px #ff446688`:undefined }}>
          {side==='left' ? label : `${hp} / ${maxHp}`}
        </span>
        <span style={{ color: danger?'#ff4466':'#7aabb5', fontSize:'10px', letterSpacing:'2px' }}>
          {side==='left' ? `${hp} / ${maxHp}` : label}
        </span>
      </div>
      <div style={{ height:'6px', background:'rgba(0,0,0,0.6)', border:`1px solid ${barColor}33`, position:'relative', overflow:'hidden' }}>
        <div style={{
          position:'absolute', left:0, top:0, bottom:0,
          width:`${pct}%`,
          background: danger
            ? `linear-gradient(90deg,#ff2244,#ff4466)`
            : `linear-gradient(90deg,${barColor}cc,${barColor})`,
          boxShadow: `0 0 10px ${barColor}88`,
          transition:'width 0.4s ease',
        }} />
        {/* pulse on danger */}
        {danger && (
          <div style={{
            position:'absolute',left:0,top:0,right:0,bottom:0,
            background:'rgba(255,68,102,0.12)',
            animation:'hpPulse 0.8s ease-in-out infinite',
          }} />
        )}
      </div>
    </div>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────
function ActionBtn({ icon, label, sub, color, disabled, onClick, hotkey }) {
  const [hov, setHov] = useState(false);
  const active = hov && !disabled;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={`[${hotkey}] ${label}`}
      style={{
        width:'210px', height:'90px', position:'relative',
        background: active
          ? `linear-gradient(160deg,${color}22,${color}0e)`
          : disabled ? 'rgba(2,6,14,0.5)' : 'linear-gradient(160deg,rgba(4,9,22,0.92),rgba(3,7,18,0.78))',
        border:`1px solid ${disabled ? 'rgba(255,255,255,0.04)' : active ? color : color+'44'}`,
        borderRadius:'2px', overflow:'hidden',
        boxShadow: active ? `0 0 45px ${color}55,inset 0 1px 0 ${color}33` :
                   disabled ? 'none' : `0 0 14px ${color}20,inset 0 1px 0 ${color}14`,
        color: disabled ? 'rgba(255,255,255,0.12)' : color,
        fontFamily:MONO, cursor:disabled?'not-allowed':'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:'2px', padding:'0',
        transition:'all 0.16s ease',
        transform: active ? 'translateY(-4px) scale(1.02)' : 'none',
        opacity: disabled ? 0.3 : 1,
        backdropFilter:'blur(12px)',
        userSelect:'none',
      }}
    >
      {/* top shimmer */}
      <div style={{ position:'absolute',top:0,left:0,right:0,height:'1px', background:active?`linear-gradient(90deg,transparent,${color}aa,transparent)`:'transparent', transition:'background 0.16s' }} />
      {/* hotkey badge */}
      <div style={{ position:'absolute',top:'6px',right:'8px', color:disabled?'rgba(255,255,255,0.06)':color+'88', fontSize:'9px', letterSpacing:'1px' }}>[{hotkey}]</div>
      <span style={{ fontSize:'22px', lineHeight:1, filter:disabled?'grayscale(1) opacity(0.3)':'drop-shadow(0 0 6px currentColor)' }}>{icon}</span>
      <span style={{ fontWeight:900, fontSize:'14px', letterSpacing:'5px', marginTop:'1px' }}>{label}</span>
      <span style={{ fontSize:'9px', color:disabled?'rgba(255,255,255,0.08)':'#6a8a9a', letterSpacing:'0.8px', textAlign:'center', padding:'0 10px', lineHeight:1.4 }}>{sub}</span>
    </button>
  );
}

// ─── Combat Log Line ─────────────────────────────────────────────────────────
function LogLine({ text, index }) {
  const colors = ['#aac8d8', '#5a7a8a', '#3a5060'];
  const borders = ['#00f5d477', '#00f5d422', '#00f5d40a'];
  return (
    <div style={{
      background: index===0 ? 'rgba(0,10,22,0.88)' : 'rgba(0,6,14,0.65)',
      backdropFilter:'blur(10px)',
      borderLeft:`3px solid ${borders[index]||'transparent'}`,
      padding:'8px 16px',
      color:colors[index]||'#2a3a4a',
      fontSize: index===0?'12.5px':'11px',
      letterSpacing:'0.3px', lineHeight:'1.6',
      animation: index===0?'logSlideIn 0.3s ease':'none',
      transition:'all 0.2s',
    }}>{text}</div>
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

  const bounty = Number(localStorage.getItem('bounty') || 0);

  // ── Boot Phaser + fetch island + sail ─────────────────────────────────────
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
          `⚓ You sail toward ${iRes.data.name}. The air tastes like steel.`,
          `🌊 Waves crash against your hull. No turning back.`,
        ]);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to start encounter.');
      }
    })();
    return () => { window.removeEventListener('resize', onResize); game.destroy(true); };
  }, [islandId]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (e.key === '1') takeTurn('ATTACK');
      if (e.key === '2') takeTurn('INTIMIDATE');
      if (e.key === '3') takeTurn('NEGOTIATE');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Turn handler ─────────────────────────────────────────────────────────
  const takeTurn = useCallback(async (approach) => {
    if (lockRef.current || !combat || combat.status !== 'ONGOING') return;
    lockRef.current = true; setLoading(true);
    try {
      const prevPlayerHp = combat.playerHealth;
      const prevEnemyHp  = combat.enemyHealth;
      const res   = await api.post('/api/encounter/turn', { approach });
      const state = res.data;
      setCombat(state);
      phaserRef.current?.events.emit('combatUpdate', { ...state, lastApproach: approach });

      const dmgTaken   = prevPlayerHp - state.playerHealth;
      const dmgDealt   = prevEnemyHp  - state.enemyHealth;
      const playerLow  = state.playerHealth <= 30;
      const enemyLow   = state.enemyHealth  <= 20;

      // screen shake on taking damage
      if (dmgTaken > 0 && state.status === 'ONGOING') {
        setShake(true); setTimeout(() => setShake(false), 420);
      }

      const msgs = [];
      if (approach === 'ATTACK') {
        msgs.push(dmgDealt > 0
          ? `⚔️  You strike for ${dmgDealt} — cannons roar across the water!`
          : `⚔️  Your shot goes wide. Nothing.`);
        if (dmgTaken > 0) msgs.push(`🩸 They retaliate — ${dmgTaken} damage carves into your hull.`);
        if (enemyLow)    msgs.push(`💀 They're almost finished. Finish them.`);
        if (playerLow)   msgs.push(`⚠️  Your hull is failing. One more hit and it's over.`);
      } else if (approach === 'INTIMIDATE') {
        msgs.push(dmgDealt > 0
          ? `👁  Your name breaks their will — ${dmgDealt} morale shattered.`
          : `👁  They don't flinch. Your reputation means nothing here.`);
      } else if (approach === 'NEGOTIATE') {
        msgs.push(state.status === 'PLAYER_WON'
          ? `🤝 They accept. The island is yours without more bloodshed.`
          : `🤝 They spit in your face and charge.`);
        if (state.status !== 'PLAYER_WON' && dmgTaken > 0)
          msgs.push(`🩸 ${dmgTaken} damage — paying for your failed diplomacy.`);
      }
      if (state.round > 1 && state.status === 'ONGOING' && state.round % 3 === 0)
        msgs.push(`⏱  Round ${state.round}. The tide is running out.`);

      setLog(prev => [...msgs, ...prev].slice(0, 5));

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
        setTimeout(() => setOverlay('victory'), 900);
      }
      if (state.status === 'PLAYER_LOST') setTimeout(() => setOverlay('defeat'), 900);
    } catch {
      setLog(prev => ['⚠️  Signal lost. Try again.', ...prev].slice(0, 5));
    } finally {
      lockRef.current = false; setLoading(false);
    }
  }, [combat, bounty]);

  const ongoing  = combat?.status === 'ONGOING';
  const btnOff   = !ongoing || loading;
  const intOk    = bounty >= 1000;
  const intSub   = !intOk ? 'NEED 1,000 BOUNTY' : bounty >= 10000 ? '30 MORALE DMG · SAFE' : '10 MORALE DMG';
  const round    = combat?.round ?? 1;
  const typeColor = island ? (TYPE_COLORS[island.type] || '#00f5d4') : '#00f5d4';
  const poster   = JSON.parse(localStorage.getItem('wantedPoster') || 'null');

  // Pass enemy label to scene once island loaded
  useEffect(() => {
    if (island && phaserRef.current)
      phaserRef.current.events.emit('setEnemyLabel', island.name.toUpperCase().slice(0,14));
  }, [island]);

  return (
    <div style={{
      width:'100vw', height:'100vh', overflow:'hidden', position:'relative',
      fontFamily:MONO, background:'#010408',
      animation: shake ? 'screenShake 0.42s ease' : 'none',
    }}>

      {/* Phaser canvas */}
      <div ref={gameRef} style={{ position:'absolute', inset:0, zIndex:0 }} />

      {/* ══ TOP BAR ═══════════════════════════════════════════════════════════ */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:'62px',
        background:'linear-gradient(180deg,rgba(1,3,10,0.98) 0%,rgba(1,3,10,0.82) 65%,transparent 100%)',
        display:'flex', alignItems:'center', padding:'0 28px', gap:'20px', zIndex:30,
        borderBottom:`1px solid ${typeColor}18`,
      }}>
        {/* Island info left */}
        <div style={{ flex:1, overflow:'hidden', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'6px',height:'6px',borderRadius:'50%',background:typeColor,boxShadow:`0 0 8px ${typeColor}`,flexShrink:0 }} />
            <span style={{ color:'#ddeeff', fontWeight:900, fontSize:'14px', letterSpacing:'2px', whiteSpace:'nowrap' }}>
              {island?.name || '——'}
            </span>
            {island?.type && (
              <span style={{ color:typeColor, fontSize:'9px', letterSpacing:'4px', opacity:0.8 }}>{island.type}</span>
            )}
          </div>
          <div style={{ color:'#6a8a9a', fontSize:'11px', fontStyle:'italic', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:'2px', paddingLeft:'14px' }}>
            {island?.lore || ''}
          </div>
        </div>

        {/* Round indicator center */}
        <div style={{ textAlign:'center', flexShrink:0, padding:'0 8px' }}>
          <div style={{ color:'#ffd700', fontSize:'12px', letterSpacing:'8px', fontWeight:900, textShadow:'0 0 15px #ffd70066' }}>ROUND {round}</div>
          <div style={{ color:'#5a7a8a', fontSize:'9px', letterSpacing:'3px', marginTop:'1px' }}>ENCOUNTER</div>
        </div>

        {/* Retreat right */}
        <button
          onClick={() => navigate('/world')}
          style={{
            background:'transparent', border:'1px solid rgba(255,68,102,0.25)',
            color:'#aa3355', fontFamily:MONO, fontSize:'11px',
            padding:'6px 18px', cursor:'pointer', flexShrink:0,
            letterSpacing:'3px', transition:'all 0.18s',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.borderColor='#ff4466'; e.currentTarget.style.color='#ff4466'; e.currentTarget.style.boxShadow='0 0 16px #ff446633'; }}
          onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,68,102,0.25)'; e.currentTarget.style.color='#aa3355'; e.currentTarget.style.boxShadow='none'; }}
        >← RETREAT</button>
      </div>

      {/* ══ HP BARS (floating above action bar) ══════════════════════════════ */}
      {combat && (
        <div style={{
          position:'absolute', bottom:'145px', left:'50%', transform:'translateX(-50%)',
          width:'600px', zIndex:30,
          display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          padding:'0 8px', pointerEvents:'none',
        }}>
          <HealthBar label="YOU" hp={combat.playerHealth} maxHp={100} color="#00f5d4" side="left" />
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' }}>
            <span style={{ color:'#334455', fontSize:'9px', letterSpacing:'3px' }}>VS</span>
          </div>
          <HealthBar label={island?.name?.toUpperCase().slice(0,12)||'ENEMY'} hp={combat.enemyHealth} maxHp={100} color={typeColor} side="right" />
        </div>
      )}

      {/* ══ COMBAT LOG ════════════════════════════════════════════════════════ */}
      <div style={{
        position:'absolute', bottom:'250px', left:'50%', transform:'translateX(-50%)',
        width:'600px', zIndex:30,
        display:'flex', flexDirection:'column', gap:'2px',
        pointerEvents:'none',
      }}>
        {log.map((line, i) => <LogLine key={`${line}-${i}`} text={line} index={i} />)}
      </div>

      {/* ══ PROCESSING INDICATOR ═════════════════════════════════════════════ */}
      {loading && (
        <div style={{
          position:'absolute', bottom:'248px', left:'50%', transform:'translateX(-50%)',
          color:'#00f5d4', fontSize:'10px', letterSpacing:'6px', zIndex:31,
          animation:'blink 0.5s ease-in-out infinite', whiteSpace:'nowrap',
          textShadow:'0 0 10px #00f5d4',
        }}>▸ ▸ ▸  COMBAT PROCESSING</div>
      )}

      {/* ══ ACTION BAR ════════════════════════════════════════════════════════ */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:'138px',
        background:'linear-gradient(0deg,rgba(1,3,10,0.99) 0%,rgba(1,3,10,0.92) 50%,transparent 100%)',
        display:'flex', alignItems:'center', justifyContent:'center',
        gap:'18px', zIndex:30, paddingBottom:'14px',
        borderTop:`1px solid ${typeColor}0a`,
      }}>
        <ActionBtn icon="⚔️"  label="ATTACK"     hotkey="1" color="#00f5d4" sub="15–25 DMG · 10–20 RECEIVED"   disabled={btnOff}        onClick={() => takeTurn('ATTACK')} />
        <div style={{ width:'1px',height:'55px',background:'linear-gradient(180deg,transparent,rgba(0,245,212,0.08),transparent)' }} />
        <ActionBtn icon="👁"  label="INTIMIDATE" hotkey="2" color="#9b59b6" sub={intSub}                        disabled={btnOff||!intOk} onClick={() => takeTurn('INTIMIDATE')} />
        <div style={{ width:'1px',height:'55px',background:'linear-gradient(180deg,transparent,rgba(0,245,212,0.08),transparent)' }} />
        <ActionBtn icon="🤝" label="NEGOTIATE"  hotkey="3" color="#ffd700" sub="40% CHANCE · HALF REWARD"      disabled={btnOff}        onClick={() => takeTurn('NEGOTIATE')} />
      </div>

      {/* ══ ERROR ════════════════════════════════════════════════════════════ */}
      {error && (
        <div style={{ position:'absolute',inset:0,background:'rgba(1,3,10,0.96)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:50,gap:'1.5rem' }}>
          <div style={{ color:'#ff4466',fontFamily:MONO,letterSpacing:'2px', fontSize:'13px', textAlign:'center', maxWidth:'380px', lineHeight:1.8 }}>{error}</div>
          <button style={{ background:'transparent',border:'1px solid #00f5d4',color:'#00f5d4',padding:'0.75rem 2.2rem',fontFamily:MONO,cursor:'pointer',letterSpacing:'3px',fontSize:'12px',transition:'all 0.18s' }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='0 0 28px #00f5d455'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
            onClick={()=>navigate('/world')}>← BACK TO OCEAN</button>
        </div>
      )}

      {/* ══ VICTORY OVERLAY ══════════════════════════════════════════════════ */}
      {overlay === 'victory' && (
        <div style={{
          position:'absolute',inset:0,
          background:'radial-gradient(ellipse at 50% 40%,rgba(0,40,30,0.97) 0%,rgba(1,4,10,0.99) 65%)',
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          zIndex:50,gap:'10px',animation:'fadeOverlay 0.7s ease',
        }}>
          {/* scanline effect */}
          <div style={{ position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)',pointerEvents:'none',opacity:0.4 }} />
          <div style={{ width:'200px',height:'1px',background:'linear-gradient(90deg,transparent,#ffd700,transparent)' }} />
          <p style={{ fontFamily:MONO,fontSize:'10px',color:'#4a6a3a',letterSpacing:'12px',margin:0 }}>ISLAND CLAIMED</p>
          <h1 style={{ fontFamily:MONO,fontSize:'72px',fontWeight:900,color:'#ffd700',margin:'4px 0',letterSpacing:'0.15em',textShadow:'0 0 80px #ffd700aa,0 0 160px #ffd70033,0 4px 0 #aa8800' }}>
            VICTORY
          </h1>
          <div style={{ display:'flex',alignItems:'center',gap:'12px' }}>
            <div style={{ width:'60px',height:'1px',background:'linear-gradient(90deg,transparent,#ffd70055)' }} />
            <p style={{ fontFamily:MONO,fontSize:'24px',color:'#ffd700',margin:0,textShadow:'0 0 25px #ffd70066',fontWeight:900 }}>
              +{(combat?.bountyChange||0).toLocaleString()} ₦
            </p>
            <div style={{ width:'60px',height:'1px',background:'linear-gradient(90deg,#ffd70055,transparent)' }} />
          </div>
          <p style={{ fontFamily:MONO,fontSize:'13px',color:'#00f5d4',fontStyle:'italic',margin:0,letterSpacing:'2px',textShadow:'0 0 12px #00f5d444' }}>
            {island?.name} bows to your flag.
          </p>
          <div style={{ width:'200px',height:'1px',background:'linear-gradient(90deg,transparent,#00f5d433,transparent)',margin:'6px 0' }} />
          {poster && <WantedPoster player={poster} />}
          <button
            style={{
              background:'linear-gradient(135deg,rgba(0,245,212,0.14),rgba(0,245,212,0.06))',
              border:'1px solid #00f5d4',color:'#00f5d4',
              padding:'11px 40px',fontFamily:MONO,fontSize:'13px',
              cursor:'pointer',letterSpacing:'5px',marginTop:'10px',
              boxShadow:'0 0 32px #00f5d444',transition:'all 0.18s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 0 60px #00f5d477';e.currentTarget.style.transform='translateY(-2px)';}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 0 32px #00f5d444';e.currentTarget.style.transform='none';}}
            onClick={()=>navigate('/world')}
          >⚓ CLAIM THE OCEAN</button>
        </div>
      )}

      {/* ══ DEFEAT OVERLAY ════════════════════════════════════════════════════ */}
      {overlay === 'defeat' && (
        <div style={{
          position:'absolute',inset:0,
          background:'radial-gradient(ellipse at 50% 40%,rgba(30,0,8,0.98) 0%,rgba(1,3,10,0.99) 65%)',
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          zIndex:50,gap:'10px',animation:'fadeOverlay 0.7s ease',
        }}>
          <div style={{ position:'absolute',inset:0,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.18) 2px,rgba(0,0,0,0.18) 4px)',pointerEvents:'none',opacity:0.5 }} />
          <div style={{ width:'200px',height:'1px',background:'linear-gradient(90deg,transparent,#ff4466,transparent)' }} />
          <p style={{ fontFamily:MONO,fontSize:'10px',color:'#5a1a2a',letterSpacing:'12px',margin:0 }}>BATTLE LOST</p>
          <h1 style={{ fontFamily:MONO,fontSize:'72px',fontWeight:900,color:'#ff4466',margin:'4px 0',letterSpacing:'0.15em',textShadow:'0 0 80px #ff4466aa,0 0 160px #ff446633,0 4px 0 #881122' }}>
            DEFEATED
          </h1>
          <div style={{ display:'flex',alignItems:'center',gap:'12px' }}>
            <div style={{ width:'60px',height:'1px',background:'linear-gradient(90deg,transparent,#ff446655)' }} />
            <p style={{ fontFamily:MONO,fontSize:'20px',color:'#ff4466',margin:0,fontWeight:900 }}>
              − {Math.abs(combat?.bountyChange||0).toLocaleString()} ₦ LOST
            </p>
            <div style={{ width:'60px',height:'1px',background:'linear-gradient(90deg,#ff446655,transparent)' }} />
          </div>
          <p style={{ fontFamily:MONO,fontSize:'12px',color:'#7a4a5a',fontStyle:'italic',margin:0,letterSpacing:'2px',maxWidth:'360px',textAlign:'center',lineHeight:1.8 }}>
            The ocean does not forgive weakness. Your name fades with the tide.
          </p>
          <div style={{ width:'200px',height:'1px',background:'linear-gradient(90deg,transparent,#ff446633,transparent)',margin:'6px 0' }} />
          <div style={{ display:'flex',gap:'16px',marginTop:'6px' }}>
            <button
              style={{ background:'linear-gradient(135deg,rgba(255,68,102,0.12),rgba(255,68,102,0.04))',border:'1px solid #ff446699',color:'#ff4466',padding:'11px 30px',fontFamily:MONO,fontSize:'12px',cursor:'pointer',letterSpacing:'3px',transition:'all 0.18s' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 0 32px #ff446655';e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none';}}
              onClick={()=>window.location.reload()}
            >🔄 TRY AGAIN</button>
            <button
              style={{ background:'linear-gradient(135deg,rgba(0,245,212,0.08),rgba(0,245,212,0.02))',border:'1px solid #00f5d444',color:'#00f5d4',padding:'11px 30px',fontFamily:MONO,fontSize:'12px',cursor:'pointer',letterSpacing:'3px',transition:'all 0.18s' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 0 32px #00f5d444';e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none';}}
              onClick={()=>navigate('/world')}
            >← BACK TO OCEAN</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes logSlideIn   { from{opacity:0;transform:translateX(-10px);}to{opacity:1;transform:none;} }
        @keyframes blink        { 0%,100%{opacity:1;}50%{opacity:0.2;} }
        @keyframes fadeOverlay  { from{opacity:0;}to{opacity:1;} }
        @keyframes hpPulse      { 0%,100%{opacity:1;}50%{opacity:0.4;} }
        @keyframes screenShake  {
          0%{transform:none} 15%{transform:translate(-4px,2px) rotate(-0.3deg)}
          30%{transform:translate(4px,-2px) rotate(0.2deg)} 50%{transform:translate(-3px,1px)}
          70%{transform:translate(3px,-1px)} 85%{transform:translate(-1px,1px)} 100%{transform:none}
        }
        * { box-sizing:border-box; }
      `}</style>
    </div>
  );
}
