import * as PIXI from 'pixi.js';
import EventBus from './EventBus.js';

export default class PixiStage {
  constructor(canvas) {
    this.canvas = canvas;
    this.app    = null;
    this.ships  = {};
    this.ready  = false;
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

    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.ready = true;

    this._loadShipSprites();
    this._bindEvents();

    this._resizeHandler = () => {
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.app.renderer.resize(this.W, this.H);
      this._repositionShips();
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  // ─── GUARD ──────────────────────────────────────────────────────────────────────
  // All public methods check ready first — if called before async init
  // completes, they wait for it.
  _guard(fn) {
    if (this.ready) { fn(); return; }
    this._initPromise.then(() => fn());
  }

  // ─── SHIPS ────────────────────────────────────────────────────────────────────
  _loadShipSprites() {
    const W = this.W, H = this.H;

    // Player ship — try named asset, fall back to a tinted rectangle placeholder
    const playerShip = this._makeShipSprite(
      '/player_ship.png',   // rename your PNG to this in /public/
      W * 0.22, H * 0.52, H * 0.42, false
    );
    this.ships.player = playerShip;
    this._anchorPlayer = { x: W * 0.22, y: H * 0.52 };

    const enemyShip = this._makeShipSprite(
      '/enemy_ship.png',    // rename your PNG to this in /public/
      W * 0.78, H * 0.52, H * 0.42, true
    );
    this.ships.enemy = enemyShip;
    this._anchorEnemy = { x: W * 0.78, y: H * 0.52 };

    // Idle bob
    this._idleTick = 0;
    this.app.ticker.add(() => {
      this._idleTick += 0.018;
      if (this.ships.player) {
        this.ships.player.y        = this._anchorPlayer.y + Math.sin(this._idleTick) * 10;
        this.ships.player.rotation = Math.sin(this._idleTick * 0.7) * 0.028;
      }
      if (this.ships.enemy) {
        this.ships.enemy.y         = this._anchorEnemy.y + Math.sin(this._idleTick + 1.2) * 10;
        this.ships.enemy.rotation  = Math.sin(this._idleTick * 0.7 + 1.2) * 0.028;
      }
    });
  }

  _makeShipSprite(url, x, y, h, flipX) {
    // Build a fallback ship shape in case the PNG is missing
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;

    // Fallback: draw a simple pirate ship silhouette with Graphics
    const g = new PIXI.Graphics();
    const scl = h / 220;   // scale relative to desired height
    const col = flipX ? 0xcc4444 : 0x00c8a0;

    // Hull
    g.fill({ color: col, alpha: 0.85 });
    g.moveTo(-55 * scl,  20 * scl);
    g.lineTo( 55 * scl,  20 * scl);
    g.lineTo( 45 * scl,  55 * scl);
    g.lineTo(-45 * scl,  55 * scl);
    g.closePath();

    // Deck
    g.fill({ color: col, alpha: 0.6 });
    g.rect(-50 * scl, 0, 100 * scl, 22 * scl);

    // Mast
    g.fill({ color: 0xddccaa, alpha: 0.9 });
    g.rect(-3 * scl, -90 * scl, 6 * scl, 92 * scl);

    // Sail
    g.fill({ color: 0xeedd88, alpha: 0.7 });
    g.moveTo(-2  * scl, -88 * scl);
    g.lineTo( 38 * scl, -60 * scl);
    g.lineTo( 30 * scl, -10 * scl);
    g.lineTo(-2  * scl,  -8 * scl);
    g.closePath();

    // Flag
    g.fill({ color: 0x111111, alpha: 1 });
    g.rect(-2 * scl, -110 * scl, 18 * scl, 12 * scl);

    if (flipX) g.scale.x = -1;
    container.addChild(g);
    this.app.stage.addChild(container);

    // Also try to load the real PNG on top — if it exists it replaces the placeholder
    const tex = PIXI.Texture.from(url);
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5, 0.88);
    sprite.height = h;
    sprite.scale.x = flipX ? -sprite.scale.y : sprite.scale.y;
    sprite.blendMode = 'screen';
    // Only add if texture actually loaded (not the 1x1 fallback)
    tex.on('update', () => {
      if (tex.width > 4) {
        g.visible = false;   // hide placeholder once real sprite loads
        container.addChild(sprite);
      }
    });

    return container;
  }

  _repositionShips() {
    this._anchorPlayer = { x: this.W * 0.22, y: this.H * 0.52 };
    this._anchorEnemy  = { x: this.W * 0.78, y: this.H * 0.52 };
    if (this.ships.player) { this.ships.player.x = this._anchorPlayer.x; this.ships.player.y = this._anchorPlayer.y; }
    if (this.ships.enemy)  { this.ships.enemy.x  = this._anchorEnemy.x;  this.ships.enemy.y  = this._anchorEnemy.y;  }
  }

  // ─── ACTION ANIMATIONS ───────────────────────────────────────────────────────

  playAttack(fromPlayer, onImpact) {
    this._guard(() => {
      const from = fromPlayer ? this._anchorPlayer : this._anchorEnemy;
      const to   = fromPlayer ? this._anchorEnemy  : this._anchorPlayer;
      this._fireBall(from, to, fromPlayer ? 0x00f5d4 : 0xff4444, onImpact);
    });
  }

  playBoard() {
    this._guard(() => {
      const player = this.ships.player;
      const anchor = this._anchorPlayer;
      if (!player) return;
      this._tween(player, { x: anchor.x + 220 }, 380, 'easeIn', () => {
        this._drawGrappleLines(anchor.x + 220, anchor.y, this._anchorEnemy.x - 40, this._anchorEnemy.y);
        this._shakeShip('player');
        this._shakeShip('enemy');
        setTimeout(() => this._tween(player, { x: anchor.x }, 500, 'easeOut'), 600);
      });
    });
  }

  playEvade(success) {
    this._guard(() => {
      const player = this.ships.player;
      const anchor = this._anchorPlayer;
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
      const from = this._anchorPlayer;
      const to   = this._anchorEnemy;
      const skiff = new PIXI.Graphics();
      skiff.fill({ color: 0x334455 });
      skiff.ellipse(0, 0, 14, 6);
      skiff.x = from.x + 60;
      skiff.y = from.y + 80;
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
        for (let i = 0; i < 18; i++)
          setTimeout(() => this._coinArc(this._anchorEnemy, anchor), i * 60);
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
      const enemy  = this.ships.enemy;
      const anchor = this._anchorEnemy;
      if (!enemy) return;
      if (stance === 'AGGRESSIVE') {
        this._tween(enemy, { x: anchor.x - 80 }, 500, 'easeIn', () =>
          this._tween(enemy, { x: anchor.x }, 600, 'easeOut'));
        this._glowShip('enemy', 0xff4444);
        this._spawnText(anchor.x, anchor.y - 90, 'LOADING ALL GUNS', '#ff4444', 14);
      } else if (stance === 'DEFENSIVE') {
        this._shieldRing(anchor.x, anchor.y);
        this._spawnText(anchor.x, anchor.y - 90, 'FORMING BARRIER', '#4a9eff', 14);
      } else if (stance === 'DESPERATE') {
        this._shakeShip('enemy', 12, 8);
        this._smokeCloud(anchor.x, anchor.y + 20);
        this._spawnText(anchor.x, anchor.y - 90, 'THEY\'RE BREAKING—', '#ff8800', 14);
      }
    });
  }

  playVictory() {
    this._guard(() => {
      const enemy = this.ships.enemy;
      if (enemy) this._tween(enemy, { rotation: 1.4, y: this._anchorEnemy.y + 160, alpha: 0 }, 1800, 'easeIn');
      for (let i = 0; i < 40; i++)
        setTimeout(() => this._coinFall(this.W * 0.3 + Math.random() * this.W * 0.4, -20), i * 80);
      const player = this.ships.player;
      if (player) this._tween(player, { rotation: -0.18 }, 700, 'easeOut');
    });
  }

  playDefeat() {
    this._guard(() => {
      const player = this.ships.player;
      if (player) this._tween(player, { rotation: 0.5, y: this._anchorPlayer.y + 180, alpha: 0 }, 2000, 'easeIn');
      for (let i = 0; i < 3; i++)
        setTimeout(() => this._screenFlash(0xff0000, 0.4), i * 220);
    });
  }

  // ─── FX HELPERS ─────────────────────────────────────────────────────────────────

  _fireBall(from, to, color, onImpact) {
    if (!this.app) return;
    const ball = new PIXI.Graphics();
    ball.fill({ color });
    ball.circle(0, 0, 9);
    ball.x = from.x;
    ball.y = from.y;
    this.app.stage.addChild(ball);
    this._explode(from.x, from.y, color, 8, 0.2);
    const midX = (from.x + to.x) / 2;
    const midY = Math.min(from.y, to.y) - 90;
    const dur  = 440;
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / dur, 1);
      const i = 1 - t;
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
    };
    tick();
  }

  _missShot(from, nearTo) {
    this._fireBall(from, { x: nearTo.x - 80, y: nearTo.y + 120 }, 0xff4444, () => {
      this._spawnText(nearTo.x - 30, nearTo.y - 30, 'MISSED', '#ffffff44', 12);
    });
  }

  _explode(x, y, color, count = 28, dur = 0.6) {
    if (!this.app) return;
    for (let i = 0; i < count; i++) {
      const g = new PIXI.Graphics();
      g.fill({ color });
      g.circle(0, 0, 3 + Math.random() * 9);
      g.x = x; g.y = y;
      this.app.stage.addChild(g);
      const angle   = Math.random() * Math.PI * 2;
      const speed   = 40 + Math.random() * 120;
      const vx      = Math.cos(angle) * speed;
      const vy      = Math.sin(angle) * speed - 60;
      const gravity = 80 + Math.random() * 60;
      const life    = (dur * 0.6 + Math.random() * dur * 0.8) * 1000;
      const t0      = performance.now();
      const tick = () => {
        const el = (performance.now() - t0) / 1000;
        if (el > life / 1000) { g.destroy(); return; }
        const tp = el / (life / 1000);
        g.x = x + vx * el;
        g.y = y + vy * el + 0.5 * gravity * el * el;
        g.alpha = 1 - tp;
        g.scale.set(1 - tp * 0.7);
        requestAnimationFrame(tick);
      };
      tick();
    }
    for (let i = 0; i < 5; i++) {
      const sm = new PIXI.Graphics();
      sm.fill({ color: 0x334455, alpha: 0.5 });
      sm.circle(0, 0, 12 + Math.random() * 14);
      sm.x = x + (Math.random() - 0.5) * 24;
      sm.y = y + (Math.random() - 0.5) * 24;
      this.app.stage.addChild(sm);
      const t0 = performance.now();
      const tick = () => {
        const tp = Math.min((performance.now() - t0) / 900, 1);
        sm.scale.set(1 + tp * 2.5);
        sm.alpha = 0.45 * (1 - tp);
        sm.y -= 0.4;
        if (tp < 1) requestAnimationFrame(tick); else sm.destroy();
      };
      tick();
    }
  }

  _drawGrappleLines(x1, y1, x2, y2) {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const g = new PIXI.Graphics();
        g.stroke({ color: 0xbbaa88, width: 1.5, alpha: 0.7 });
        g.moveTo(x1, y1 + (i - 1.5) * 14);
        g.lineTo(x2, y2 + (i - 1.5) * 14);
        this.app.stage.addChild(g);
        setTimeout(() => g.destroy(), 700);
      }, i * 100);
    }
  }

  _shieldRing(x, y) {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const g = new PIXI.Graphics();
        g.stroke({ color: 0x4a9eff, width: 2, alpha: 0.6 });
        g.circle(x, y, 50);
        g.scale.set(0.5);
        this.app.stage.addChild(g);
        const t0 = performance.now();
        const tick = () => {
          const tp = Math.min((performance.now() - t0) / 700, 1);
          g.scale.set(0.5 + tp * 1.8);
          g.alpha = 0.6 * (1 - tp);
          if (tp < 1) requestAnimationFrame(tick); else g.destroy();
        };
        tick();
      }, i * 180);
    }
  }

  _smokeCloud(x, y) {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const g = new PIXI.Graphics();
        g.fill({ color: 0x222233, alpha: 0.6 });
        g.circle(0, 0, 16 + Math.random() * 20);
        g.x = x + (Math.random() - 0.5) * 40;
        g.y = y;
        this.app.stage.addChild(g);
        const startY = g.y;
        const t0 = performance.now();
        const tick = () => {
          const tp = Math.min((performance.now() - t0) / 1400, 1);
          g.scale.set(1 + tp * 2);
          g.alpha = 0.55 * (1 - tp);
          g.y = startY - tp * 50;
          if (tp < 1) requestAnimationFrame(tick); else g.destroy();
        };
        tick();
      }, i * 120);
    }
  }

  _coinArc(from, to) {
    if (!this.app) return;
    const g = new PIXI.Graphics();
    g.fill({ color: 0xffd700 });
    g.circle(0, 0, 5);
    g.x = from.x; g.y = from.y;
    this.app.stage.addChild(g);
    const midX  = (from.x + to.x) / 2;
    const midY  = Math.min(from.y, to.y) - 80 - Math.random() * 60;
    const dur   = 500 + Math.random() * 300;
    const t0    = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - t0) / dur, 1);
      const i = 1 - t;
      g.x = i*i*from.x + 2*i*t*midX + t*t*to.x;
      g.y = i*i*from.y + 2*i*t*midY + t*t*to.y;
      g.rotation += 0.15;
      if (t < 1) requestAnimationFrame(tick); else g.destroy();
    };
    tick();
  }

  _coinFall(x, startY) {
    if (!this.app) return;
    const g = new PIXI.Graphics();
    g.fill({ color: 0xffd700 });
    g.circle(0, 0, 4 + Math.random() * 4);
    g.x = x; g.y = startY;
    this.app.stage.addChild(g);
    const speed = 3 + Math.random() * 4;
    const tick = () => {
      g.y += speed;
      g.rotation += 0.1;
      if (g.y > this.H + 20) { g.destroy(); return; }
      requestAnimationFrame(tick);
    };
    tick();
  }

  _shakeShip(which, intensity = 8, times = 6) {
    const ship   = this.ships[which];
    const anchor = which === 'player' ? this._anchorPlayer : this._anchorEnemy;
    if (!ship) return;
    let count = 0;
    const tick = () => {
      if (count++ >= times) { ship.x = anchor.x; return; }
      ship.x = anchor.x + (Math.random() - 0.5) * intensity;
      setTimeout(tick, 45);
    };
    tick();
  }

  _glowShip(which, color) {
    const ship = this.ships[which];
    if (!ship) return;
    ship.tint = color;
    setTimeout(() => { ship.tint = 0xffffff; }, 400);
  }

  _screenFlash(color, alpha = 0.35) {
    if (!this.app) return;
    const g = new PIXI.Graphics();
    g.fill({ color, alpha });
    g.rect(0, 0, this.W, this.H);
    this.app.stage.addChild(g);
    const t0 = performance.now();
    const tick = () => {
      const tp = Math.min((performance.now() - t0) / 200, 1);
      g.alpha = alpha * (1 - tp);
      if (tp < 1) requestAnimationFrame(tick); else g.destroy();
    };
    tick();
  }

  // FIX: _spawnText — declare ref before the closure uses it
  _spawnText(x, y, text, color = '#ffffff', size = 20) {
    if (!this.app) return;
    const t = new PIXI.Text({
      text,
      style: {
        fontFamily:    'Courier New',
        fontSize:      size,
        fill:          color,
        fontWeight:    'bold',
        letterSpacing: 4,
        dropShadow:    { color: '#000000', blur: 8, distance: 0 },
      },
    });
    t.anchor.set(0.5);
    t.x = x;
    t.y = y;
    this.app.stage.addChild(t);
    const startY = y;           // capture y BEFORE closure
    const t0     = performance.now();
    const tick = () => {
      const tp = Math.min((performance.now() - t0) / 1200, 1);
      t.y    = startY - tp * 55;
      t.alpha = tp < 0.7 ? 1 : 1 - (tp - 0.7) / 0.3;
      if (tp < 1) requestAnimationFrame(tick); else t.destroy();
    };
    tick();
  }

  // ─── TWEEN ─────────────────────────────────────────────────────────────────────
  _tween(target, props, duration, ease = 'linear', onComplete) {
    const from = {};
    Object.keys(props).forEach(k => from[k] = target[k]);
    const easeFn = {
      linear:    t => t,
      easeIn:    t => t * t * t,
      easeOut:   t => 1 - Math.pow(1 - t, 3),
      easeInOut: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2,
    }[ease] || (t => t);
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - t0) / duration, 1);
      const e = easeFn(t);
      Object.keys(props).forEach(k => target[k] = from[k] + (props[k] - from[k]) * e);
      if (t < 1) requestAnimationFrame(tick);
      else onComplete?.();
    };
    tick();
  }

  // ─── EVENT BINDINGS ─────────────────────────────────────────────────────────────
  _bindEvents() {
    EventBus.on('playAttack',    ({ fromPlayer, onImpact }) => this.playAttack(fromPlayer, onImpact));
    EventBus.on('playBoard',     () => this.playBoard());
    EventBus.on('playEvade',     ({ success }) => this.playEvade(success));
    EventBus.on('playSabotage',  () => this.playSabotage());
    EventBus.on('playNegotiate', ({ success }) => this.playNegotiate(success));
    EventBus.on('playTelegraph', ({ stance }) => this.playTelegraph(stance));
    EventBus.on('playVictory',   () => this.playVictory());
    EventBus.on('playDefeat',    () => this.playDefeat());
    EventBus.on('rainSplash',    ({ x }) => this._explode(x, this.H * 0.55, 0x8899cc, 4, 0.3));
  }

  destroy() {
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    this.app?.destroy(true);
  }
}
