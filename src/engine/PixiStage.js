import * as PIXI from 'pixi.js';
import EventBus from './EventBus.js';

export default class PixiStage {
  constructor(canvas) {
    this.canvas       = canvas;
    this.app          = null;
    this.ships        = {};
    this.ready        = false;
    this._destroyed   = false;
    this._initPromise = this._init();
  }

  async _init() {
    this.app = new PIXI.Application();
    await this.app.init({
      canvas:          this.canvas,
      width:           window.innerWidth,
      height:          window.innerHeight,
      backgroundAlpha: 0,
      antialias:       true,
      resolution:      Math.min(window.devicePixelRatio, 2),
      autoDensity:     true,
    });
    if (this._destroyed) { try { this.app.destroy(); } catch (_) {} return; }
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.ready = true;
    this._loadShipSprites();
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

  // ── SHIPS ───────────────────────────────────────────────────────
  _loadShipSprites() {
    const W = this.W, H = this.H;
    const shipH = Math.min(H * 0.44, 280);

    this.ships.player  = this._buildPirateShip(false, shipH);
    this.ships.player.x = W * 0.22;
    this.ships.player.y = H * 0.54;
    this._anchorPlayer  = { x: W * 0.22, y: H * 0.54 };
    this.app.stage.addChild(this.ships.player);

    this.ships.enemy   = this._buildPirateShip(true, shipH);
    this.ships.enemy.x  = W * 0.78;
    this.ships.enemy.y  = H * 0.54;
    this._anchorEnemy   = { x: W * 0.78, y: H * 0.54 };
    this.app.stage.addChild(this.ships.enemy);

    this._idleTick = 0;
    this.app.ticker.add(() => {
      this._idleTick += 0.016;
      const t = this._idleTick;
      if (this.ships.player) {
        this.ships.player.y        = this._anchorPlayer.y + Math.sin(t) * 8;
        this.ships.player.rotation = Math.sin(t * 0.65) * 0.022;
      }
      if (this.ships.enemy) {
        this.ships.enemy.y         = this._anchorEnemy.y  + Math.sin(t + 1.3) * 8;
        this.ships.enemy.rotation  = Math.sin(t * 0.65 + 1.3) * 0.022;
      }
    });
  }

  // ── FULL PIRATE SHIP BUILDER ──────────────────────────────────────
  // enemy=true flips horizontally and uses red/dark palette
  _buildPirateShip(enemy, shipH) {
    const c    = new PIXI.Container();
    const s    = shipH / 300;   // uniform scale factor
    const flip = enemy ? -1 : 1;

    // Colour palettes
    const hullDark   = enemy ? 0x5a1a1a : 0x1a3a2a;
    const hullMid    = enemy ? 0x8b3030 : 0x2a5a3a;
    const hullLight  = enemy ? 0xb04040 : 0x3a7a50;
    const woodDark   = enemy ? 0x6b3520 : 0x4a2e18;
    const woodMid    = enemy ? 0x9b5530 : 0x7a4e28;
    const sailColor  = enemy ? 0xc8a080 : 0xe8d8b0;
    const sailShadow = enemy ? 0x8a6050 : 0xb0a080;
    const ropeCol    = 0xaa9966;
    const flagCol    = enemy ? 0xcc2222 : 0x00aa66;

    // ─── WATER REFLECTION (below waterline) ───
    const refl = new PIXI.Graphics();
    refl.fill({ color: hullMid, alpha: 0.18 });
    refl.moveTo(-70*s*flip,  8*s);
    refl.bezierCurveTo(-90*s*flip, 20*s, -60*s*flip, 45*s,  0,        50*s);
    refl.bezierCurveTo( 60*s*flip, 45*s,  90*s*flip, 20*s,  70*s*flip, 8*s);
    refl.closePath();
    c.addChild(refl);

    // ─── HULL ───
    // Main hull body — curved bottom
    const hull = new PIXI.Graphics();
    // Shadow/dark side of hull
    hull.fill({ color: hullDark });
    hull.moveTo(-72*s*flip, -8*s);
    hull.bezierCurveTo(-88*s*flip, 10*s, -75*s*flip, 38*s, -48*s*flip, 52*s);
    hull.lineTo( 48*s*flip, 52*s);
    hull.bezierCurveTo( 75*s*flip, 38*s,  88*s*flip, 10*s,  72*s*flip, -8*s);
    hull.closePath();
    // Mid hull
    hull.fill({ color: hullMid });
    hull.moveTo(-68*s*flip, -8*s);
    hull.bezierCurveTo(-82*s*flip,  8*s, -70*s*flip, 34*s, -44*s*flip, 48*s);
    hull.lineTo( 44*s*flip, 48*s);
    hull.bezierCurveTo( 70*s*flip, 34*s,  82*s*flip,  8*s,  68*s*flip, -8*s);
    hull.closePath();
    // Hull highlight strip
    hull.fill({ color: hullLight, alpha: 0.5 });
    hull.moveTo(-62*s*flip, -8*s);
    hull.bezierCurveTo(-72*s*flip, 2*s, -64*s*flip, 12*s, -42*s*flip, 16*s);
    hull.lineTo( 42*s*flip, 16*s);
    hull.bezierCurveTo( 64*s*flip, 12*s,  72*s*flip,  2*s,  62*s*flip, -8*s);
    hull.closePath();
    c.addChild(hull);

    // ─── HULL PLANKS (horizontal lines) ───
    const planks = new PIXI.Graphics();
    planks.setStrokeStyle({ width: 0.8*s, color: hullDark, alpha: 0.6 });
    for (let i = 0; i < 4; i++) {
      const py = -2*s + i * 13*s;
      const xo = 10*s * i;
      planks.moveTo((-60+xo)*s*flip, py);
      planks.lineTo(( 60-xo)*s*flip, py);
      planks.stroke();
    }
    c.addChild(planks);

    // ─── CANNON PORTS (4 holes along hull side) ───
    const cannons = new PIXI.Graphics();
    const portY = 4*s;
    [-38, -16, 10, 32].forEach(px => {
      cannons.fill({ color: 0x111111 });
      cannons.ellipse(px*s*flip, portY, 5.5*s, 4*s);
      // Cannon barrel peeking out
      cannons.fill({ color: 0x333333 });
      cannons.rect((px-2)*s*flip - (enemy ? 7*s : 0), portY - 2*s, 7*s, 4*s);
    });
    c.addChild(cannons);

    // ─── DECK ───
    const deck = new PIXI.Graphics();
    deck.fill({ color: woodMid });
    deck.moveTo(-65*s*flip, -12*s);
    deck.lineTo( 65*s*flip, -12*s);
    deck.lineTo( 55*s*flip, -22*s);
    deck.lineTo(-55*s*flip, -22*s);
    deck.closePath();
    // Deck planks
    deck.setStrokeStyle({ width: 0.7*s, color: woodDark, alpha: 0.8 });
    for (let i = -4; i <= 4; i++) {
      deck.moveTo(i*14*s*flip, -22*s);
      deck.lineTo(i*16*s*flip, -12*s);
      deck.stroke();
    }
    c.addChild(deck);

    // ─── STERN CASTLE (raised rear) ───
    const stern = new PIXI.Graphics();
    stern.fill({ color: hullDark });
    stern.moveTo( 52*s*flip, -22*s);
    stern.lineTo( 70*s*flip, -22*s);
    stern.lineTo( 70*s*flip, -52*s);
    stern.lineTo( 52*s*flip, -52*s);
    stern.closePath();
    stern.fill({ color: woodMid });
    stern.moveTo( 54*s*flip, -24*s);
    stern.lineTo( 68*s*flip, -24*s);
    stern.lineTo( 68*s*flip, -50*s);
    stern.lineTo( 54*s*flip, -50*s);
    stern.closePath();
    // Stern windows
    stern.fill({ color: 0xffe090, alpha: 0.7 });
    stern.rect( 57*s*flip - (enemy ? 8*s : 0), -46*s, 7*s, 5*s);
    stern.rect( 57*s*flip - (enemy ? 8*s : 0), -38*s, 7*s, 5*s);
    c.addChild(stern);

    // ─── BOW SPRIT ───
    const bow = new PIXI.Graphics();
    bow.fill({ color: woodMid });
    bow.moveTo(-54*s*flip, -22*s);
    bow.lineTo(-100*s*flip, -55*s);
    bow.lineTo(-96*s*flip, -58*s);
    bow.lineTo(-50*s*flip, -25*s);
    bow.closePath();
    // Bowsprit rope
    bow.setStrokeStyle({ width: 1*s, color: ropeCol, alpha: 0.8 });
    bow.moveTo(-54*s*flip, -22*s); bow.lineTo(-98*s*flip, -57*s); bow.stroke();
    c.addChild(bow);

    // ─── MAIN MAST ───
    const mast1 = new PIXI.Graphics();
    mast1.fill({ color: woodDark });
    mast1.rect(-3.5*s, -195*s, 7*s, 183*s);    // main pole
    mast1.rect(-3*s,  -195*s,  6*s, 3*s);      // top cap
    // Cross yards
    mast1.fill({ color: woodMid });
    mast1.rect(-48*s, -190*s, 96*s, 5*s);      // top yard
    mast1.rect(-38*s, -140*s, 76*s, 4.5*s);    // mid yard
    mast1.rect(-28*s, -90*s,  56*s, 4*s);      // lower yard
    c.addChild(mast1);

    // ─── FORE MAST ───
    const mast2 = new PIXI.Graphics();
    mast2.fill({ color: woodDark });
    mast2.rect((-24 - 2)*s*flip, -155*s, 5.5*s, 133*s);
    mast2.fill({ color: woodMid });
    mast2.rect((-24 - 36)*s*flip, -150*s, 72*s*Math.abs(flip), 4*s);
    mast2.rect((-24 - 26)*s*flip, -110*s, 52*s*Math.abs(flip), 3.5*s);
    c.addChild(mast2);

    // ─── SAILS (main mast) ───
    const sails = new PIXI.Graphics();
    // Top sail
    sails.fill({ color: sailColor, alpha: 0.92 });
    sails.moveTo(-46*s, -188*s);
    sails.bezierCurveTo(-50*s, -165*s, 50*s, -165*s, 46*s, -188*s);
    sails.lineTo(-46*s, -188*s);
    // Top sail shadow
    sails.fill({ color: sailShadow, alpha: 0.4 });
    sails.moveTo(-46*s, -188*s);
    sails.bezierCurveTo(-48*s, -175*s, -10*s, -170*s, 0, -168*s);
    sails.lineTo( 0, -188*s); sails.closePath();

    // Mid sail
    sails.fill({ color: sailColor, alpha: 0.9 });
    sails.moveTo(-36*s, -138*s);
    sails.bezierCurveTo(-42*s, -105*s, 42*s, -105*s, 36*s, -138*s);
    sails.closePath();
    sails.fill({ color: sailShadow, alpha: 0.35 });
    sails.moveTo(-36*s, -138*s);
    sails.bezierCurveTo(-40*s, -122*s, -8*s, -115*s, 0, -112*s);
    sails.lineTo(0, -138*s); sails.closePath();

    // Lower main sail (biggest)
    sails.fill({ color: sailColor, alpha: 0.88 });
    sails.moveTo(-26*s, -88*s);
    sails.bezierCurveTo(-32*s, -44*s, 32*s, -44*s, 26*s, -88*s);
    sails.closePath();
    sails.fill({ color: sailShadow, alpha: 0.3 });
    sails.moveTo(-26*s, -88*s);
    sails.bezierCurveTo(-30*s, -65*s, -6*s, -55*s, 0, -52*s);
    sails.lineTo(0, -88*s); sails.closePath();
    c.addChild(sails);

    // ─── FORE SAILS ───
    const fsails = new PIXI.Graphics();
    const fx = -24*s*flip;
    // Upper fore sail
    fsails.fill({ color: sailColor, alpha: 0.88 });
    fsails.moveTo(fx - 34*s*flip, -148*s);
    fsails.bezierCurveTo(fx - 38*s*flip, -122*s, fx + 34*s*flip, -122*s, fx + 32*s*flip, -148*s);
    fsails.closePath();
    // Lower fore sail
    fsails.fill({ color: sailColor, alpha: 0.85 });
    fsails.moveTo(fx - 24*s*flip, -108*s);
    fsails.bezierCurveTo(fx - 28*s*flip, -78*s, fx + 24*s*flip, -78*s, fx + 22*s*flip, -108*s);
    fsails.closePath();
    c.addChild(fsails);

    // ─── JIB SAIL (triangular, bowsprit) ───
    const jib = new PIXI.Graphics();
    jib.fill({ color: sailColor, alpha: 0.75 });
    jib.moveTo(-54*s*flip, -22*s);
    jib.lineTo(-100*s*flip, -55*s);
    jib.lineTo(-24*s*flip,  -80*s);
    jib.closePath();
    c.addChild(jib);

    // ─── RIGGING ROPES ───
    const ropes = new PIXI.Graphics();
    ropes.setStrokeStyle({ width: 1*s, color: ropeCol, alpha: 0.65 });
    // Shrouds from main mast top to hull sides
    [[-52, -22], [52, -22]].forEach(([rx, ry]) => {
      ropes.moveTo(0, -193*s); ropes.lineTo(rx*s*flip, ry*s); ropes.stroke();
    });
    // Stays from main top to foremast
    ropes.moveTo(0, -190*s); ropes.lineTo(-24*s*flip, -153*s); ropes.stroke();
    // Shrouds from fore mast
    ropes.moveTo(-24*s*flip, -153*s); ropes.lineTo(-50*s*flip, -22*s); ropes.stroke();
    // Back stay
    ropes.moveTo(0, -140*s); ropes.lineTo( 60*s*flip, -22*s); ropes.stroke();
    // Horizontal ratlines
    ropes.setStrokeStyle({ width: 0.6*s, color: ropeCol, alpha: 0.4 });
    for (let i = 0; i < 5; i++) {
      const ry = -22*s - i * 34*s;
      const w  = 10 + i * 9;
      ropes.moveTo(-( w+2)*s*flip, ry); ropes.lineTo(-(w-8)*s*flip, ry); ropes.stroke();
    }
    c.addChild(ropes);

    // ─── CROW'S NEST ───
    const nest = new PIXI.Graphics();
    nest.fill({ color: woodDark });
    nest.rect(-10*s, -202*s, 20*s, 10*s);
    nest.setStrokeStyle({ width: 1.2*s, color: woodMid });
    nest.moveTo(-10*s, -202*s); nest.lineTo(-10*s, -192*s); nest.stroke();
    nest.moveTo( 10*s, -202*s); nest.lineTo( 10*s, -192*s); nest.stroke();
    c.addChild(nest);

    // ─── FLAG ───
    const flag = new PIXI.Graphics();
    flag.fill({ color: flagCol, alpha: 0.9 });
    flag.moveTo(0, -205*s);
    flag.lineTo(22*s*flip, -196*s);
    flag.lineTo(0, -188*s);
    flag.closePath();
    // Skull
    flag.fill({ color: 0xffffff, alpha: 0.85 });
    flag.circle(8*s*flip, -197*s, 4*s);
    flag.fill({ color: flagCol });
    flag.circle(6*s*flip, -198*s, 1.3*s);
    flag.circle(10*s*flip, -198*s, 1.3*s);
    c.addChild(flag);

    // ─── CREW FIGURES (3 stick figures on deck) ───
    const crewPositions = [[-30, 0], [0, 0], [28, 0]];
    crewPositions.forEach(([cx, _]) => {
      const crew = new PIXI.Graphics();
      const crewX = cx * s * flip;
      const baseY = -22*s;
      const cs = 0.85 * s;
      // Body
      crew.setStrokeStyle({ width: 2*cs, color: 0xddccaa, alpha: 0.9 });
      crew.moveTo(crewX, baseY - 18*cs); crew.lineTo(crewX, baseY - 8*cs); crew.stroke();
      // Head
      crew.fill({ color: 0xddccaa, alpha: 0.9 });
      crew.circle(crewX, baseY - 21*cs, 4*cs);
      // Hat
      crew.fill({ color: 0x111111 });
      crew.rect(crewX - 5*cs, baseY - 27*cs, 10*cs, 7*cs);
      crew.rect(crewX - 7*cs, baseY - 20*cs, 14*cs, 2.5*cs);
      // Arms
      crew.setStrokeStyle({ width: 1.5*cs, color: 0xddccaa, alpha: 0.85 });
      crew.moveTo(crewX - 6*cs, baseY - 15*cs); crew.lineTo(crewX + 6*cs, baseY - 15*cs); crew.stroke();
      // Legs
      crew.moveTo(crewX, baseY - 8*cs); crew.lineTo(crewX - 4*cs, baseY); crew.stroke();
      crew.moveTo(crewX, baseY - 8*cs); crew.lineTo(crewX + 4*cs, baseY); crew.stroke();
      c.addChild(crew);
    });

    // ─── SAIL STITCHING DETAILS ───
    const stitch = new PIXI.Graphics();
    stitch.setStrokeStyle({ width: 0.8*s, color: 0x776655, alpha: 0.5 });
    // Horizontal seams on main lower sail
    [-80, -70, -60, -52].forEach(sy => {
      const ww = Math.abs(sy + 88) / 44 * 26;
      stitch.moveTo(-ww*s, sy*s); stitch.lineTo(ww*s, sy*s); stitch.stroke();
    });
    c.addChild(stitch);

    // ─── LANTERN on stern ───
    const lantern = new PIXI.Graphics();
    lantern.fill({ color: 0xffe090, alpha: 0.8 });
    lantern.circle(64*s*flip, -56*s, 4*s);
    lantern.fill({ color: 0xffd060, alpha: 0.25 });
    lantern.circle(64*s*flip, -56*s, 10*s);
    c.addChild(lantern);

    // Animate lantern flicker
    let lt = Math.random() * Math.PI * 2;
    this.app.ticker.add(() => {
      if (this._destroyed) return;
      lt += 0.08;
      lantern.alpha = 0.7 + Math.sin(lt) * 0.3;
    });

    return c;
  }

  _repositionShips() {
    this._anchorPlayer = { x: this.W * 0.22, y: this.H * 0.54 };
    this._anchorEnemy  = { x: this.W * 0.78, y: this.H * 0.54 };
    if (this.ships.player) { this.ships.player.x = this._anchorPlayer.x; this.ships.player.y = this._anchorPlayer.y; }
    if (this.ships.enemy)  { this.ships.enemy.x  = this._anchorEnemy.x;  this.ships.enemy.y  = this._anchorEnemy.y;  }
  }

  // ── ACTION ANIMATIONS ──────────────────────────────────────────────────
  playAttack(fromPlayer, onImpact) {
    this._guard(() => {
      const from = fromPlayer ? this._anchorPlayer : this._anchorEnemy;
      const to   = fromPlayer ? this._anchorEnemy  : this._anchorPlayer;
      this._fireBall(from, to, fromPlayer ? 0x00f5d4 : 0xff4444, onImpact);
    });
  }
  playBoard() {
    this._guard(() => {
      const player = this.ships.player, anchor = this._anchorPlayer;
      if (!player) return;
      this._tween(player, { x: anchor.x + 220 }, 380, 'easeIn', () => {
        this._drawGrappleLines(anchor.x + 220, anchor.y, this._anchorEnemy.x - 40, this._anchorEnemy.y);
        this._shakeShip('player'); this._shakeShip('enemy');
        setTimeout(() => this._tween(player, { x: anchor.x }, 500, 'easeOut'), 600);
      });
    });
  }
  playEvade(success) {
    this._guard(() => {
      const player = this.ships.player, anchor = this._anchorPlayer;
      if (!player) return;
      if (success) {
        this._tween(player, { x: anchor.x - 90, y: anchor.y + 55, rotation: -0.18 }, 280, 'easeIn', () => {
          this._missShot(this._anchorEnemy, { x: anchor.x - 90, y: anchor.y + 55 });
          setTimeout(() => this._tween(player, { x: anchor.x, y: anchor.y, rotation: 0 }, 440, 'easeOut'), 200);
        });
      } else {
        this._shakeShip('player');
        this._spawnText(anchor.x, anchor.y - 60, '⛳ ANCHORED', '#ffaa00', 22);
      }
    });
  }
  playSabotage() {
    this._guard(() => {
      const from = this._anchorPlayer, to = this._anchorEnemy;
      const skiff = new PIXI.Graphics();
      skiff.fill({ color: 0x334455 }); skiff.ellipse(0, 0, 14, 6);
      skiff.x = from.x + 60; skiff.y = from.y + 80;
      this.app.stage.addChild(skiff);
      this._tween(skiff, { x: to.x - 60, y: to.y + 80 }, 600, 'linear', () => {
        skiff.destroy();
        this._explode(to.x - 40, to.y + 60, 0x9b59b6, 30);
        this._shakeShip('enemy');
        this._spawnText(to.x, to.y - 70, 'RATTLED', '#9b59b6', 18);
      });
    });
  }
  playNegotiate(success) {
    this._guard(() => {
      const anchor = this._anchorPlayer;
      if (success) {
        for (let i = 0; i < 18; i++) setTimeout(() => this._coinArc(this._anchorEnemy, anchor), i * 60);
        this._spawnText(this.W / 2, this.H * 0.32, 'DEAL STRUCK', '#ffd700', 32);
      } else {
        this._spawnText(anchor.x, anchor.y - 80, 'REJECTED!', '#ff4466', 28);
        this._explode(anchor.x, anchor.y - 60, 0xffffff, 15);
        setTimeout(() => this.playAttack(false, () => {}), 300);
      }
    });
  }
  playTelegraph(stance) {
    this._guard(() => {
      const enemy = this.ships.enemy, anchor = this._anchorEnemy;
      if (!enemy) return;
      if (stance === 'AGGRESSIVE') {
        this._tween(enemy, { x: anchor.x - 80 }, 500, 'easeIn', () => this._tween(enemy, { x: anchor.x }, 600, 'easeOut'));
        this._glowShip('enemy', 0xff4444);
        this._spawnText(anchor.x, anchor.y - 90, 'LOADING ALL GUNS', '#ff4444', 14);
      } else if (stance === 'DEFENSIVE') {
        this._shieldRing(anchor.x, anchor.y);
        this._spawnText(anchor.x, anchor.y - 90, 'FORMING BARRIER', '#4a9eff', 14);
      } else if (stance === 'DESPERATE') {
        this._shakeShip('enemy', 12, 8);
        this._smokeCloud(anchor.x, anchor.y + 20);
        this._spawnText(anchor.x, anchor.y - 90, "THEY'RE BREAKING—", '#ff8800', 14);
      }
    });
  }
  playVictory() {
    this._guard(() => {
      const enemy = this.ships.enemy;
      if (enemy) this._tween(enemy, { rotation: 1.4, y: this._anchorEnemy.y + 160, alpha: 0 }, 1800, 'easeIn');
      for (let i = 0; i < 40; i++) setTimeout(() => this._coinFall(this.W * 0.3 + Math.random() * this.W * 0.4, -20), i * 80);
      const player = this.ships.player;
      if (player) this._tween(player, { rotation: -0.18 }, 700, 'easeOut');
    });
  }
  playDefeat() {
    this._guard(() => {
      const player = this.ships.player;
      if (player) this._tween(player, { rotation: 0.5, y: this._anchorPlayer.y + 180, alpha: 0 }, 2000, 'easeIn');
      for (let i = 0; i < 3; i++) setTimeout(() => this._screenFlash(0xff0000, 0.4), i * 220);
    });
  }

  // ── FX ─────────────────────────────────────────────────────────────────
  _fireBall(from, to, color, onImpact) {
    if (!this.app) return;
    const ball = new PIXI.Graphics();
    ball.fill({ color }); ball.circle(0, 0, 9);
    ball.x = from.x; ball.y = from.y;
    this.app.stage.addChild(ball);
    this._explode(from.x, from.y, color, 8, 0.2);
    const midX = (from.x + to.x) / 2, midY = Math.min(from.y, to.y) - 90;
    const dur = 440, t0 = performance.now();
    const tick = () => {
      if (this._destroyed || !ball.parent) return;
      const t = Math.min((performance.now() - t0) / dur, 1), i = 1 - t;
      ball.x = i*i*from.x + 2*i*t*midX + t*t*to.x;
      ball.y = i*i*from.y + 2*i*t*midY + t*t*to.y;
      ball.scale.set(1 - t * 0.3);
      if (t < 1) { requestAnimationFrame(tick); return; }
      ball.destroy();
      this._explode(to.x, to.y, color, 35);
      this._shakeShip(to === this._anchorEnemy ? 'enemy' : 'player');
      EventBus.emit('cannonFired', { x: 0, z: to === this._anchorEnemy ? -15 : 15, color });
      EventBus.emit('cameraShake', { intensity: 0.35, duration: 300 });
      onImpact?.();
    }; tick();
  }
  _missShot(from, nearTo) {
    this._fireBall(from, { x: nearTo.x - 80, y: nearTo.y + 120 }, 0xff4444, () =>
      this._spawnText(nearTo.x - 30, nearTo.y - 30, 'MISSED', '#ffffff44', 12));
  }
  _explode(x, y, color, count = 28, dur = 0.6) {
    if (!this.app || this._destroyed) return;
    for (let i = 0; i < count; i++) {
      const g = new PIXI.Graphics();
      g.fill({ color }); g.circle(0, 0, 3 + Math.random() * 9);
      g.x = x; g.y = y; this.app.stage.addChild(g);
      const angle = Math.random() * Math.PI * 2, speed = 40 + Math.random() * 120;
      const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed - 60;
      const gravity = 80 + Math.random() * 60;
      const life = (dur * 0.6 + Math.random() * dur * 0.8) * 1000, t0 = performance.now();
      const tick = () => {
        if (this._destroyed || !g.parent) return;
        const el = (performance.now() - t0) / 1000;
        if (el > life / 1000) { g.destroy(); return; }
        const tp = el / (life / 1000);
        g.x = x + vx * el; g.y = y + vy * el + 0.5 * gravity * el * el;
        g.alpha = 1 - tp; g.scale.set(1 - tp * 0.7); requestAnimationFrame(tick);
      }; tick();
    }
    for (let i = 0; i < 5; i++) {
      const sm = new PIXI.Graphics();
      sm.fill({ color: 0x334455, alpha: 0.5 }); sm.circle(0, 0, 12 + Math.random() * 14);
      sm.x = x + (Math.random() - 0.5) * 24; sm.y = y + (Math.random() - 0.5) * 24;
      this.app.stage.addChild(sm);
      const t0 = performance.now();
      const tick = () => {
        if (this._destroyed || !sm.parent) return;
        const tp = Math.min((performance.now() - t0) / 900, 1);
        sm.scale.set(1 + tp * 2.5); sm.alpha = 0.45 * (1 - tp); sm.y -= 0.4;
        if (tp < 1) requestAnimationFrame(tick); else sm.destroy();
      }; tick();
    }
  }
  _drawGrappleLines(x1, y1, x2, y2) {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (this._destroyed || !this.app) return;
        const g = new PIXI.Graphics();
        g.stroke({ color: 0xbbaa88, width: 1.5, alpha: 0.7 });
        g.moveTo(x1, y1 + (i-1.5)*14); g.lineTo(x2, y2 + (i-1.5)*14); this.app.stage.addChild(g);
        setTimeout(() => { if (g.parent) g.destroy(); }, 700);
      }, i * 100);
    }
  }
  _shieldRing(x, y) {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (this._destroyed || !this.app) return;
        const g = new PIXI.Graphics();
        g.stroke({ color: 0x4a9eff, width: 2, alpha: 0.6 }); g.circle(x, y, 50); g.scale.set(0.5);
        this.app.stage.addChild(g);
        const t0 = performance.now();
        const tick = () => {
          if (this._destroyed || !g.parent) return;
          const tp = Math.min((performance.now() - t0) / 700, 1);
          g.scale.set(0.5 + tp*1.8); g.alpha = 0.6*(1-tp);
          if (tp < 1) requestAnimationFrame(tick); else g.destroy();
        }; tick();
      }, i * 180);
    }
  }
  _smokeCloud(x, y) {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        if (this._destroyed || !this.app) return;
        const g = new PIXI.Graphics();
        g.fill({ color: 0x222233, alpha: 0.6 }); g.circle(0, 0, 16 + Math.random()*20);
        g.x = x + (Math.random()-0.5)*40; g.y = y; this.app.stage.addChild(g);
        const startY = g.y, t0 = performance.now();
        const tick = () => {
          if (this._destroyed || !g.parent) return;
          const tp = Math.min((performance.now()-t0)/1400, 1);
          g.scale.set(1+tp*2); g.alpha = 0.55*(1-tp); g.y = startY - tp*50;
          if (tp < 1) requestAnimationFrame(tick); else g.destroy();
        }; tick();
      }, i * 120);
    }
  }
  _coinArc(from, to) {
    if (!this.app || this._destroyed) return;
    const g = new PIXI.Graphics();
    g.fill({ color: 0xffd700 }); g.circle(0, 0, 5);
    g.x = from.x; g.y = from.y; this.app.stage.addChild(g);
    const midX = (from.x+to.x)/2, midY = Math.min(from.y,to.y)-80-Math.random()*60;
    const dur = 500+Math.random()*300, t0 = performance.now();
    const tick = () => {
      if (this._destroyed || !g.parent) return;
      const t = Math.min((performance.now()-t0)/dur, 1), i = 1-t;
      g.x = i*i*from.x+2*i*t*midX+t*t*to.x;
      g.y = i*i*from.y+2*i*t*midY+t*t*to.y;
      g.rotation += 0.15;
      if (t < 1) requestAnimationFrame(tick); else g.destroy();
    }; tick();
  }
  _coinFall(x, startY) {
    if (!this.app || this._destroyed) return;
    const g = new PIXI.Graphics();
    g.fill({ color: 0xffd700 }); g.circle(0, 0, 4+Math.random()*4);
    g.x = x; g.y = startY; this.app.stage.addChild(g);
    const speed = 3+Math.random()*4;
    const tick = () => {
      if (this._destroyed || !g.parent) return;
      g.y += speed; g.rotation += 0.1;
      if (g.y > this.H+20) { g.destroy(); return; }
      requestAnimationFrame(tick);
    }; tick();
  }
  _shakeShip(which, intensity = 8, times = 6) {
    const ship = this.ships[which];
    const anchor = which === 'player' ? this._anchorPlayer : this._anchorEnemy;
    if (!ship) return;
    let count = 0;
    const tick = () => {
      if (this._destroyed) return;
      if (count++ >= times) { ship.x = anchor.x; return; }
      ship.x = anchor.x + (Math.random()-0.5)*intensity;
      setTimeout(tick, 45);
    }; tick();
  }
  _glowShip(which, color) {
    const ship = this.ships[which]; if (!ship) return;
    ship.tint = color;
    setTimeout(() => { if (!this._destroyed && ship) ship.tint = 0xffffff; }, 400);
  }
  _screenFlash(color, alpha = 0.35) {
    if (!this.app || this._destroyed) return;
    const g = new PIXI.Graphics();
    g.fill({ color, alpha }); g.rect(0, 0, this.W, this.H);
    this.app.stage.addChild(g);
    const t0 = performance.now();
    const tick = () => {
      if (this._destroyed || !g.parent) return;
      const tp = Math.min((performance.now()-t0)/200, 1);
      g.alpha = alpha*(1-tp);
      if (tp < 1) requestAnimationFrame(tick); else g.destroy();
    }; tick();
  }
  _spawnText(x, y, text, color = '#ffffff', size = 20) {
    if (!this.app || this._destroyed) return;
    const t = new PIXI.Text({ text, style: {
      fontFamily: 'Courier New', fontSize: size, fill: color,
      fontWeight: 'bold', letterSpacing: 4,
      dropShadow: { color: '#000000', blur: 8, distance: 0 },
    }});
    t.anchor.set(0.5); t.x = x; t.y = y; this.app.stage.addChild(t);
    const startY = y, t0 = performance.now();
    const tick = () => {
      if (this._destroyed || !t.parent) return;
      const tp = Math.min((performance.now()-t0)/1200, 1);
      t.y = startY - tp*55;
      t.alpha = tp < 0.7 ? 1 : 1-(tp-0.7)/0.3;
      if (tp < 1) requestAnimationFrame(tick); else t.destroy();
    }; tick();
  }

  // ── TWEEN ───────────────────────────────────────────────────────────────
  _tween(target, props, duration, ease = 'linear', onComplete) {
    const from = {};
    Object.keys(props).forEach(k => from[k] = target[k]);
    const easeFn = {
      linear:    t => t,
      easeIn:    t => t*t*t,
      easeOut:   t => 1 - Math.pow(1-t, 3),
      easeInOut: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2,
    }[ease] || (t => t);
    const t0 = performance.now();
    const tick = () => {
      if (this._destroyed) return;
      const t = Math.min((performance.now()-t0)/duration, 1);
      Object.keys(props).forEach(k => target[k] = from[k]+(props[k]-from[k])*easeFn(t));
      if (t < 1) requestAnimationFrame(tick); else onComplete?.();
    }; tick();
  }

  // ── EVENTS ─────────────────────────────────────────────────────────────
  _bindEvents() {
    EventBus.on('playAttack',    ({ fromPlayer, onImpact }) => this.playAttack(fromPlayer, onImpact));
    EventBus.on('playBoard',     () => this.playBoard());
    EventBus.on('playEvade',     ({ success }) => this.playEvade(success));
    EventBus.on('playSabotage',  () => this.playSabotage());
    EventBus.on('playNegotiate', ({ success }) => this.playNegotiate(success));
    EventBus.on('playTelegraph', ({ stance }) => this.playTelegraph(stance));
    EventBus.on('playVictory',   () => this.playVictory());
    EventBus.on('playDefeat',    () => this.playDefeat());
    EventBus.on('rainSplash',    ({ x }) => this._explode(x, this.H*0.55, 0x8899cc, 4, 0.3));
  }

  // ── DESTROY ─────────────────────────────────────────────────────────────
  destroy() {
    this._destroyed = true;
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this.ready && this.app) {
      try { this.app.destroy(); } catch (_) {}
    }
    this.app = null; this.ships = {};
  }
}
