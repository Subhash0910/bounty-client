import * as PIXI from 'pixi.js';
import EventBus from './EventBus.js';

// ─────────────────────────────────────────────────────────────────────────────
//  PixiStage  —  Full living-ship combat renderer
//  Features:
//    • Procedural pirate ships with crew, cannons, rigging, sails
//    • Per-frame animations: sail billow, crew wander, mast sway, wake
//    • On-attack: cannon recoil + smoke, hull flash, ship lurch (spring)
//    • Damage numbers floating off the impact point
//    • Hull damage cracks accumulate over time
//    • Screen red-vignette pulse on player hit
//    • All destroy() guards so React fast-nav never crashes
// ─────────────────────────────────────────────────────────────────────────────
export default class PixiStage {
  constructor(canvas) {
    this.canvas       = canvas;
    this.app          = null;
    this.ships        = {};          // { player, enemy }  → ShipData objects
    this.ready        = false;
    this._destroyed   = false;
    this._initPromise = this._init();
  }

  // ── ShipData structure ────────────────────────────────────────────────────
  // Each entry in this.ships is:
  // { root, hull, sails[], cannons[], crew[], mastContainers[],
  //   anchor:{x,y}, spring:{vx,dx}, hpPct:1, crackGraphics }

  async _init() {
    this.app = new PIXI.Application();
    await this.app.init({
      canvas: this.canvas,
      width:  window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });
    if (this._destroyed) { try { this.app.destroy(); } catch (_) {} return; }

    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.ready = true;

    this._buildScene();
    this._bindEvents();
    this._startMasterTicker();

    this._resizeHandler = () => {
      this.W = window.innerWidth; this.H = window.innerHeight;
      if (this.app?.renderer) this.app.renderer.resize(this.W, this.H);
      this._repositionShips();
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  _guard(fn) {
    if (this._destroyed) return;
    if (this.ready) { fn(); return; }
    this._initPromise.then(() => { if (!this._destroyed) fn(); });
  }

  // ── Scene setup ────────────────────────────────────────────────────────────
  _buildScene() {
    const W = this.W, H = this.H;
    const shipH = Math.min(H * 0.44, 260);

    this.ships.player = this._buildShip(false, shipH,  W * 0.22, H * 0.54);
    this.ships.enemy  = this._buildShip(true,  shipH,  W * 0.78, H * 0.54);

    // screen vignette overlay (used for red-flash on player hit)
    this._vignette = new PIXI.Graphics();
    this._vignette.setDepth = () => {};
    this.app.stage.addChild(this._vignette);
    this._vignetteAlpha = 0;
  }

  // ── Master ticker  (one loop for everything) ────────────────────────────
  _startMasterTicker() {
    this._tick = 0;
    this.app.ticker.add(() => {
      if (this._destroyed) return;
      this._tick += 0.016;
      const t = this._tick;

      ['player', 'enemy'].forEach(k => {
        const sd = this.ships[k];
        if (!sd) return;

        // ── idle bob + roll ──
        const phase = k === 'enemy' ? 1.3 : 0;
        sd.root.y        = sd.anchor.y + Math.sin(t + phase) * 7;
        sd.root.rotation = Math.sin(t * 0.65 + phase) * 0.020;

        // ── spring recoil (applied as X offset) ──
        const sp = sd.spring;
        sp.dx += sp.vx;
        sp.vx += (-sp.dx * 0.28) - (sp.vx * 0.55);  // spring + damping
        sd.root.x = sd.anchor.x + sp.dx;

        // ── mast sway ──
        sd.mastContainers.forEach((mc, i) => {
          mc.rotation = Math.sin(t * (0.7 + i * 0.15) + phase) * 0.018;
        });

        // ── dynamic sail billow ──
        sd.sailGraphics.forEach((sg, i) => {
          if (!sg || !sg.parent) return;
          const bulge = 0.88 + Math.sin(t * (1.1 + i * 0.2) + phase) * 0.12;
          sg.scale.x = bulge;
        });

        // ── crew wander ──
        sd.crew.forEach((cw, i) => {
          if (!cw || !cw.parent) return;
          const s = this._s(sd);
          cw.x += cw._vx * 0.4;
          if (cw.x > 35 * s || cw.x < -35 * s) cw._vx *= -1;
          // subtle head bob
          cw._headBob = (cw._headBob || 0) + 0.07;
          if (cw._head) cw._head.y = -21 * s * 0.85 - Math.abs(Math.sin(cw._headBob)) * 1.2;
        });

        // ── lantern flicker ──
        if (sd.lantern) {
          sd.lantern.alpha = 0.65 + Math.sin(t * 4.5 + phase * 3) * 0.28;
        }
      });

      // ── vignette fade ──
      if (this._vignetteAlpha > 0) {
        this._vignetteAlpha = Math.max(0, this._vignetteAlpha - 0.04);
        this._drawVignette(this._vignetteAlpha);
      }
    });
  }

  _s(sd) { return sd._scale; }   // helper: get scale factor of a ship

  // ── Full ship builder ──────────────────────────────────────────────────
  _buildShip(enemy, shipH, ax, ay) {
    const s   = shipH / 300;
    const fl  = enemy ? -1 : 1;
    const root = new PIXI.Container();
    root.x = ax; root.y = ay;
    this.app.stage.addChild(root);

    // Palettes
    const C = enemy ? {
      hullDk: 0x5a1a1a, hullMd: 0x8b3030, hullLt: 0xb04040,
      wood:   0x6b3520, woodMd: 0x9b5530,
      sail:   0xc8a080, sailSh: 0x8a6050,
      flag:   0xcc2222, rope:   0xaa9966,
    } : {
      hullDk: 0x1a3a2a, hullMd: 0x2a5a3a, hullLt: 0x3a7a50,
      wood:   0x4a2e18, woodMd: 0x7a4e28,
      sail:   0xe8d8b0, sailSh: 0xb0a080,
      flag:   0x009955, rope:   0xaa9966,
    };

    // ── WATER REFLECTION ──
    const refl = new PIXI.Graphics();
    refl.fill({ color: C.hullMd, alpha: 0.15 });
    refl.moveTo(-70*s*fl, 8*s);
    refl.bezierCurveTo(-90*s*fl,22*s, -55*s*fl,46*s, 0,52*s);
    refl.bezierCurveTo( 55*s*fl,46*s,  90*s*fl,22*s, 70*s*fl,8*s);
    refl.closePath();
    root.addChild(refl);

    // ── HULL  ──
    const hull = new PIXI.Container();
    root.addChild(hull);

    const hullG = new PIXI.Graphics();
    // dark outer
    hullG.fill({ color: C.hullDk });
    hullG.moveTo(-72*s*fl,-8*s);
    hullG.bezierCurveTo(-90*s*fl,12*s,-76*s*fl,40*s,-48*s*fl,54*s);
    hullG.lineTo(48*s*fl,54*s);
    hullG.bezierCurveTo(76*s*fl,40*s,90*s*fl,12*s,72*s*fl,-8*s);
    hullG.closePath();
    // mid colour
    hullG.fill({ color: C.hullMd });
    hullG.moveTo(-68*s*fl,-8*s);
    hullG.bezierCurveTo(-83*s*fl,10*s,-72*s*fl,36*s,-45*s*fl,50*s);
    hullG.lineTo(45*s*fl,50*s);
    hullG.bezierCurveTo(72*s*fl,36*s,83*s*fl,10*s,68*s*fl,-8*s);
    hullG.closePath();
    // highlight
    hullG.fill({ color: C.hullLt, alpha:0.45 });
    hullG.moveTo(-60*s*fl,-8*s);
    hullG.bezierCurveTo(-70*s*fl,2*s,-62*s*fl,14*s,-40*s*fl,18*s);
    hullG.lineTo(40*s*fl,18*s);
    hullG.bezierCurveTo(62*s*fl,14*s,70*s*fl,2*s,60*s*fl,-8*s);
    hullG.closePath();
    hull.addChild(hullG);

    // plank lines
    const planksG = new PIXI.Graphics();
    planksG.setStrokeStyle({ width:0.8*s, color:C.hullDk, alpha:0.55 });
    for (let i=0;i<4;i++) { const py=-2*s+i*13*s, xo=10*s*i; planksG.moveTo((-60+xo)*s*fl,py); planksG.lineTo((60-xo)*s*fl,py); planksG.stroke(); }
    hull.addChild(planksG);

    // crack overlay (filled in as hp drops)
    const crackG = new PIXI.Graphics();
    hull.addChild(crackG);

    // ── CANNON PORTS ──
    const cannonContainer = new PIXI.Container();
    hull.addChild(cannonContainer);
    const cannonDefs = [-38,-16,10,32];
    const cannonObjs = cannonDefs.map(px => {
      const cc = new PIXI.Container();
      cc.x = px*s*fl; cc.y = 4*s;
      // port hole
      const port = new PIXI.Graphics();
      port.fill({ color:0x111111 }); port.ellipse(0,0,5.5*s,4*s);
      cc.addChild(port);
      // barrel
      const barrel = new PIXI.Graphics();
      barrel.fill({ color:0x444444 });
      barrel.rect(enemy ? 0 : -7*s, -1.8*s, 7*s, 3.6*s);
      barrel.fill({ color:0x222222 });
      barrel.rect(enemy ? 0 : -7*s, -1.8*s, 2*s, 3.6*s);
      cc.addChild(barrel);
      cc._barrel = barrel;
      cc._restX  = 0;
      cannonContainer.addChild(cc);
      return cc;
    });

    // ── DECK ──
    const deckG = new PIXI.Graphics();
    deckG.fill({ color:C.woodMd });
    deckG.moveTo(-65*s*fl,-12*s); deckG.lineTo(65*s*fl,-12*s);
    deckG.lineTo(55*s*fl,-22*s); deckG.lineTo(-55*s*fl,-22*s); deckG.closePath();
    deckG.setStrokeStyle({ width:0.6*s, color:C.wood, alpha:0.8 });
    for (let i=-4;i<=4;i++) { deckG.moveTo(i*14*s*fl,-22*s); deckG.lineTo(i*16*s*fl,-12*s); deckG.stroke(); }
    root.addChild(deckG);

    // ── STERN ──
    const sternG = new PIXI.Graphics();
    sternG.fill({ color:C.hullDk });
    sternG.moveTo(52*s*fl,-22*s); sternG.lineTo(70*s*fl,-22*s);
    sternG.lineTo(70*s*fl,-54*s); sternG.lineTo(52*s*fl,-54*s); sternG.closePath();
    sternG.fill({ color:C.woodMd });
    sternG.moveTo(54*s*fl,-24*s); sternG.lineTo(68*s*fl,-24*s);
    sternG.lineTo(68*s*fl,-52*s); sternG.lineTo(54*s*fl,-52*s); sternG.closePath();
    sternG.fill({ color:0xffe090, alpha:0.7 });
    sternG.rect(57*s*fl-(enemy?8*s:0),-47*s,7*s,5*s);
    sternG.rect(57*s*fl-(enemy?8*s:0),-38*s,7*s,5*s);
    root.addChild(sternG);

    // lantern glow
    const lanternG = new PIXI.Graphics();
    lanternG.fill({ color:0xffe090, alpha:0.85 }); lanternG.circle(64*s*fl,-57*s,4*s);
    lanternG.fill({ color:0xffd060, alpha:0.22 }); lanternG.circle(64*s*fl,-57*s,12*s);
    root.addChild(lanternG);

    // ── BOWSPRIT ──
    const bowG = new PIXI.Graphics();
    bowG.fill({ color:C.woodMd });
    bowG.moveTo(-54*s*fl,-22*s); bowG.lineTo(-102*s*fl,-57*s);
    bowG.lineTo(-98*s*fl,-60*s); bowG.lineTo(-50*s*fl,-26*s); bowG.closePath();
    root.addChild(bowG);

    // ── MASTS (as containers so they can sway) ──
    const mastContainers = [];
    const sailGraphics   = [];

    const addMast = (mx, mastH, yardWidths) => {
      const mc = new PIXI.Container();
      mc.x = mx; mc.y = -22*s;
      root.addChild(mc);
      mastContainers.push(mc);

      const mg = new PIXI.Graphics();
      mg.fill({ color:C.wood });
      mg.rect(-3.5*s, -mastH, 7*s, mastH);       // pole
      mg.fill({ color:C.woodMd });
      yardWidths.forEach((w,i) => {
        const yy = -mastH + i * (mastH / (yardWidths.length + 0.5));
        mg.rect(-w*s, yy, w*2*s, 4*s);
      });
      mc.addChild(mg);

      // crow's nest on first mast
      if (mx === 0) {
        const nestG = new PIXI.Graphics();
        nestG.fill({ color:C.wood });
        nestG.rect(-10*s, -mastH-8*s, 20*s, 10*s);
        mc.addChild(nestG);
        // tiny watchman in nest
        const wm = _makeCrewFigure(s, C, 0, -mastH-8*s, 0.6);
        mc.addChild(wm);
      }

      // sails
      yardWidths.forEach((w,i) => {
        const sg = new PIXI.Graphics();
        const yy = -mastH + i * (mastH / (yardWidths.length + 0.5));
        const nextY = -mastH + (i+1) * (mastH / (yardWidths.length + 0.5));
        const sailH = (nextY - yy) * 0.88;
        sg.fill({ color:C.sail, alpha:0.90 });
        sg.moveTo(-w*s, yy+4*s);
        sg.bezierCurveTo(-(w+8)*s, yy+4*s+sailH*0.4, (w+8)*s, yy+4*s+sailH*0.4, w*s, yy+4*s);
        sg.lineTo(w*s, yy+sailH);
        sg.bezierCurveTo((w+6)*s, yy+sailH*0.7, -(w+6)*s, yy+sailH*0.7, -w*s, yy+sailH);
        sg.closePath();
        sg.fill({ color:C.sailSh, alpha:0.30 });
        sg.moveTo(-w*s, yy+4*s);
        sg.bezierCurveTo(-w*s, yy+sailH*0.5, 0, yy+sailH*0.6, 0, yy+sailH*0.62);
        sg.lineTo(0, yy+4*s); sg.closePath();
        // seams
        sg.setStrokeStyle({ width:0.6*s, color:0x776655, alpha:0.4 });
        for (let si=1;si<3;si++) { const sy=yy+4*s+(sailH-4*s)*si/3; sg.moveTo(-w*0.7*s,sy); sg.lineTo(w*0.7*s,sy); sg.stroke(); }
        mc.addChild(sg);
        sailGraphics.push(sg);
      });

      // jib/stay sail (only on main mast)
      if (mx === 0) {
        const jib = new PIXI.Graphics();
        jib.fill({ color:C.sail, alpha:0.72 });
        jib.moveTo(0,-mastH); jib.lineTo(-102*s*fl,-57*s+22*s); jib.lineTo(-24*s*fl,-22*s-80*s+22*s); jib.closePath();
        mc.addChild(jib);
      }

      // flag
      const flagG = new PIXI.Graphics();
      flagG.fill({ color:C.flag, alpha:0.92 });
      flagG.moveTo(0,-mastH-10*s); flagG.lineTo(22*s*fl,-mastH); flagG.lineTo(0,-mastH+8*s); flagG.closePath();
      flagG.fill({ color:0xffffff, alpha:0.85 }); flagG.circle(8*s*fl,-mastH-2*s,4*s);
      flagG.fill({ color:C.flag }); flagG.circle(6*s*fl,-mastH-3*s,1.3*s); flagG.circle(10*s*fl,-mastH-3*s,1.3*s);
      mc.addChild(flagG);

      return mc;
    };

    addMast(0,    175*s, [44, 36, 26]);          // main mast  (3 yards)
    addMast(-26*s*fl, 140*s, [34, 24]);          // fore mast  (2 yards)

    // ── RIGGING ──
    const rigG = new PIXI.Graphics();
    rigG.setStrokeStyle({ width:1*s, color:C.rope, alpha:0.6 });
    [[-52,-12],[52,-12]].forEach(([rx,ry]) => { rigG.moveTo(0,-197*s); rigG.lineTo(rx*s*fl,ry*s); rigG.stroke(); });
    rigG.moveTo(0,-193*s); rigG.lineTo(-26*s*fl,-162*s); rigG.stroke();
    rigG.moveTo(-26*s*fl,-162*s); rigG.lineTo(-50*s*fl,-22*s); rigG.stroke();
    rigG.moveTo(0,-138*s); rigG.lineTo(60*s*fl,-22*s); rigG.stroke();
    rigG.setStrokeStyle({ width:0.55*s, color:C.rope, alpha:0.35 });
    for (let i=0;i<5;i++) { const ry=-12*s-i*32*s, w=10+i*9; rigG.moveTo(-(w+2)*s*fl,ry); rigG.lineTo(-(w-8)*s*fl,ry); rigG.stroke(); }
    root.addChild(rigG);

    // ── CREW (3 on deck + 1 in crow's nest added above) ──
    const crewMembers = [];
    [-30,0,28].forEach((cx,ci) => {
      const cw = _makeCrewFigure(s, C, cx*s*fl, -22*s, 1.0);
      cw._vx = (ci % 2 === 0 ? 0.18 : -0.15) * (enemy ? -1 : 1);
      cw._headBob = ci * 0.8;
      root.addChild(cw);
      crewMembers.push(cw);
    });

    const shipData = {
      root,
      hull,
      hullG,
      crackG,
      sailGraphics,
      mastContainers,
      cannons: cannonObjs,
      crew: crewMembers,
      lantern: lanternG,
      anchor: { x: ax, y: ay },
      spring: { vx: 0, dx: 0 },
      hpPct: 1,
      _scale: s,
      _flip: fl,
      _enemy: enemy,
      _C: C,
    };
    return shipData;
  }

  _repositionShips() {
    ['player','enemy'].forEach(k => {
      const sd = this.ships[k];
      if (!sd) return;
      sd.anchor.x = k==='player' ? this.W*0.22 : this.W*0.78;
      sd.anchor.y = this.H*0.54;
      sd.root.x = sd.anchor.x;
      sd.root.y = sd.anchor.y;
    });
  }

  // ── Accessors for CombatPage ──────────────────────────────────────────────
  get _anchorPlayer() { return this.ships.player?.anchor; }
  get _anchorEnemy()  { return this.ships.enemy?.anchor;  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────

  // Call this from CombatPage after each turn to update visual hp damage
  updateHealth(who, hpPct) {
    this._guard(() => {
      const sd = this.ships[who];
      if (!sd) return;
      sd.hpPct = hpPct;
      this._drawCracks(sd);
    });
  }

  playAttack(fromPlayer, onImpact) {
    this._guard(() => {
      const from = fromPlayer ? this.ships.player : this.ships.enemy;
      const to   = fromPlayer ? this.ships.enemy  : this.ships.player;
      if (!from || !to) return;
      this._fireCannonSequence(from, to, fromPlayer ? 0x00f5d4 : 0xff4444, onImpact);
    });
  }

  playBoard() {
    this._guard(() => {
      const sd = this.ships.player;
      if (!sd) return;
      const ax = sd.anchor.x;
      this._tween(sd.root, { x: ax + 210 }, 380, 'easeIn', () => {
        this._drawGrappleLines(ax+210, sd.anchor.y, this.ships.enemy.anchor.x-40, this.ships.enemy.anchor.y);
        this._shakeShipSd(this.ships.player);
        this._shakeShipSd(this.ships.enemy);
        setTimeout(() => this._tween(sd.root,{x:ax},500,'easeOut'), 600);
      });
    });
  }

  playEvade(success) {
    this._guard(() => {
      const sd = this.ships.player;
      if (!sd) return;
      const ax = sd.anchor.x, ay = sd.anchor.y;
      if (success) {
        this._tween(sd.root,{x:ax-90,y:ay+50,rotation:-0.18},280,'easeIn',()=>{
          this._missShot(this.ships.enemy.anchor, {x:ax-90,y:ay+50});
          setTimeout(()=>this._tween(sd.root,{x:ax,y:ay,rotation:0},440,'easeOut'),200);
        });
      } else {
        this._shakeShipSd(sd);
        this._spawnText(ax, ay-60, '⛳ ANCHORED', '#ffaa00', 22);
      }
    });
  }

  playSabotage() {
    this._guard(() => {
      const from = this.ships.player.anchor, to = this.ships.enemy.anchor;
      const skiff = new PIXI.Graphics();
      skiff.fill({color:0x334455}); skiff.ellipse(0,0,14,6);
      skiff.x=from.x+60; skiff.y=from.y+80;
      this.app.stage.addChild(skiff);
      this._tween(skiff,{x:to.x-60,y:to.y+80},600,'linear',()=>{
        skiff.destroy();
        this._explode(to.x-40,to.y+60,0x9b59b6,30);
        this._shakeShipSd(this.ships.enemy);
        this._spawnText(to.x,to.y-70,'RATTLED','#9b59b6',18);
      });
    });
  }

  playNegotiate(success) {
    this._guard(() => {
      const anchor = this.ships.player.anchor;
      if (success) {
        for (let i=0;i<18;i++) setTimeout(()=>this._coinArc(this.ships.enemy.anchor,anchor),i*60);
        this._spawnText(this.W/2,this.H*0.32,'DEAL STRUCK','#ffd700',32);
      } else {
        this._spawnText(anchor.x,anchor.y-80,'REJECTED!','#ff4466',28);
        this._explode(anchor.x,anchor.y-60,0xffffff,15);
        setTimeout(()=>this.playAttack(false,()=>{}),300);
      }
    });
  }

  playTelegraph(stance) {
    this._guard(() => {
      const sd = this.ships.enemy;
      if (!sd) return;
      const ax = sd.anchor.x, ay = sd.anchor.y;
      if (stance==='AGGRESSIVE') {
        this._lurch(sd, -60, 400);
        this._tintShip(sd, 0xff4444, 500);
        this._spawnText(ax,ay-110,'LOADING ALL GUNS','#ff4444',13);
      } else if (stance==='DEFENSIVE') {
        this._shieldRing(ax,ay);
        this._spawnText(ax,ay-110,'FORMING BARRIER','#4a9eff',13);
      } else if (stance==='DESPERATE') {
        this._shakeShipSd(sd,14,10);
        this._smokeCloud(ax,ay+20);
        this._spawnText(ax,ay-110,"THEY'RE BREAKING—",'#ff8800',13);
      }
    });
  }

  playVictory() {
    this._guard(() => {
      const sd = this.ships.enemy;
      if (sd) this._tween(sd.root,{rotation:1.4,y:sd.anchor.y+180,alpha:0},1800,'easeIn');
      for (let i=0;i<40;i++) setTimeout(()=>this._coinFall(this.W*0.3+Math.random()*this.W*0.4,-20),i*80);
    });
  }

  playDefeat() {
    this._guard(() => {
      const sd = this.ships.player;
      if (sd) this._tween(sd.root,{rotation:0.5,y:sd.anchor.y+190,alpha:0},2000,'easeIn');
      this._vignetteAlpha = 1.5;
      for (let i=0;i<4;i++) setTimeout(()=>this._screenFlash(0xff0000,0.5),i*220);
    });
  }

  // ── Cannon fire sequence ──────────────────────────────────────────────────
  _fireCannonSequence(fromSd, toSd, color, onImpact) {
    if (!this.app) return;
    const cannonIdx = Math.floor(Math.random() * fromSd.cannons.length);
    const cannon    = fromSd.cannons[cannonIdx];
    const fromAnchor = fromSd.anchor;
    const toAnchor   = toSd.anchor;

    // 1. Cannon recoil
    if (cannon) {
      const recoilX = fromSd._flip * -12 * fromSd._scale;
      this._tween(cannon, { x: recoilX }, 80, 'easeIn', () => {
        this._tween(cannon, { x: 0 }, 280, 'easeOut');
      });
      // cannon smoke burst at barrel tip
      const bx = fromAnchor.x + cannon.x;
      const by = fromAnchor.y + cannon.y;
      this._cannonSmoke(bx, by, fromSd._flip);
    }

    // 2. Cannonball arc
    const ball = new PIXI.Graphics();
    ball.fill({color:0x333333}); ball.circle(0,0,7);
    ball.fill({color:0x888888}); ball.circle(-2,-2,3);
    ball.x = fromAnchor.x; ball.y = fromAnchor.y;
    this.app.stage.addChild(ball);

    const midX=(fromAnchor.x+toAnchor.x)/2;
    const midY=Math.min(fromAnchor.y,toAnchor.y)-100;
    const dur=460, t0=performance.now();
    const trail = [];
    const tick = () => {
      if (this._destroyed || !ball.parent) return;
      const t=Math.min((performance.now()-t0)/dur,1), inv=1-t;
      ball.x=inv*inv*fromAnchor.x+2*inv*t*midX+t*t*toAnchor.x;
      ball.y=inv*inv*fromAnchor.y+2*inv*t*midY+t*t*toAnchor.y;
      ball.rotation += 0.22;
      ball.scale.set(1-t*0.25);
      // leave trail puff
      if (Math.random()<0.35) {
        const puff = new PIXI.Graphics();
        puff.fill({color:0x888888,alpha:0.35}); puff.circle(0,0,4+Math.random()*4);
        puff.x=ball.x; puff.y=ball.y;
        this.app.stage.addChild(puff);
        trail.push(puff);
        const pt0=performance.now();
        const ptick=()=>{ if(this._destroyed||!puff.parent)return; const tp=Math.min((performance.now()-pt0)/400,1); puff.alpha=0.35*(1-tp); puff.scale.set(1+tp*1.5); if(tp<1)requestAnimationFrame(ptick);else puff.destroy(); };
        ptick();
      }
      if (t<1){requestAnimationFrame(tick);return;}
      ball.destroy();
      // 3. Impact
      this._explode(toAnchor.x,toAnchor.y,color,40);
      this._cannonSmoke(toAnchor.x,toAnchor.y,0);
      this._shakeShipSd(toSd, 12, 8);
      this._lurch(toSd, fromSd._flip * 28, 600);
      this._tintShip(toSd, 0xff2222, 200);
      // damage number
      const dmgNum = 10 + Math.floor(Math.random()*18);
      this._spawnText(toAnchor.x+(Math.random()-0.5)*60, toAnchor.y-80-Math.random()*40,
        `-${dmgNum}`, '#ff4466', 26);
      // screen vignette flash
      if (toSd._enemy===false) this._pulseVignette();
      EventBus.emit('cannonFired',{x:0,z:toSd._enemy?-15:15,color});
      EventBus.emit('cameraShake',{intensity:0.4,duration:350});
      onImpact?.();
    };
    tick();
  }

  // ── Hull crack damage overlay ─────────────────────────────────────────────
  _drawCracks(sd) {
    const g = sd.crackG;
    g.clear();
    const dmg = 1 - sd.hpPct;
    if (dmg < 0.15) return;
    const s = sd._scale;
    g.setStrokeStyle({ width: 1.2*s, color: 0x000000, alpha: Math.min(1, dmg * 1.4) });
    // procedural cracks based on damage level
    const cracks = [
      [[-20,0],[-30,16],[-20,28]],
      [[15,-4],[22,12],[18,30]],
      [[-8,10],[-18,24],[-26,38]],
      [[28,5],[22,20],[30,35]],
      [[-35,18],[-28,32],[-35,42]],
    ];
    const count = Math.ceil(dmg * cracks.length);
    for (let i=0;i<count;i++) {
      const pts = cracks[i];
      g.moveTo(pts[0][0]*s*sd._flip, pts[0][1]*s);
      pts.slice(1).forEach(p => g.lineTo(p[0]*s*sd._flip, p[1]*s));
      g.stroke();
    }
    // hull darkening
    g.fill({ color:0x000000, alpha: dmg * 0.28 });
    g.moveTo(-68*s*sd._flip,-8*s);
    g.bezierCurveTo(-83*s*sd._flip,10*s,-72*s*sd._flip,36*s,-45*s*sd._flip,50*s);
    g.lineTo(45*s*sd._flip,50*s);
    g.bezierCurveTo(72*s*sd._flip,36*s,83*s*sd._flip,10*s,68*s*sd._flip,-8*s);
    g.closePath();
  }

  // ── Spring lurch ─────────────────────────────────────────────────────────
  _lurch(sd, impulse, _dur) {
    if (!sd) return;
    sd.spring.vx += impulse * 0.09;
  }

  // ── Tint flash ────────────────────────────────────────────────────────────
  _tintShip(sd, color, dur) {
    if (!sd?.hullG) return;
    sd.hullG.tint = color;
    setTimeout(() => { if (!this._destroyed && sd.hullG) sd.hullG.tint = 0xffffff; }, dur);
  }

  // ── Red vignette ─────────────────────────────────────────────────────────
  _pulseVignette() {
    this._vignetteAlpha = Math.min(1.2, this._vignetteAlpha + 0.9);
  }
  _drawVignette(alpha) {
    if (!this.app || !this._vignette) return;
    const g = this._vignette;
    g.clear();
    if (alpha <= 0) return;
    const W = this.W, H = this.H;
    const steps = 12;
    for (let i=0;i<steps;i++) {
      const t = i/steps;
      g.fill({ color:0xff0000, alpha: alpha * (1-t) * 0.35 });
      const pad = t * W * 0.35;
      g.rect(0,0,W*pad/(W*0.35),H);
      g.rect(W-W*pad/(W*0.35),0,W*pad/(W*0.35),H);
      g.rect(0,0,W,H*pad/(H*0.35));
      g.rect(0,H-H*pad/(H*0.35),W,H*pad/(H*0.35));
    }
  }

  // ── Cannon smoke ─────────────────────────────────────────────────────────
  _cannonSmoke(x, y, dir) {
    if (!this.app || this._destroyed) return;
    for (let i=0;i<10;i++) {
      setTimeout(() => {
        if (this._destroyed||!this.app) return;
        const g = new PIXI.Graphics();
        g.fill({color:0xaaaaaa,alpha:0.55}); g.circle(0,0,6+Math.random()*10);
        g.x = x+(Math.random()-0.5)*16; g.y = y+(Math.random()-0.5)*10;
        this.app.stage.addChild(g);
        const vx=(dir*(1.5+Math.random()*2.5)), vy=(-1-Math.random()*2);
        const t0=performance.now();
        const tick=()=>{
          if(this._destroyed||!g.parent)return;
          const tp=Math.min((performance.now()-t0)/900,1);
          g.x+=vx; g.y+=vy; g.scale.set(1+tp*2.5); g.alpha=0.5*(1-tp);
          if(tp<1)requestAnimationFrame(tick);else g.destroy();
        }; tick();
      },i*28);
    }
  }

  // ── FX helpers ────────────────────────────────────────────────────────────
  _missShot(from, nearTo) {
    this._fireBall(from,{x:nearTo.x-80,y:nearTo.y+120},0xff4444,()=>
      this._spawnText(nearTo.x-30,nearTo.y-30,'MISSED','#ffffff44',12));
  }
  _fireBall(from,to,color,onImpact) {
    if(!this.app)return;
    const ball=new PIXI.Graphics();
    ball.fill({color});ball.circle(0,0,9);
    ball.x=from.x;ball.y=from.y;
    this.app.stage.addChild(ball);
    const midX=(from.x+to.x)/2,midY=Math.min(from.y,to.y)-90;
    const dur=440,t0=performance.now();
    const tick=()=>{
      if(this._destroyed||!ball.parent)return;
      const t=Math.min((performance.now()-t0)/dur,1),i=1-t;
      ball.x=i*i*from.x+2*i*t*midX+t*t*to.x;
      ball.y=i*i*from.y+2*i*t*midY+t*t*to.y;
      ball.scale.set(1-t*0.3);
      if(t<1){requestAnimationFrame(tick);return;}
      ball.destroy();
      this._explode(to.x,to.y,color,35);
      onImpact?.();
    };tick();
  }
  _explode(x,y,color,count=28,dur=0.6) {
    if(!this.app||this._destroyed)return;
    for(let i=0;i<count;i++){
      const g=new PIXI.Graphics();
      g.fill({color});g.circle(0,0,3+Math.random()*9);
      g.x=x;g.y=y;this.app.stage.addChild(g);
      const angle=Math.random()*Math.PI*2,speed=40+Math.random()*120;
      const vx=Math.cos(angle)*speed,vy=Math.sin(angle)*speed-60;
      const gravity=80+Math.random()*60;
      const life=(dur*0.6+Math.random()*dur*0.8)*1000,t0=performance.now();
      const tick=()=>{
        if(this._destroyed||!g.parent)return;
        const el=(performance.now()-t0)/1000;
        if(el>life/1000){g.destroy();return;}
        const tp=el/(life/1000);
        g.x=x+vx*el;g.y=y+vy*el+0.5*gravity*el*el;
        g.alpha=1-tp;g.scale.set(1-tp*0.7);requestAnimationFrame(tick);
      };tick();
    }
    for(let i=0;i<5;i++){
      const sm=new PIXI.Graphics();
      sm.fill({color:0x334455,alpha:0.5});sm.circle(0,0,12+Math.random()*14);
      sm.x=x+(Math.random()-0.5)*24;sm.y=y+(Math.random()-0.5)*24;
      this.app.stage.addChild(sm);
      const t0=performance.now();
      const tick=()=>{
        if(this._destroyed||!sm.parent)return;
        const tp=Math.min((performance.now()-t0)/900,1);
        sm.scale.set(1+tp*2.5);sm.alpha=0.45*(1-tp);sm.y-=0.4;
        if(tp<1)requestAnimationFrame(tick);else sm.destroy();
      };tick();
    }
  }
  _drawGrappleLines(x1,y1,x2,y2) {
    for(let i=0;i<4;i++) setTimeout(()=>{
      if(this._destroyed||!this.app)return;
      const g=new PIXI.Graphics();
      g.stroke({color:0xbbaa88,width:1.5,alpha:0.7});
      g.moveTo(x1,y1+(i-1.5)*14);g.lineTo(x2,y2+(i-1.5)*14);
      this.app.stage.addChild(g);
      setTimeout(()=>{if(g.parent)g.destroy();},700);
    },i*100);
  }
  _shieldRing(x,y) {
    for(let i=0;i<3;i++) setTimeout(()=>{
      if(this._destroyed||!this.app)return;
      const g=new PIXI.Graphics();
      g.stroke({color:0x4a9eff,width:2,alpha:0.6});g.circle(x,y,50);g.scale.set(0.5);
      this.app.stage.addChild(g);
      const t0=performance.now();
      const tick=()=>{
        if(this._destroyed||!g.parent)return;
        const tp=Math.min((performance.now()-t0)/700,1);
        g.scale.set(0.5+tp*1.8);g.alpha=0.6*(1-tp);
        if(tp<1)requestAnimationFrame(tick);else g.destroy();
      };tick();
    },i*180);
  }
  _smokeCloud(x,y){
    for(let i=0;i<8;i++) setTimeout(()=>{
      if(this._destroyed||!this.app)return;
      const g=new PIXI.Graphics();
      g.fill({color:0x222233,alpha:0.6});g.circle(0,0,16+Math.random()*20);
      g.x=x+(Math.random()-0.5)*40;g.y=y;this.app.stage.addChild(g);
      const startY=g.y,t0=performance.now();
      const tick=()=>{
        if(this._destroyed||!g.parent)return;
        const tp=Math.min((performance.now()-t0)/1400,1);
        g.scale.set(1+tp*2);g.alpha=0.55*(1-tp);g.y=startY-tp*50;
        if(tp<1)requestAnimationFrame(tick);else g.destroy();
      };tick();
    },i*120);
  }
  _coinArc(from,to){
    if(!this.app||this._destroyed)return;
    const g=new PIXI.Graphics();
    g.fill({color:0xffd700});g.circle(0,0,5);g.x=from.x;g.y=from.y;
    this.app.stage.addChild(g);
    const midX=(from.x+to.x)/2,midY=Math.min(from.y,to.y)-80-Math.random()*60;
    const dur=500+Math.random()*300,t0=performance.now();
    const tick=()=>{
      if(this._destroyed||!g.parent)return;
      const t=Math.min((performance.now()-t0)/dur,1),i=1-t;
      g.x=i*i*from.x+2*i*t*midX+t*t*to.x;
      g.y=i*i*from.y+2*i*t*midY+t*t*to.y;
      g.rotation+=0.15;
      if(t<1)requestAnimationFrame(tick);else g.destroy();
    };tick();
  }
  _coinFall(x,startY){
    if(!this.app||this._destroyed)return;
    const g=new PIXI.Graphics();
    g.fill({color:0xffd700});g.circle(0,0,4+Math.random()*4);g.x=x;g.y=startY;
    this.app.stage.addChild(g);
    const speed=3+Math.random()*4;
    const tick=()=>{
      if(this._destroyed||!g.parent)return;
      g.y+=speed;g.rotation+=0.1;
      if(g.y>this.H+20){g.destroy();return;}
      requestAnimationFrame(tick);
    };tick();
  }
  _shakeShipSd(sd,intensity=9,times=7){
    if(!sd)return;
    let count=0;
    const tick=()=>{
      if(this._destroyed)return;
      if(count++>=times){sd.spring.dx=0;return;}
      sd.spring.vx+=(Math.random()-0.5)*intensity*0.3;
      setTimeout(tick,44);
    };tick();
  }
  _screenFlash(color,alpha=0.35){
    if(!this.app||this._destroyed)return;
    const g=new PIXI.Graphics();
    g.fill({color,alpha});g.rect(0,0,this.W,this.H);
    this.app.stage.addChild(g);
    const t0=performance.now();
    const tick=()=>{
      if(this._destroyed||!g.parent)return;
      const tp=Math.min((performance.now()-t0)/200,1);
      g.alpha=alpha*(1-tp);
      if(tp<1)requestAnimationFrame(tick);else g.destroy();
    };tick();
  }
  _spawnText(x,y,text,color='#ffffff',size=20){
    if(!this.app||this._destroyed)return;
    const t=new PIXI.Text({text,style:{fontFamily:'Courier New',fontSize:size,fill:color,fontWeight:'bold',letterSpacing:4,dropShadow:{color:'#000000',blur:8,distance:0}}});
    t.anchor.set(0.5);t.x=x;t.y=y;
    this.app.stage.addChild(t);
    const startY=y,t0=performance.now();
    const tick=()=>{
      if(this._destroyed||!t.parent)return;
      const tp=Math.min((performance.now()-t0)/1300,1);
      t.y=startY-tp*60;t.alpha=tp<0.65?1:1-(tp-0.65)/0.35;
      if(tp<1)requestAnimationFrame(tick);else t.destroy();
    };tick();
  }
  _tween(target,props,duration,ease='linear',onComplete){
    const from={};
    Object.keys(props).forEach(k=>from[k]=target[k]);
    const easeFn={linear:t=>t,easeIn:t=>t*t*t,easeOut:t=>1-Math.pow(1-t,3),easeInOut:t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}[ease]||(t=>t);
    const t0=performance.now();
    const tick=()=>{
      if(this._destroyed)return;
      const t=Math.min((performance.now()-t0)/duration,1);
      Object.keys(props).forEach(k=>target[k]=from[k]+(props[k]-from[k])*easeFn(t));
      if(t<1)requestAnimationFrame(tick);else onComplete?.();
    };tick();
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  _bindEvents(){
    EventBus.on('playAttack',    ({fromPlayer,onImpact})=>this.playAttack(fromPlayer,onImpact));
    EventBus.on('playBoard',     ()=>this.playBoard());
    EventBus.on('playEvade',     ({success})=>this.playEvade(success));
    EventBus.on('playSabotage',  ()=>this.playSabotage());
    EventBus.on('playNegotiate', ({success})=>this.playNegotiate(success));
    EventBus.on('playTelegraph', ({stance})=>this.playTelegraph(stance));
    EventBus.on('playVictory',   ()=>this.playVictory());
    EventBus.on('playDefeat',    ()=>this.playDefeat());
    EventBus.on('rainSplash',    ({x})=>this._explode(x,this.H*0.55,0x8899cc,4,0.3));
    EventBus.on('updateHealth',  ({who,hpPct})=>this.updateHealth(who,hpPct));
  }

  // ── Destroy ────────────────────────────────────────────────────────────────
  destroy(){
    this._destroyed=true;
    if(this._resizeHandler){window.removeEventListener('resize',this._resizeHandler);this._resizeHandler=null;}
    if(this.ready&&this.app){try{this.app.destroy();}catch(_){}}
    this.app=null;this.ships={};
  }
}

// ── Standalone crew figure builder (used in both deck + crow's nest) ────────
function _makeCrewFigure(s, C, x, baseY, scale=1.0) {
  const cs = s * scale;
  const cw = new PIXI.Container();
  cw.x = x; cw.y = baseY;
  const g  = new PIXI.Graphics();
  // body
  g.setStrokeStyle({width:2*cs,color:0xddccaa,alpha:0.9});
  g.moveTo(0,-18*cs);g.lineTo(0,-8*cs);g.stroke();
  // legs
  g.moveTo(0,-8*cs);g.lineTo(-4*cs,0);g.stroke();
  g.moveTo(0,-8*cs);g.lineTo( 4*cs,0);g.stroke();
  // arms
  g.moveTo(-6*cs,-15*cs);g.lineTo(6*cs,-15*cs);g.stroke();
  cw.addChild(g);
  // head
  const head = new PIXI.Graphics();
  head.fill({color:0xddccaa,alpha:0.9});head.circle(0,0,4*cs);
  head.y = -21*cs;
  cw.addChild(head);
  cw._head = head;
  // hat
  const hat = new PIXI.Graphics();
  hat.fill({color:0x111111});
  hat.rect(-5*cs,-7*cs,10*cs,7*cs);
  hat.rect(-7*cs,0,14*cs,2.5*cs);
  hat.y = -21*cs;
  cw.addChild(hat);
  // random walk direction
  cw._vx = (Math.random()-0.5)*0.25;
  return cw;
}
