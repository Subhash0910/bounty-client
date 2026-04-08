import * as PIXI from 'pixi.js';
import EventBus from './EventBus.js';

// ─── tiny spring integrator ────────────────────────────────────────────────
class Spring {
  constructor(stiffness = 180, damping = 22) {
    this.k = stiffness; this.d = damping;
    this.pos = 0; this.vel = 0; this.target = 0;
  }
  tick(dt) {
    const f = -this.k * (this.pos - this.target) - this.d * this.vel;
    this.vel += f * dt; this.pos += this.vel * dt;
    return this.pos;
  }
  impulse(v) { this.vel += v; }
}

export default class PixiStage {
  constructor(canvas) {
    this.canvas     = canvas;
    this.app        = null;
    this.ships      = {};          // { player, enemy } — Container refs
    this._parts     = {};          // internal refs per ship
    this.ready      = false;
    this._destroyed = false;
    this._initPromise = this._init();
  }

  async _init() {
    this.app = new PIXI.Application();
    await this.app.init({
      canvas: this.canvas,
      width:  window.innerWidth, height: window.innerHeight,
      backgroundAlpha: 0, antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2), autoDensity: true,
    });
    if (this._destroyed) { try { this.app.destroy(); } catch (_) {} return; }
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.ready = true;
    this._buildScene();
    this._bindEvents();
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENE BOOTSTRAP
  // ═══════════════════════════════════════════════════════════════════════════
  _buildScene() {
    const W = this.W, H = this.H;
    const shipH = Math.min(H * 0.44, 280);

    // Wake layer (below ships)
    this._wakeLayer = new PIXI.Container();
    this.app.stage.addChild(this._wakeLayer);

    // Build both ships
    const pData = this._buildShip(false, shipH);
    const eData = this._buildShip(true,  shipH);
    this._parts.player = pData;
    this._parts.enemy  = eData;
    this.ships.player  = pData.root;
    this.ships.enemy   = eData.root;

    this.ships.player.x = W * 0.22; this.ships.player.y = H * 0.54;
    this.ships.enemy.x  = W * 0.78; this.ships.enemy.y  = H * 0.54;
    this._anchorPlayer  = { x: W * 0.22, y: H * 0.54 };
    this._anchorEnemy   = { x: W * 0.78, y: H * 0.54 };
    this.app.stage.addChild(this.ships.player);
    this.app.stage.addChild(this.ships.enemy);

    // Red damage vignette (player hit)
    this._vignetteGfx = new PIXI.Graphics();
    this._vignetteAlpha = 0;
    this.app.stage.addChild(this._vignetteGfx);
    this._drawVignette();

    // Springs for ship motion
    this._springs = {
      player: { x: new Spring(160, 18), y: new Spring(120, 14), rot: new Spring(90, 12) },
      enemy:  { x: new Spring(160, 18), y: new Spring(120, 14), rot: new Spring(90, 12) },
    };

    // Global tick
    this._t = 0;
    this.app.ticker.add((ticker) => this._onTick(ticker.deltaMS / 1000));
  }

  _drawVignette() {
    this._vignetteGfx.clear();
    if (this._vignetteAlpha <= 0) return;
    const W = this.W, H = this.H, a = this._vignetteAlpha;
    // Four edges
    for (let i = 0; i < 18; i++) {
      const ta = a * (1 - i / 18);
      this._vignetteGfx.fill({ color: 0xff1133, alpha: ta * 0.55 });
      this._vignetteGfx.rect(0, i * 6, W, 6);
      this._vignetteGfx.rect(0, H - i * 6 - 6, W, 6);
      this._vignetteGfx.rect(i * 6, 0, 6, H);
      this._vignetteGfx.rect(W - i * 6 - 6, 0, 6, H);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIP BUILDER
  // ═══════════════════════════════════════════════════════════════════════════
  _buildShip(enemy, shipH) {
    const root  = new PIXI.Container();
    const s     = shipH / 300;
    const flip  = enemy ? -1 : 1;
    const parts = { root, s, flip, enemy, hp: 100 };

    // Palette
    const hullDark   = enemy ? 0x5a1a1a : 0x1a3a2a;
    const hullMid    = enemy ? 0x8b3030 : 0x2a5a3a;
    const hullLight  = enemy ? 0xb04040 : 0x3a7a50;
    const woodDark   = enemy ? 0x6b3520 : 0x4a2e18;
    const woodMid    = enemy ? 0x9b5530 : 0x7a4e28;
    const sailColor  = enemy ? 0xc8a080 : 0xe8d8b0;
    const sailShadow = enemy ? 0x8a6050 : 0xb0a080;
    const ropeCol    = 0xaa9966;
    const flagCol    = enemy ? 0xcc2222 : 0x00aa66;

    parts.palette = { hullDark, hullMid, hullLight, woodDark, woodMid, sailColor, sailShadow, ropeCol, flagCol };

    // ── Wake / water disturb container
    parts.wakeContainer = new PIXI.Container();
    this._wakeLayer.addChild(parts.wakeContainer);

    // ── Reflection
    const refl = new PIXI.Graphics();
    refl.fill({ color: hullMid, alpha: 0.18 });
    refl.moveTo(-70*s*flip, 8*s);
    refl.bezierCurveTo(-90*s*flip,20*s,-60*s*flip,45*s,0,50*s);
    refl.bezierCurveTo(60*s*flip,45*s,90*s*flip,20*s,70*s*flip,8*s);
    refl.closePath();
    root.addChild(refl);
    parts.refl = refl;

    // ── Hull
    const hull = new PIXI.Graphics();
    this._drawHull(hull, s, flip, hullDark, hullMid, hullLight);
    root.addChild(hull);
    parts.hullGfx = hull;

    // ── Planks
    const planks = new PIXI.Graphics();
    this._drawPlanks(planks, s, flip, hullDark);
    root.addChild(planks);

    // ── Damage cracks container (fills as HP drops)
    parts.crackContainer = new PIXI.Container();
    root.addChild(parts.crackContainer);

    // ── Cannon ports + cannon barrels
    const { cannonLayer, barrels } = this._buildCannons(s, flip, woodMid, enemy);
    root.addChild(cannonLayer);
    parts.cannonBarrels = barrels;   // [{gfx, restX, restY}]

    // ── Deck
    const deck = new PIXI.Graphics();
    this._drawDeck(deck, s, flip, woodMid, woodDark);
    root.addChild(deck);

    // ── Stern
    const stern = new PIXI.Graphics();
    this._drawStern(stern, s, flip, hullDark, woodMid);
    root.addChild(stern);

    // ── Bowsprit
    const bow = new PIXI.Graphics();
    this._drawBow(bow, s, flip, woodMid, ropeCol);
    root.addChild(bow);

    // ── Mast containers (so they can sway independently)
    const mainMastC = new PIXI.Container();
    const foreMastC = new PIXI.Container();
    mainMastC.x = 0; mainMastC.y = 0;
    foreMastC.x = -24*s*flip; foreMastC.y = 0;
    const mainMast = new PIXI.Graphics();
    this._drawMainMast(mainMast, s, woodDark, woodMid);
    mainMastC.addChild(mainMast);
    const foreMast = new PIXI.Graphics();
    this._drawForeMast(foreMast, s, flip, woodDark, woodMid);
    foreMastC.addChild(foreMast);
    root.addChild(foreMastC);
    root.addChild(mainMastC);
    parts.mainMastC = mainMastC;
    parts.foreMastC = foreMastC;

    // ── Sails (dynamic, redrawn each frame)
    parts.sailContainerMain = new PIXI.Container();
    parts.sailContainerFore = new PIXI.Container();
    root.addChild(parts.sailContainerFore);
    root.addChild(parts.sailContainerMain);
    parts.sailPhase = Math.random() * Math.PI * 2;
    parts.sailWind  = 0.6 + Math.random() * 0.4;

    // ── Rigging
    const ropes = new PIXI.Graphics();
    this._drawRigging(ropes, s, flip, ropeCol);
    root.addChild(ropes);

    // ── Crow's nest
    const nest = new PIXI.Graphics();
    this._drawCrowsNest(nest, s, woodDark, woodMid);
    root.addChild(nest);
    // Lookout crew in nest
    const lookout = this._buildCrewFigure(s, 0.75, enemy);
    lookout.x = 0; lookout.y = -202*s;
    root.addChild(lookout);
    parts.lookout = lookout;
    parts.lookoutAnim = { t: Math.random() * Math.PI * 2 };

    // ── Flag
    parts.flagGfx = new PIXI.Graphics();
    this._drawFlag(parts.flagGfx, s, flip, flagCol);
    root.addChild(parts.flagGfx);
    parts.flagPhase = Math.random() * Math.PI * 2;

    // ── Deck crew (3 figures that walk/animate)
    parts.crew = [];
    [[-32, 0], [0, 0], [28, 0]].forEach(([cx], idx) => {
      const fig = this._buildCrewFigure(s, 1, enemy);
      fig.x = cx * s * flip; fig.y = -22 * s;
      root.addChild(fig);
      parts.crew.push({
        container: fig,
        baseX: cx * s * flip,
        phase: idx * 1.1 + Math.random() * 2,
        walkDir: 1,
        walkRange: (8 + Math.random() * 6) * s,
        state: 'idle',  // idle | alert | run | celebrate
        alertTimer: 0,
      });
    });

    // ── Lantern
    parts.lanternGfx   = new PIXI.Graphics();
    parts.lanternPhase = Math.random() * Math.PI * 2;
    this._drawLantern(parts.lanternGfx, s, flip);
    root.addChild(parts.lanternGfx);

    // ── Springs for this ship
    parts.xSpring   = new Spring(155, 20);
    parts.ySpring   = new Spring(110, 16);
    parts.rotSpring = new Spring(85,  14);
    parts.mastSwayMain = new Spring(60, 8);
    parts.mastSwayFore = new Spring(55, 7);

    // ── HP / damage state
    parts.hp         = 100;
    parts.crackCount = 0;
    parts.isHit      = false;
    parts.hitTimer   = 0;

    return parts;
  }

  // ── Crew figure builder ──────────────────────────────────────────────────
  _buildCrewFigure(s, scale = 1, enemy = false) {
    const c   = new PIXI.Container();
    const cs  = scale * s;
    const g   = new PIXI.Graphics();
    const col = 0xddccaa;

    // Legs (two separate so they can animate)
    const legL = new PIXI.Graphics();
    legL.setStrokeStyle({ width: 2*cs, color: 0x445566 });
    legL.moveTo(0, 0); legL.lineTo(-4*cs, 10*cs); legL.stroke();
    legL.label = 'legL';

    const legR = new PIXI.Graphics();
    legR.setStrokeStyle({ width: 2*cs, color: 0x445566 });
    legR.moveTo(0, 0); legR.lineTo(4*cs, 10*cs); legR.stroke();
    legR.label = 'legR';

    // Body
    g.setStrokeStyle({ width: 2.2*cs, color: enemy ? 0x993333 : 0x336699 });
    g.moveTo(0, 0); g.lineTo(0, -10*cs); g.stroke();

    // Arms
    const armL = new PIXI.Graphics();
    armL.setStrokeStyle({ width: 1.8*cs, color: col });
    armL.moveTo(0, -8*cs); armL.lineTo(-6*cs, -4*cs); armL.stroke();
    armL.label = 'armL';

    const armR = new PIXI.Graphics();
    armR.setStrokeStyle({ width: 1.8*cs, color: col });
    armR.moveTo(0, -8*cs); armR.lineTo(6*cs, -4*cs); armR.stroke();
    armR.label = 'armR';

    // Head
    g.fill({ color: col }); g.circle(0, -14*cs, 4*cs);
    // Hat
    g.fill({ color: 0x111111 }); g.rect(-5*cs, -21*cs, 10*cs, 7*cs);
    g.fill({ color: 0x111111 }); g.rect(-7*cs, -15*cs, 14*cs, 2*cs);

    c.addChild(legL); c.addChild(legR);
    c.addChild(g);
    c.addChild(armL); c.addChild(armR);
    c._legL = legL; c._legR = legR;
    c._armL = armL; c._armR = armR;
    c._cs   = cs;
    return c;
  }

  // ── Static draw helpers ──────────────────────────────────────────────────
  _drawHull(g, s, flip, hullDark, hullMid, hullLight) {
    g.fill({ color: hullDark });
    g.moveTo(-72*s*flip,-8*s); g.bezierCurveTo(-88*s*flip,10*s,-75*s*flip,38*s,-48*s*flip,52*s);
    g.lineTo(48*s*flip,52*s); g.bezierCurveTo(75*s*flip,38*s,88*s*flip,10*s,72*s*flip,-8*s); g.closePath();
    g.fill({ color: hullMid });
    g.moveTo(-68*s*flip,-8*s); g.bezierCurveTo(-82*s*flip,8*s,-70*s*flip,34*s,-44*s*flip,48*s);
    g.lineTo(44*s*flip,48*s); g.bezierCurveTo(70*s*flip,34*s,82*s*flip,8*s,68*s*flip,-8*s); g.closePath();
    g.fill({ color: hullLight, alpha: 0.45 });
    g.moveTo(-62*s*flip,-8*s); g.bezierCurveTo(-72*s*flip,2*s,-64*s*flip,12*s,-42*s*flip,16*s);
    g.lineTo(42*s*flip,16*s); g.bezierCurveTo(64*s*flip,12*s,72*s*flip,2*s,62*s*flip,-8*s); g.closePath();
  }
  _drawPlanks(g, s, flip, hullDark) {
    g.setStrokeStyle({ width: 0.8*s, color: hullDark, alpha: 0.6 });
    for (let i = 0; i < 4; i++) {
      const py = -2*s + i*13*s, xo = 10*s*i;
      g.moveTo((-60+xo)*s*flip, py); g.lineTo((60-xo)*s*flip, py); g.stroke();
    }
  }
  _buildCannons(s, flip, woodMid, enemy) {
    const cannonLayer = new PIXI.Container();
    const barrels = [];
    const portY = 4*s;
    [-38,-16,10,32].forEach(px => {
      // Port hole
      const port = new PIXI.Graphics();
      port.fill({ color: 0x111111 }); port.ellipse(px*s*flip, portY, 5.5*s, 4*s);
      cannonLayer.addChild(port);
      // Barrel (separate so it can recoil)
      const b = new PIXI.Graphics();
      b.fill({ color: 0x444444 }); b.rect(-2*s, -2*s, 8*s, 4*s);
      b.fill({ color: 0x222222 }); b.rect(-2*s, -1.2*s, 7*s, 2.4*s);
      b.x = px*s*flip + (enemy ? -7*s : 0);
      b.y = portY;
      cannonLayer.addChild(b);
      barrels.push({ gfx: b, restX: b.x, restY: b.y });
    });
    return { cannonLayer, barrels };
  }
  _drawDeck(g, s, flip, woodMid, woodDark) {
    g.fill({ color: woodMid });
    g.moveTo(-65*s*flip,-12*s); g.lineTo(65*s*flip,-12*s);
    g.lineTo(55*s*flip,-22*s); g.lineTo(-55*s*flip,-22*s); g.closePath();
    g.setStrokeStyle({ width: 0.7*s, color: woodDark, alpha: 0.8 });
    for (let i = -4; i <= 4; i++) {
      g.moveTo(i*14*s*flip,-22*s); g.lineTo(i*16*s*flip,-12*s); g.stroke();
    }
  }
  _drawStern(g, s, flip, hullDark, woodMid) {
    g.fill({ color: hullDark });
    g.moveTo(52*s*flip,-22*s); g.lineTo(70*s*flip,-22*s);
    g.lineTo(70*s*flip,-52*s); g.lineTo(52*s*flip,-52*s); g.closePath();
    g.fill({ color: woodMid });
    g.moveTo(54*s*flip,-24*s); g.lineTo(68*s*flip,-24*s);
    g.lineTo(68*s*flip,-50*s); g.lineTo(54*s*flip,-50*s); g.closePath();
    // Windows
    g.fill({ color: 0xffe090, alpha: 0.7 });
    g.rect(57*s*flip-(flip<0?8*s:0),-46*s,7*s,5*s);
    g.rect(57*s*flip-(flip<0?8*s:0),-38*s,7*s,5*s);
  }
  _drawBow(g, s, flip, woodMid, ropeCol) {
    g.fill({ color: woodMid });
    g.moveTo(-54*s*flip,-22*s); g.lineTo(-100*s*flip,-55*s);
    g.lineTo(-96*s*flip,-58*s); g.lineTo(-50*s*flip,-25*s); g.closePath();
    g.setStrokeStyle({ width: 1*s, color: ropeCol, alpha: 0.8 });
    g.moveTo(-54*s*flip,-22*s); g.lineTo(-98*s*flip,-57*s); g.stroke();
  }
  _drawMainMast(g, s, woodDark, woodMid) {
    g.fill({ color: woodDark }); g.rect(-3.5*s,-195*s,7*s,183*s);
    g.fill({ color: woodMid  }); g.rect(-48*s,-190*s,96*s,5*s);
    g.fill({ color: woodMid  }); g.rect(-38*s,-140*s,76*s,4.5*s);
    g.fill({ color: woodMid  }); g.rect(-28*s,-90*s,56*s,4*s);
  }
  _drawForeMast(g, s, flip, woodDark, woodMid) {
    g.fill({ color: woodDark }); g.rect(-2.8*s,-155*s,5.5*s,133*s);
    g.fill({ color: woodMid  }); g.rect(-36*s*Math.abs(flip),-150*s,72*s*Math.abs(flip),4*s);
    g.fill({ color: woodMid  }); g.rect(-26*s*Math.abs(flip),-110*s,52*s*Math.abs(flip),3.5*s);
  }
  _drawRigging(g, s, flip, ropeCol) {
    g.setStrokeStyle({ width: 1*s, color: ropeCol, alpha: 0.65 });
    [[-52,-22],[52,-22]].forEach(([rx,ry]) => {
      g.moveTo(0,-193*s); g.lineTo(rx*s*flip,ry*s); g.stroke();
    });
    g.moveTo(0,-190*s); g.lineTo(-24*s*flip,-153*s); g.stroke();
    g.moveTo(-24*s*flip,-153*s); g.lineTo(-50*s*flip,-22*s); g.stroke();
    g.moveTo(0,-140*s); g.lineTo(60*s*flip,-22*s); g.stroke();
    g.setStrokeStyle({ width: 0.6*s, color: ropeCol, alpha: 0.38 });
    for (let i = 0; i < 5; i++) {
      const ry = -22*s - i*34*s, w = 10+i*9;
      g.moveTo(-(w+2)*s*flip,ry); g.lineTo(-(w-8)*s*flip,ry); g.stroke();
    }
  }
  _drawCrowsNest(g, s, woodDark, woodMid) {
    g.fill({ color: woodDark }); g.rect(-10*s,-202*s,20*s,10*s);
    g.setStrokeStyle({ width: 1.2*s, color: woodMid });
    g.moveTo(-10*s,-202*s); g.lineTo(-10*s,-192*s); g.stroke();
    g.moveTo( 10*s,-202*s); g.lineTo( 10*s,-192*s); g.stroke();
  }
  _drawFlag(g, s, flip, flagCol) {
    g.clear();
    const waveX = Math.sin(this ? (this._t||0)*3 : 0) * 3 * s;
    g.fill({ color: flagCol, alpha: 0.92 });
    g.moveTo(0,-205*s);
    g.lineTo(22*s*flip + waveX,-196*s);
    g.lineTo(0,-188*s); g.closePath();
    g.fill({ color: 0xffffff, alpha: 0.85 });
    g.circle(8*s*flip + waveX*0.5,-197*s,4*s);
    g.fill({ color: flagCol });
    g.circle(6*s*flip + waveX*0.5,-198*s,1.3*s);
    g.circle(10*s*flip + waveX*0.5,-198*s,1.3*s);
  }
  _drawLantern(g, s, flip) {
    g.fill({ color: 0xffe090, alpha: 0.82 }); g.circle(64*s*flip,-56*s,4*s);
    g.fill({ color: 0xffd060, alpha: 0.2  }); g.circle(64*s*flip,-56*s,11*s);
  }

  // ── Dynamic sail drawing ──────────────────────────────────────────────────
  _drawSails(parts, t) {
    const { sailContainerMain, sailContainerFore, s, flip, palette, sailPhase, sailWind } = parts;
    sailContainerMain.removeChildren();
    sailContainerFore.removeChildren();

    const wind = Math.sin(t * 0.4 + sailPhase) * 0.3 * sailWind;
    const gust = Math.sin(t * 1.1 + sailPhase * 1.3) * 0.12 * sailWind;
    const bulge = 1 + wind + gust;

    const sc = palette.sailColor, ss = palette.sailShadow;

    // Main mast — 3 sails
    const mainG = new PIXI.Graphics();
    // Top sail
    mainG.fill({ color: sc, alpha: 0.92 });
    mainG.moveTo(-46*s,-188*s);
    mainG.bezierCurveTo(-50*s*bulge,-168*s,50*s*bulge,-168*s,46*s,-188*s); mainG.closePath();
    mainG.fill({ color: ss, alpha: 0.3 });
    mainG.moveTo(-46*s,-188*s);
    mainG.bezierCurveTo(-48*s*bulge,-178*s,-8*s,-173*s,0,-170*s); mainG.lineTo(0,-188*s); mainG.closePath();
    // Mid sail
    mainG.fill({ color: sc, alpha: 0.9 });
    mainG.moveTo(-36*s,-138*s);
    mainG.bezierCurveTo(-42*s*bulge,-110*s,42*s*bulge,-110*s,36*s,-138*s); mainG.closePath();
    mainG.fill({ color: ss, alpha: 0.28 });
    mainG.moveTo(-36*s,-138*s);
    mainG.bezierCurveTo(-40*s*bulge,-124*s,-8*s,-117*s,0,-114*s); mainG.lineTo(0,-138*s); mainG.closePath();
    // Lower main sail
    mainG.fill({ color: sc, alpha: 0.88 });
    mainG.moveTo(-26*s,-88*s);
    mainG.bezierCurveTo(-34*s*bulge,-50*s,34*s*bulge,-50*s,26*s,-88*s); mainG.closePath();
    mainG.fill({ color: ss, alpha: 0.25 });
    mainG.moveTo(-26*s,-88*s);
    mainG.bezierCurveTo(-32*s*bulge,-68*s,-6*s,-56*s,0,-54*s); mainG.lineTo(0,-88*s); mainG.closePath();
    sailContainerMain.addChild(mainG);

    // Fore mast — 2 sails
    const fx = -24*s*flip;
    const foreG = new PIXI.Graphics();
    foreG.fill({ color: sc, alpha: 0.88 });
    foreG.moveTo(fx-34*s*flip,-148*s);
    foreG.bezierCurveTo(fx-38*s*flip*bulge,-122*s,fx+34*s*flip*bulge,-122*s,fx+32*s*flip,-148*s); foreG.closePath();
    foreG.fill({ color: sc, alpha: 0.85 });
    foreG.moveTo(fx-24*s*flip,-108*s);
    foreG.bezierCurveTo(fx-28*s*flip*bulge,-80*s,fx+24*s*flip*bulge,-80*s,fx+22*s*flip,-108*s); foreG.closePath();
    sailContainerFore.addChild(foreG);

    // Jib
    const jibG = new PIXI.Graphics();
    jibG.fill({ color: sc, alpha: 0.72 });
    jibG.moveTo(-54*s*flip,-22*s);
    jibG.bezierCurveTo(-80*s*flip*bulge,-45*s,-26*s*flip*bulge,-78*s,-24*s*flip,-80*s);
    jibG.lineTo(-24*s*flip,-22*s); jibG.closePath();
    sailContainerFore.addChild(jibG);
  }

  // ── Crew animation tick ───────────────────────────────────────────────────
  _tickCrew(crewArr, t, shipState) {
    crewArr.forEach((c, idx) => {
      const fig = c.container;
      if (!fig.parent) return;
      const legL = fig._legL, legR = fig._legR, armL = fig._armL, armR = fig._armR;
      const cs = fig._cs;

      if (c.state === 'run' || c.state === 'alert') {
        // Running — fast leg swing
        const speed = c.state === 'run' ? 8 : 4;
        const lSwing = Math.sin(t * speed + c.phase) * 0.4;
        this._redrawLeg(legL, cs,  lSwing);
        this._redrawLeg(legR, cs, -lSwing);
        this._redrawArm(armL, cs, -lSwing * 0.6);
        this._redrawArm(armR, cs,  lSwing * 0.6);
        // Move along deck
        fig.x = c.baseX + Math.sin(t * (c.state==='run'?2.5:1.5) + c.phase) * c.walkRange;
        // Alert: crew looks toward enemy (lean)
        if (c.state === 'alert') fig.rotation = Math.sin(t*2+c.phase)*0.05;
        c.alertTimer -= 0.016;
        if (c.alertTimer <= 0) c.state = 'idle';
      } else if (c.state === 'celebrate') {
        // Jump and wave arms
        const jt = Math.abs(Math.sin(t * 5 + c.phase));
        fig.y = -22 * cs/cs + (-8 * jt * cs);
        this._redrawArm(armL, cs, -0.8 - jt * 0.5);
        this._redrawArm(armR, cs,  0.8 + jt * 0.5);
        this._redrawLeg(legL, cs,  0.2);
        this._redrawLeg(legR, cs, -0.2);
        c.alertTimer -= 0.016;
        if (c.alertTimer <= 0) c.state = 'idle';
      } else {
        // Idle sway + gentle walk
        const sway = Math.sin(t * 1.2 + c.phase + idx) * 0.06;
        const step = Math.sin(t * 1.4 + c.phase) * 0.12;
        this._redrawLeg(legL, cs,  step);
        this._redrawLeg(legR, cs, -step);
        this._redrawArm(armL, cs, -0.15 + sway);
        this._redrawArm(armR, cs,  0.15 - sway);
        fig.rotation = sway * 0.5;
        fig.y = (-22 * cs/cs) - Math.abs(Math.sin(t * 1.4 + c.phase)) * 1.2 * cs;
      }
    });
  }
  _redrawLeg(g, cs, angle) {
    g.clear();
    g.setStrokeStyle({ width: 2*cs, color: 0x445566 });
    g.moveTo(0,0);
    g.lineTo(Math.sin(angle)*5*cs, 10*cs);
    g.stroke();
  }
  _redrawArm(g, cs, angle) {
    g.clear();
    g.setStrokeStyle({ width: 1.8*cs, color: 0xddccaa });
    g.moveTo(0,-8*cs);
    g.lineTo(Math.sin(angle)*8*cs, -4*cs + Math.cos(angle)*4*cs);
    g.stroke();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MASTER TICK
  // ═══════════════════════════════════════════════════════════════════════════
  _onTick(dt) {
    if (this._destroyed) return;
    this._t += dt;
    const t = this._t;

    ['player','enemy'].forEach(who => {
      const p = this._parts[who];
      if (!p) return;
      const ship = this.ships[who];
      const anchor = who === 'player' ? this._anchorPlayer : this._anchorEnemy;

      // ── Ocean bob (base)
      const bobY   = Math.sin(t * 0.9 + (who==='enemy' ? 1.3 : 0)) * 8;
      const bobRot = Math.sin(t * 0.65 + (who==='enemy' ? 1.3 : 0)) * 0.022;

      // ── Spring offsets (impulse from hits/attacks)
      p.xSpring.target   = 0;
      p.ySpring.target   = 0;
      p.rotSpring.target = 0;
      const sx  = p.xSpring.tick(dt);
      const sy  = p.ySpring.tick(dt);
      const sr  = p.rotSpring.tick(dt);

      ship.x = anchor.x + sx;
      ship.y = anchor.y + bobY + sy;
      ship.rotation = bobRot + sr;

      // ── Mast sway
      p.mastSwayMain.target = 0;
      p.mastSwayFore.target = 0;
      const ms = p.mastSwayMain.tick(dt);
      const fs = p.mastSwayFore.tick(dt);
      if (p.mainMastC) p.mainMastC.rotation = ms + Math.sin(t*0.5)*0.008;
      if (p.foreMastC) p.foreMastC.rotation = fs + Math.sin(t*0.55+0.8)*0.010;

      // ── Dynamic sails
      this._drawSails(p, t);

      // ── Flag wave
      if (p.flagGfx) this._drawFlag(p.flagGfx, p.s, p.flip, p.palette.flagCol);

      // ── Lantern flicker
      if (p.lanternGfx) {
        p.lanternPhase += dt * 4;
        p.lanternGfx.alpha = 0.65 + Math.sin(p.lanternPhase) * 0.35;
      }

      // ── Crew
      this._tickCrew(p.crew, t, p.state);

      // ── Lookout scan (slow head scan side to side)
      if (p.lookout) {
        p.lookoutAnim.t += dt;
        p.lookout.rotation = Math.sin(p.lookoutAnim.t * 0.9) * 0.35;
      }

      // ── Cannon barrel idle drift (tiny)
      if (p.cannonBarrels) {
        p.cannonBarrels.forEach((b, i) => {
          const drift = Math.sin(t * 1.1 + i * 0.7) * 0.4 * p.s;
          b.gfx.y = b.restY + drift;
        });
      }

      // ── Hit flash
      if (p.isHit) {
        p.hitTimer -= dt;
        if (p.hitTimer <= 0) {
          p.isHit = false;
          ship.tint = 0xffffff;
        } else {
          ship.tint = p.hitTimer > 0.12 ? 0xff4444 : 0xffffff;
        }
      }

      // ── Wake ripples from movement
      if (p.wakeContainer && Math.abs(p.xSpring.vel) > 5) {
        if (Math.random() < 0.3) this._spawnWakeRipple(p, ship.x, ship.y + 45*p.s);
      }
    });

    // ── Vignette fade
    if (this._vignetteAlpha > 0) {
      this._vignetteAlpha = Math.max(0, this._vignetteAlpha - dt * 1.8);
      this._drawVignette();
    }
  }

  _spawnWakeRipple(parts, x, y) {
    const g = new PIXI.Graphics();
    g.stroke({ color: 0x00f5d4, width: 1, alpha: 0.4 });
    g.ellipse(x, y, 20 * parts.s, 6 * parts.s);
    this._wakeLayer.addChild(g);
    const t0 = performance.now();
    const tick = () => {
      if (this._destroyed || !g.parent) return;
      const tp = Math.min((performance.now() - t0) / 700, 1);
      g.scale.set(1 + tp * 1.8);
      g.alpha = 0.35 * (1 - tp);
      if (tp < 1) requestAnimationFrame(tick); else g.destroy();
    };
    tick();
  }

  _repositionShips() {
    this._anchorPlayer = { x: this.W * 0.22, y: this.H * 0.54 };
    this._anchorEnemy  = { x: this.W * 0.78, y: this.H * 0.54 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC COMBAT REACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Call from CombatPage after each turn with new HP values
  updateHP(playerHP, enemyHP) {
    this._guard(() => {
      const pp = this._parts.player;
      const ep = this._parts.enemy;
      if (pp) { const prev = pp.hp; pp.hp = playerHP; if (playerHP < prev) { this._onHullHit('player', prev - playerHP); } }
      if (ep) { const prev = ep.hp; ep.hp = enemyHP;  if (enemyHP  < prev) { this._onHullHit('enemy',  prev - enemyHP);  } }
    });
  }

  _onHullHit(who, dmg) {
    const p = this._parts[who];
    const ship = this.ships[who];
    if (!p || !ship) return;

    // Hit flash tint
    p.isHit = true; p.hitTimer = 0.28;
    ship.tint = 0xff4444;

    // Spring impulse — lurch back
    const dir = who === 'player' ? -1 : 1;
    p.xSpring.impulse(dir * (60 + dmg * 3));
    p.rotSpring.impulse(dir * 0.08);
    p.ySpring.impulse(-20);
    p.mastSwayMain.impulse(dir * 0.15);
    p.mastSwayFore.impulse(dir * 0.18);

    // Crew go alert
    p.crew.forEach(c => { c.state = 'alert'; c.alertTimer = 2.5; });

    // Damage crack on hull
    if (p.crackCount < 6) this._addHullCrack(p);

    // Damage number floating off ship
    const anchor = who === 'player' ? this._anchorPlayer : this._anchorEnemy;
    this._floatDamageNumber(anchor.x, anchor.y - 80*p.s, dmg, who === 'player' ? '#ff4466' : '#ffd700');

    // Player hit: red vignette pulse
    if (who === 'player') {
      this._vignetteAlpha = Math.min(1, 0.5 + dmg * 0.02);
      this._drawVignette();
    }
  }

  _addHullCrack(parts) {
    if (!parts.crackContainer) return;
    const g = new PIXI.Graphics();
    const s = parts.s, flip = parts.flip;
    const x = (Math.random() - 0.5) * 90 * s * flip;
    const y = (Math.random() * 40 - 5) * s;
    g.setStrokeStyle({ width: 1.2*s, color: 0x000000, alpha: 0.7 });
    g.moveTo(x, y);
    let cx = x, cy = y;
    for (let i = 0; i < 3; i++) {
      cx += (Math.random()-0.5)*18*s; cy += (Math.random()-0.5)*10*s;
      g.lineTo(cx, cy); g.stroke();
    }
    parts.crackContainer.addChild(g);
    parts.crackCount++;
  }

  _floatDamageNumber(x, y, dmg, color) {
    if (!this.app || this._destroyed) return;
    const t = new PIXI.Text({ text: `-${dmg}`, style: {
      fontFamily: 'Courier New', fontSize: 28, fill: color, fontWeight: '900',
      stroke: { color: '#000000', width: 3 },
      dropShadow: { color: '#000', blur: 8, distance: 0 },
    }});
    t.anchor.set(0.5); t.x = x + (Math.random()-0.5)*30; t.y = y;
    t.scale.set(0);
    this.app.stage.addChild(t);
    const t0 = performance.now();
    const tick = () => {
      if (this._destroyed || !t.parent) return;
      const tp = Math.min((performance.now()-t0)/1000, 1);
      const sc  = tp < 0.15 ? tp/0.15 : 1 - (tp-0.15)/0.85 * 0.4;
      t.scale.set(Math.max(0, sc));
      t.y = y - tp * 70;
      t.alpha = tp < 0.6 ? 1 : 1-(tp-0.6)/0.4;
      if (tp < 1) requestAnimationFrame(tick); else t.destroy();
    }; tick();
  }

  // ── Cannon fire with recoil ────────────────────────────────────────────
  _fireCannonRecoil(who, barrelIndex, onFired) {
    const p = this._parts[who];
    if (!p || !p.cannonBarrels) { onFired?.(); return; }
    const b = p.cannonBarrels[barrelIndex % p.cannonBarrels.length];
    const recoilDist = 12 * p.s * (who==='player' ? 1 : -1);
    // Slide back
    this._tween(b.gfx, { x: b.restX - recoilDist }, 80, 'easeIn', () => {
      // Muzzle flash
      this._muzzleFlash(b.gfx.x + (who==='player'?6:-2)*p.s, b.gfx.y, p);
      onFired?.();
      // Return
      setTimeout(() => this._tween(b.gfx, { x: b.restX }, 350, 'easeOut'), 120);
    });
  }

  _muzzleFlash(x, y, parts) {
    if (!this.app || this._destroyed) return;
    const absX = (parts.root?.parent ? parts.root.x : (parts.enemy ? this._anchorEnemy.x : this._anchorPlayer.x));
    const absY = (parts.root?.parent ? parts.root.y : (parts.enemy ? this._anchorEnemy.y : this._anchorPlayer.y));
    // Flash ring
    const g = new PIXI.Graphics();
    g.fill({ color: 0xffaa00, alpha: 0.9 }); g.circle(absX + x, absY + y, 8*parts.s);
    this.app.stage.addChild(g);
    const t0 = performance.now();
    const tick = () => {
      if (this._destroyed || !g.parent) return;
      const tp = Math.min((performance.now()-t0)/180, 1);
      g.scale.set(1 + tp*1.5); g.alpha = 0.9*(1-tp);
      if (tp < 1) requestAnimationFrame(tick); else g.destroy();
    }; tick();
    // Smoke puff
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this._smokeCloud(absX + x, absY + y), i*40);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION ANIMATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  playAttack(fromPlayer, onImpact) {
    this._guard(() => {
      const who  = fromPlayer ? 'player' : 'enemy';
      const from = fromPlayer ? this._anchorPlayer : this._anchorEnemy;
      const to   = fromPlayer ? this._anchorEnemy  : this._anchorPlayer;
      const p    = this._parts[who];

      // Crew run to cannons
      if (p) {
        p.crew.forEach((c,i) => { c.state='run'; c.alertTimer = 1.8 + i*0.2; });
        p.mastSwayMain.impulse(fromPlayer ? 0.06 : -0.06);
      }

      // Stagger 2 cannons firing
      this._fireCannonRecoil(who, 1, () => {
        this._fireBall(from, to, fromPlayer ? 0x00f5d4 : 0xff4444, onImpact);
      });
      setTimeout(() => this._fireCannonRecoil(who, 2, () => {}), 220);
    });
  }

  playBoard() {
    this._guard(() => {
      const player = this.ships.player, anchor = this._anchorPlayer;
      if (!player) return;
      const pp = this._parts.player;
      if (pp) pp.crew.forEach(c => { c.state='run'; c.alertTimer=3; });
      this._tween(player, { x: anchor.x + 220 }, 380, 'easeIn', () => {
        this._drawGrappleLines(anchor.x+220, anchor.y, this._anchorEnemy.x-40, this._anchorEnemy.y);
        this._shakeShip('player'); this._shakeShip('enemy');
        const ep = this._parts.enemy;
        if (ep) ep.crew.forEach(c => { c.state='alert'; c.alertTimer=3; });
        setTimeout(() => this._tween(player, { x: anchor.x }, 500, 'easeOut'), 600);
      });
    });
  }

  playEvade(success) {
    this._guard(() => {
      const player = this.ships.player, anchor = this._anchorPlayer;
      const pp = this._parts.player;
      if (!player) return;
      if (success) {
        if (pp) { pp.xSpring.impulse(-90); pp.rotSpring.impulse(-0.12); }
        this._tween(player, { x: anchor.x-90, y: anchor.y+55, rotation:-0.18 }, 280, 'easeIn', () => {
          this._missShot(this._anchorEnemy, { x: anchor.x-90, y: anchor.y+55 });
          setTimeout(() => this._tween(player, { x: anchor.x, y: anchor.y, rotation:0 }, 440, 'easeOut'), 200);
        });
      } else {
        this._shakeShip('player');
        this._spawnText(anchor.x, anchor.y-60, '⛳ ANCHORED', '#ffaa00', 22);
      }
    });
  }

  playSabotage() {
    this._guard(() => {
      const from = this._anchorPlayer, to = this._anchorEnemy;
      const skiff = new PIXI.Graphics();
      skiff.fill({ color: 0x334455 }); skiff.ellipse(0, 0, 14, 6);
      skiff.x = from.x+60; skiff.y = from.y+80; this.app.stage.addChild(skiff);
      this._tween(skiff, { x: to.x-60, y: to.y+80 }, 600, 'linear', () => {
        skiff.destroy();
        this._explode(to.x-40, to.y+60, 0x9b59b6, 30);
        this._shakeShip('enemy');
        const ep = this._parts.enemy;
        if (ep) ep.crew.forEach(c => { c.state='alert'; c.alertTimer=2; });
        this._spawnText(to.x, to.y-70, 'RATTLED', '#9b59b6', 18);
      });
    });
  }

  playNegotiate(success) {
    this._guard(() => {
      const anchor = this._anchorPlayer;
      const pp = this._parts.player;
      if (success) {
        for (let i = 0; i < 18; i++) setTimeout(() => this._coinArc(this._anchorEnemy, anchor), i*60);
        this._spawnText(this.W/2, this.H*0.32, 'DEAL STRUCK', '#ffd700', 32);
        if (pp) pp.crew.forEach(c => { c.state='celebrate'; c.alertTimer=4; });
      } else {
        this._spawnText(anchor.x, anchor.y-80, 'REJECTED!', '#ff4466', 28);
        this._explode(anchor.x, anchor.y-60, 0xffffff, 15);
        setTimeout(() => this.playAttack(false, () => {}), 300);
      }
    });
  }

  playTelegraph(stance) {
    this._guard(() => {
      const enemy = this.ships.enemy, anchor = this._anchorEnemy;
      const ep = this._parts.enemy;
      if (!enemy) return;
      if (stance === 'AGGRESSIVE') {
        if (ep) { ep.xSpring.impulse(-30); ep.crew.forEach(c => { c.state='alert'; c.alertTimer=2; }); }
        this._glowShip('enemy', 0xff4444);
        this._spawnText(anchor.x, anchor.y-90, 'LOADING ALL GUNS', '#ff4444', 14);
      } else if (stance === 'DEFENSIVE') {
        this._shieldRing(anchor.x, anchor.y);
        this._spawnText(anchor.x, anchor.y-90, 'FORMING BARRIER', '#4a9eff', 14);
      } else if (stance === 'DESPERATE') {
        if (ep) ep.mastSwayMain.impulse(0.2);
        this._shakeShip('enemy', 12, 8);
        this._smokeCloud(anchor.x, anchor.y+20);
        this._spawnText(anchor.x, anchor.y-90, "THEY'RE BREAKING—", '#ff8800', 14);
      }
    });
  }

  playVictory() {
    this._guard(() => {
      const enemy = this.ships.enemy, ep = this._parts.enemy;
      if (enemy) this._tween(enemy, { rotation:1.4, y:this._anchorEnemy.y+160, alpha:0 }, 1800, 'easeIn');
      if (ep) ep.crew.forEach(c => { c.state='celebrate'; c.alertTimer=99; });
      const pp = this._parts.player;
      if (pp) pp.crew.forEach(c => { c.state='celebrate'; c.alertTimer=99; });
      for (let i = 0; i < 40; i++) setTimeout(() => this._coinFall(this.W*0.3+Math.random()*this.W*0.4,-20), i*80);
    });
  }

  playDefeat() {
    this._guard(() => {
      const player = this.ships.player, pp = this._parts.player;
      if (player) this._tween(player, { rotation:0.5, y:this._anchorPlayer.y+180, alpha:0 }, 2000, 'easeIn');
      for (let i = 0; i < 3; i++) setTimeout(() => this._screenFlash(0xff0000, 0.4), i*220);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FX HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  _fireBall(from, to, color, onImpact) {
    if (!this.app) return;
    const ball = new PIXI.Graphics();
    ball.fill({ color }); ball.circle(0,0,9);
    ball.x = from.x; ball.y = from.y; this.app.stage.addChild(ball);
    // Smoke trail
    const trailInterval = setInterval(() => {
      if (this._destroyed || !ball.parent) { clearInterval(trailInterval); return; }
      this._smokeCloud(ball.x, ball.y, 0.25);
    }, 30);
    const midX=(from.x+to.x)/2, midY=Math.min(from.y,to.y)-90;
    const dur=440, t0=performance.now();
    const tick = () => {
      if (this._destroyed || !ball.parent) return;
      const t=Math.min((performance.now()-t0)/dur,1), i=1-t;
      ball.x=i*i*from.x+2*i*t*midX+t*t*to.x;
      ball.y=i*i*from.y+2*i*t*midY+t*t*to.y;
      ball.scale.set(1-t*0.3);
      if (t<1) { requestAnimationFrame(tick); return; }
      clearInterval(trailInterval);
      ball.destroy();
      this._explode(to.x,to.y,color,35);
      this._shakeShip(to===this._anchorEnemy?'enemy':'player');
      EventBus.emit('cannonFired',{x:0,z:to===this._anchorEnemy?-15:15,color});
      EventBus.emit('cameraShake',{intensity:0.35,duration:300});
      onImpact?.();
    }; tick();
  }
  _missShot(from,nearTo) {
    this._fireBall(from,{x:nearTo.x-80,y:nearTo.y+120},0xff4444,()=>this._spawnText(nearTo.x-30,nearTo.y-30,'MISSED','#ffffff44',12));
  }
  _explode(x,y,color,count=28,dur=0.6) {
    if (!this.app||this._destroyed) return;
    for (let i=0;i<count;i++) {
      const g=new PIXI.Graphics(); g.fill({color}); g.circle(0,0,3+Math.random()*9);
      g.x=x; g.y=y; this.app.stage.addChild(g);
      const angle=Math.random()*Math.PI*2,speed=40+Math.random()*120;
      const vx=Math.cos(angle)*speed,vy=Math.sin(angle)*speed-60;
      const gravity=80+Math.random()*60;
      const life=(dur*0.6+Math.random()*dur*0.8)*1000,t0=performance.now();
      const tick=()=>{
        if (this._destroyed||!g.parent) return;
        const el=(performance.now()-t0)/1000;
        if (el>life/1000){g.destroy();return;}
        const tp=el/(life/1000);
        g.x=x+vx*el; g.y=y+vy*el+0.5*gravity*el*el;
        g.alpha=1-tp; g.scale.set(1-tp*0.7); requestAnimationFrame(tick);
      }; tick();
    }
    for (let i=0;i<5;i++) {
      const sm=new PIXI.Graphics(); sm.fill({color:0x334455,alpha:0.5}); sm.circle(0,0,12+Math.random()*14);
      sm.x=x+(Math.random()-0.5)*24; sm.y=y+(Math.random()-0.5)*24; this.app.stage.addChild(sm);
      const t0=performance.now();
      const tick=()=>{
        if (this._destroyed||!sm.parent) return;
        const tp=Math.min((performance.now()-t0)/900,1);
        sm.scale.set(1+tp*2.5); sm.alpha=0.45*(1-tp); sm.y-=0.4;
        if (tp<1) requestAnimationFrame(tick); else sm.destroy();
      }; tick();
    }
  }
  _drawGrappleLines(x1,y1,x2,y2) {
    for (let i=0;i<4;i++) setTimeout(()=>{
      if (this._destroyed||!this.app) return;
      const g=new PIXI.Graphics(); g.stroke({color:0xbbaa88,width:1.5,alpha:0.7});
      g.moveTo(x1,y1+(i-1.5)*14); g.lineTo(x2,y2+(i-1.5)*14); this.app.stage.addChild(g);
      setTimeout(()=>{if(g.parent)g.destroy();},700);
    },i*100);
  }
  _shieldRing(x,y) {
    for (let i=0;i<3;i++) setTimeout(()=>{
      if (this._destroyed||!this.app) return;
      const g=new PIXI.Graphics(); g.stroke({color:0x4a9eff,width:2,alpha:0.6}); g.circle(x,y,50); g.scale.set(0.5);
      this.app.stage.addChild(g);
      const t0=performance.now();
      const tick=()=>{
        if (this._destroyed||!g.parent) return;
        const tp=Math.min((performance.now()-t0)/700,1);
        g.scale.set(0.5+tp*1.8); g.alpha=0.6*(1-tp);
        if (tp<1) requestAnimationFrame(tick); else g.destroy();
      }; tick();
    },i*180);
  }
  _smokeCloud(x,y,alphaMult=1) {
    if (!this.app||this._destroyed) return;
    for (let i=0;i<3;i++) setTimeout(()=>{
      if (this._destroyed||!this.app) return;
      const g=new PIXI.Graphics(); g.fill({color:0x334455,alpha:0.55*alphaMult}); g.circle(0,0,10+Math.random()*14);
      g.x=x+(Math.random()-0.5)*20; g.y=y; this.app.stage.addChild(g);
      const startY=g.y,t0=performance.now();
      const tick=()=>{
        if (this._destroyed||!g.parent) return;
        const tp=Math.min((performance.now()-t0)/900,1);
        g.scale.set(1+tp*2); g.alpha=0.5*alphaMult*(1-tp); g.y=startY-tp*40;
        if (tp<1) requestAnimationFrame(tick); else g.destroy();
      }; tick();
    },i*80);
  }
  _coinArc(from,to) {
    if (!this.app||this._destroyed) return;
    const g=new PIXI.Graphics(); g.fill({color:0xffd700}); g.circle(0,0,5);
    g.x=from.x; g.y=from.y; this.app.stage.addChild(g);
    const midX=(from.x+to.x)/2,midY=Math.min(from.y,to.y)-80-Math.random()*60;
    const dur=500+Math.random()*300,t0=performance.now();
    const tick=()=>{
      if (this._destroyed||!g.parent) return;
      const t=Math.min((performance.now()-t0)/dur,1),i=1-t;
      g.x=i*i*from.x+2*i*t*midX+t*t*to.x;
      g.y=i*i*from.y+2*i*t*midY+t*t*to.y;
      g.rotation+=0.15;
      if (t<1) requestAnimationFrame(tick); else g.destroy();
    }; tick();
  }
  _coinFall(x,startY) {
    if (!this.app||this._destroyed) return;
    const g=new PIXI.Graphics(); g.fill({color:0xffd700}); g.circle(0,0,4+Math.random()*4);
    g.x=x; g.y=startY; this.app.stage.addChild(g);
    const speed=3+Math.random()*4;
    const tick=()=>{
      if (this._destroyed||!g.parent) return;
      g.y+=speed; g.rotation+=0.1;
      if (g.y>this.H+20){g.destroy();return;}
      requestAnimationFrame(tick);
    }; tick();
  }
  _shakeShip(which,intensity=8,times=6) {
    const p=this._parts[which];
    if (!p) return;
    p.xSpring.impulse((Math.random()-0.5)*intensity*15);
    p.ySpring.impulse(-intensity*8);
    p.rotSpring.impulse((Math.random()-0.5)*0.1);
  }
  _glowShip(which,color) {
    const ship=this.ships[which]; if (!ship) return;
    ship.tint=color;
    setTimeout(()=>{if(!this._destroyed&&ship)ship.tint=0xffffff;},400);
  }
  _screenFlash(color,alpha=0.35) {
    if (!this.app||this._destroyed) return;
    const g=new PIXI.Graphics(); g.fill({color,alpha}); g.rect(0,0,this.W,this.H);
    this.app.stage.addChild(g);
    const t0=performance.now();
    const tick=()=>{
      if (this._destroyed||!g.parent) return;
      const tp=Math.min((performance.now()-t0)/200,1);
      g.alpha=alpha*(1-tp);
      if (tp<1) requestAnimationFrame(tick); else g.destroy();
    }; tick();
  }
  _spawnText(x,y,text,color='#ffffff',size=20) {
    if (!this.app||this._destroyed) return;
    const t=new PIXI.Text({text,style:{
      fontFamily:'Courier New',fontSize:size,fill:color,fontWeight:'bold',letterSpacing:4,
      dropShadow:{color:'#000000',blur:8,distance:0},
    }});
    t.anchor.set(0.5); t.x=x; t.y=y; this.app.stage.addChild(t);
    const startY=y,t0=performance.now();
    const tick=()=>{
      if (this._destroyed||!t.parent) return;
      const tp=Math.min((performance.now()-t0)/1200,1);
      t.y=startY-tp*55;
      t.alpha=tp<0.7?1:1-(tp-0.7)/0.3;
      if (tp<1) requestAnimationFrame(tick); else t.destroy();
    }; tick();
  }

  // ── TWEEN ─────────────────────────────────────────────────────────────────
  _tween(target,props,duration,ease='linear',onComplete) {
    const from={};
    Object.keys(props).forEach(k=>from[k]=target[k]);
    const easeFn={
      linear:t=>t, easeIn:t=>t*t*t,
      easeOut:t=>1-Math.pow(1-t,3),
      easeInOut:t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
    }[ease]||(t=>t);
    const t0=performance.now();
    const tick=()=>{
      if (this._destroyed) return;
      const t=Math.min((performance.now()-t0)/duration,1);
      Object.keys(props).forEach(k=>target[k]=from[k]+(props[k]-from[k])*easeFn(t));
      if (t<1) requestAnimationFrame(tick); else onComplete?.();
    }; tick();
  }

  // ── EVENTS ────────────────────────────────────────────────────────────────
  _bindEvents() {
    EventBus.on('playAttack',    ({fromPlayer,onImpact})=>this.playAttack(fromPlayer,onImpact));
    EventBus.on('playBoard',     ()=>this.playBoard());
    EventBus.on('playEvade',     ({success})=>this.playEvade(success));
    EventBus.on('playSabotage',  ()=>this.playSabotage());
    EventBus.on('playNegotiate', ({success})=>this.playNegotiate(success));
    EventBus.on('playTelegraph', ({stance})=>this.playTelegraph(stance));
    EventBus.on('playVictory',   ()=>this.playVictory());
    EventBus.on('playDefeat',    ()=>this.playDefeat());
    EventBus.on('rainSplash',    ({x})=>this._explode(x,this.H*0.55,0x8899cc,4,0.3));
  }

  // ── DESTROY ───────────────────────────────────────────────────────────────
  destroy() {
    this._destroyed=true;
    if (this._resizeHandler) { window.removeEventListener('resize',this._resizeHandler); this._resizeHandler=null; }
    if (this.ready&&this.app) { try{this.app.destroy();}catch(_){} }
    this.app=null; this.ships={}; this._parts={};
  }
}
