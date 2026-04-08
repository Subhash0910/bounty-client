import * as PIXI from 'pixi.js';
import EventBus from './EventBus.js';

/**
 * PixiStage — GPU-accelerated 2D layer on top of the Three.js canvas.
 * Handles: ships (sprites), particles (explosions, sparks, rain splashes),
 * battle FX (boarding, evade, sabotage, negotiate), and screen overlays.
 *
 * Rendered into a transparent canvas on top of the Three.js canvas.
 */
export default class PixiStage {
  constructor(canvas) {
    this.canvas = canvas;
    this.app = null;
    this.ships = {};
    this.particlePool = [];
    this._init();
  }

  async _init() {
    this.app = new PIXI.Application();
    await this.app.init({
      canvas: this.canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0,          // transparent — Three.js shows through
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });

    this.W = window.innerWidth;
    this.H = window.innerHeight;

    this._loadShipSprites();
    this._bindEvents();

    window.addEventListener('resize', () => {
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.app.renderer.resize(this.W, this.H);
      this._repositionShips();
    });
  }

  // ─── SHIPS ───────────────────────────────────────────────────────────────
  _loadShipSprites() {
    const W = this.W, H = this.H;

    // Player ship — right-facing
    const playerTex = PIXI.Texture.from(
      '/lucid-origin_2D_side-view_pirate_warship_game_sprite_facing_right_perfectly_flat_side_profile-0-removebg-preview (1).png'
    );
    const playerShip = new PIXI.Sprite(playerTex);
    playerShip.anchor.set(0.5, 0.88);
    playerShip.x = W * 0.22;
    playerShip.y = H * 0.52;
    playerShip.height = H * 0.42;
    playerShip.scale.x = playerShip.scale.y;
    playerShip.blendMode = 'screen';
    this.app.stage.addChild(playerShip);
    this.ships.player = playerShip;
    this._anchorPlayer = { x: W * 0.22, y: H * 0.52 };

    // Enemy ship — left-facing
    const enemyTex = PIXI.Texture.from(
      '/lucid-origin_2D_side-view_pirate_warship_game_sprite_facing_LEFT_perfectly_flat_side_profile_-0-removebg-preview (1).png'
    );
    const enemyShip = new PIXI.Sprite(enemyTex);
    enemyShip.anchor.set(0.5, 0.88);
    enemyShip.x = W * 0.78;
    enemyShip.y = H * 0.52;
    enemyShip.height = H * 0.42;
    enemyShip.scale.x = -enemyShip.scale.y;   // flip for enemy
    enemyShip.tint = 0xffbbbb;
    enemyShip.blendMode = 'screen';
    this.app.stage.addChild(enemyShip);
    this.ships.enemy = enemyShip;
    this._anchorEnemy = { x: W * 0.78, y: H * 0.52 };

    // Idle bob animation
    this._idleTick = 0;
    this.app.ticker.add(() => {
      this._idleTick += 0.018;
      if (this.ships.player) {
        this.ships.player.y = this._anchorPlayer.y + Math.sin(this._idleTick) * 10;
        this.ships.player.rotation = Math.sin(this._idleTick * 0.7) * 0.028;
      }
      if (this.ships.enemy) {
        this.ships.enemy.y = this._anchorEnemy.y + Math.sin(this._idleTick + 1.2) * 10;
        this.ships.enemy.rotation = Math.sin(this._idleTick * 0.7 + 1.2) * 0.028;
      }
    });
  }

  _repositionShips() {
    this._anchorPlayer = { x: this.W * 0.22, y: this.H * 0.52 };
    this._anchorEnemy  = { x: this.W * 0.78, y: this.H * 0.52 };
  }

  // ─── ACTION ANIMATIONS ───────────────────────────────────────────────────

  playAttack(fromPlayer, onImpact) {
    const from = fromPlayer ? this._anchorPlayer : this._anchorEnemy;
    const to   = fromPlayer ? this._anchorEnemy  : this._anchorPlayer;
    this._fireBall(from, to, fromPlayer ? 0x00f5d4 : 0xff4444, onImpact);
  }

  playBoard() {
    const player = this.ships.player;
    const anchor = this._anchorPlayer;
    if (!player) return;
    // Surge forward
    this._tween(player, { x: anchor.x + 220 }, 380, 'easeIn', () => {
      // Grappling hooks — 4 lines snap across
      this._drawGrappleLines(anchor.x + 220, anchor.y, this._anchorEnemy.x - 40, this._anchorEnemy.y);
      // Both ships shake
      this._shakeShip('player');
      this._shakeShip('enemy');
      // Snap back
      setTimeout(() => this._tween(player, { x: anchor.x }, 500, 'easeOut'), 600);
    });
  }

  playEvade(success) {
    const player = this.ships.player;
    const anchor = this._anchorPlayer;
    if (!player) return;
    if (success) {
      // Dive sideways
      this._tween(player, { x: anchor.x - 90, y: anchor.y + 55, rotation: -0.18 }, 280, 'easeIn', () => {
        // Enemy fires — cannonball streaks past
        this._missShot(this._anchorEnemy, { x: anchor.x - 90, y: anchor.y + 55 });
        setTimeout(() => this._tween(player, { x: anchor.x, y: anchor.y, rotation: 0 }, 440, 'easeOut'), 200);
      });
    } else {
      // Anchored — chain snaps, jolt
      this._shakeShip('player');
      this._spawnText(anchor.x, anchor.y - 60, '⚓ ANCHORED', '#ffaa00', 22);
    }
  }

  playSabotage(success) {
    const from = this._anchorPlayer;
    const to   = this._anchorEnemy;
    // Small skiff projectile low on water
    const skiff = new PIXI.Graphics();
    skiff.fill({ color: 0x334455 });
    skiff.ellipse(0, 0, 14, 6);
    skiff.x = from.x + 60;
    skiff.y = from.y + 80;
    this.app.stage.addChild(skiff);
    this._tween(skiff, { x: to.x - 60, y: to.y + 80 }, 600, 'linear', () => {
      skiff.destroy();
      // Purple explosion
      this._explode(to.x - 40, to.y + 60, 0x9b59b6, 30);
      this._shakeShip('enemy');
      this._spawnText(to.x, to.y - 70, 'RATTLED', '#9b59b6', 18);
    });
  }

  playNegotiate(success) {
    const anchor = this._anchorPlayer;
    if (success) {
      // Gold coins arc from enemy to player
      for (let i = 0; i < 18; i++) {
        setTimeout(() => this._coinArc(this._anchorEnemy, anchor), i * 60);
      }
      this._spawnText(this.W / 2, this.H * 0.32, 'DEAL STRUCK', '#ffd700', 32);
    } else {
      // White flag explodes off mast
      this._spawnText(anchor.x, anchor.y - 80, 'REJECTED!', '#ff4466', 28);
      this._explode(anchor.x, anchor.y - 60, 0xffffff, 15);
      // Enemy immediately retaliates
      setTimeout(() => this.playAttack(false, () => {}), 300);
    }
  }

  playTelegraph(stance) {
    const enemy = this.ships.enemy;
    const anchor = this._anchorEnemy;
    if (!enemy) return;

    if (stance === 'AGGRESSIVE') {
      // Enemy surges toward player
      this._tween(enemy, { x: anchor.x - 80 }, 500, 'easeIn', () => {
        this._tween(enemy, { x: anchor.x }, 600, 'easeOut');
      });
      this._glowShip('enemy', 0xff4444);
      this._spawnText(anchor.x, anchor.y - 90, 'LOADING ALL GUNS', '#ff4444', 14);
    } else if (stance === 'DEFENSIVE') {
      // Shimmer ring expands
      this._shieldRing(anchor.x, anchor.y);
      this._spawnText(anchor.x, anchor.y - 90, 'FORMING BARRIER', '#4a9eff', 14);
    } else if (stance === 'DESPERATE') {
      // Violent shake + smoke
      this._shakeShip('enemy', 12, 8);
      this._smokeCloud(anchor.x, anchor.y + 20);
      this._spawnText(anchor.x, anchor.y - 90, 'THEY\'RE BREAKING—', '#ff8800', 14);
    }
  }

  playVictory() {
    const enemy = this.ships.enemy;
    if (enemy) {
      // Enemy capsizes
      this._tween(enemy, { rotation: 1.4, y: this._anchorEnemy.y + 160, alpha: 0 }, 1800, 'easeIn');
    }
    // Gold coin shower
    for (let i = 0; i < 40; i++) {
      setTimeout(() => {
        const cx = this.W * 0.3 + Math.random() * this.W * 0.4;
        this._coinFall(cx, -20);
      }, i * 80);
    }
    // Player ship celebratory tilt
    const player = this.ships.player;
    if (player) this._tween(player, { rotation: -0.18 }, 700, 'easeOut');
  }

  playDefeat() {
    const player = this.ships.player;
    if (player) {
      this._tween(player, { rotation: 0.5, y: this._anchorPlayer.y + 180, alpha: 0 }, 2000, 'easeIn');
    }
    // Red screen pulses
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this._screenFlash(0xff0000, 0.4), i * 220);
    }
  }

  // ─── FX HELPERS ───────────────────────────────────────────────────────────

  _fireBall(from, to, color, onImpact) {
    const ball = new PIXI.Graphics();
    ball.fill({ color });
    ball.circle(0, 0, 9);
    ball.x = from.x;
    ball.y = from.y;
    this.app.stage.addChild(ball);

    // Muzzle flash
    this._explode(from.x, from.y, color, 8, 0.2);

    // Bezier arc
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
    // A cannonball that streaks past and splashes in the water
    const target = { x: nearTo.x - 80, y: nearTo.y + 120 };
    this._fireBall(from, target, 0xff4444, () => {
      this._spawnText(nearTo.x - 30, nearTo.y - 30, 'MISSED', '#ffffff44', 12);
    });
  }

  _explode(x, y, color, count = 28, dur = 0.6) {
    for (let i = 0; i < count; i++) {
      const g = new PIXI.Graphics();
      const size = 3 + Math.random() * 9;
      g.fill({ color });
      g.circle(0, 0, size);
      g.x = x; g.y = y;
      this.app.stage.addChild(g);
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 60;
      const gravity = 80 + Math.random() * 60;
      const lifetime = (dur * 0.6 + Math.random() * dur * 0.8) * 1000;
      const startT = performance.now();
      const tick = () => {
        const elapsed = (performance.now() - startT) / 1000;
        if (elapsed > lifetime / 1000) { g.destroy(); return; }
        const t = elapsed / (lifetime / 1000);
        g.x = x + vx * elapsed;
        g.y = y + vy * elapsed + 0.5 * gravity * elapsed * elapsed;
        g.alpha = 1 - t;
        g.scale.set(1 - t * 0.7);
        requestAnimationFrame(tick);
      };
      tick();
    }
    // Smoke puffs
    for (let i = 0; i < 5; i++) {
      const sm = new PIXI.Graphics();
      sm.fill({ color: 0x334455, alpha: 0.5 });
      sm.circle(0, 0, 12 + Math.random() * 14);
      sm.x = x + (Math.random() - 0.5) * 24;
      sm.y = y + (Math.random() - 0.5) * 24;
      this.app.stage.addChild(sm);
      const start2 = performance.now();
      const tick2  = () => {
        const t = Math.min((performance.now() - start2) / 900, 1);
        sm.scale.set(1 + t * 2.5);
        sm.alpha = 0.45 * (1 - t);
        sm.y -= 0.4;
        if (t < 1) requestAnimationFrame(tick2); else sm.destroy();
      };
      tick2();
    }
  }

  _drawGrappleLines(x1, y1, x2, y2) {
    const lines = [];
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const g = new PIXI.Graphics();
        g.stroke({ color: 0xbbaa88, width: 1.5, alpha: 0.7 });
        g.moveTo(x1, y1 + (i - 1.5) * 14);
        g.lineTo(x2, y2 + (i - 1.5) * 14);
        this.app.stage.addChild(g);
        lines.push(g);
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
        const start = performance.now();
        const tick = () => {
          const t = Math.min((performance.now() - start) / 700, 1);
          g.scale.set(0.5 + t * 1.8);
          g.alpha = 0.6 * (1 - t);
          if (t < 1) requestAnimationFrame(tick); else g.destroy();
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
        const start = performance.now();
        const tick = () => {
          const t = Math.min((performance.now() - start) / 1400, 1);
          g.scale.set(1 + t * 2);
          g.alpha = 0.55 * (1 - t);
          g.y = startY - t * 50;
          if (t < 1) requestAnimationFrame(tick); else g.destroy();
        };
        tick();
      }, i * 120);
    }
  }

  _coinArc(from, to) {
    const g = new PIXI.Graphics();
    g.fill({ color: 0xffd700 });
    g.circle(0, 0, 5);
    g.x = from.x; g.y = from.y;
    this.app.stage.addChild(g);
    const midX = (from.x + to.x) / 2;
    const midY = Math.min(from.y, to.y) - 80 - Math.random() * 60;
    const dur = 500 + Math.random() * 300;
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / dur, 1);
      const i = 1 - t;
      g.x = i*i*from.x + 2*i*t*midX + t*t*to.x;
      g.y = i*i*from.y + 2*i*t*midY + t*t*to.y;
      g.rotation += 0.15;
      if (t < 1) requestAnimationFrame(tick); else g.destroy();
    };
    tick();
  }

  _coinFall(x, startY) {
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
    setTimeout(() => {
      ship.tint = which === 'enemy' ? 0xffbbbb : 0xffffff;
    }, 400);
  }

  _screenFlash(color, alpha = 0.35) {
    const g = new PIXI.Graphics();
    g.fill({ color, alpha });
    g.rect(0, 0, this.W, this.H);
    this.app.stage.addChild(g);
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / 200, 1);
      g.alpha = alpha * (1 - t);
      if (t < 1) requestAnimationFrame(tick); else g.destroy();
    };
    tick();
  }

  _spawnText(x, y, text, color = '#ffffff', size = 20) {
    const t = new PIXI.Text({ text, style: {
      fontFamily: 'Courier New',
      fontSize: size,
      fill: color,
      fontWeight: 'bold',
      letterSpacing: 4,
      dropShadow: { color: '#000000', blur: 8, distance: 0 },
    }});
    t.anchor.set(0.5);
    t.x = x; t.y = y;
    this.app.stage.addChild(t);
    const startY = y;
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t2 = Math.min(elapsed / 1200, 1);
      this_text_ref.y = startY - t2 * 55;
      this_text_ref.alpha = t2 < 0.7 ? 1 : 1 - (t2 - 0.7) / 0.3;
      if (t2 < 1) requestAnimationFrame(tick); else t.destroy();
    };
    // scope fix
    const this_text_ref = t;
    tick();
  }

  // ─── TWEEN ────────────────────────────────────────────────────────────────
  _tween(target, props, duration, ease = 'linear', onComplete) {
    const start  = performance.now();
    const from   = {};
    Object.keys(props).forEach(k => from[k] = target[k]);
    const easeFn = {
      linear:  t => t,
      easeIn:  t => t * t * t,
      easeOut: t => 1 - Math.pow(1 - t, 3),
      easeInOut: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2,
    }[ease] || (t => t);
    const tick = () => {
      const t = Math.min((performance.now() - start) / duration, 1);
      const e = easeFn(t);
      Object.keys(props).forEach(k => target[k] = from[k] + (props[k] - from[k]) * e);
      if (t < 1) requestAnimationFrame(tick);
      else onComplete?.();
    };
    tick();
  }

  // ─── EVENT BINDINGS ───────────────────────────────────────────────────────
  _bindEvents() {
    EventBus.on('playAttack',    ({ fromPlayer, onImpact }) => this.playAttack(fromPlayer, onImpact));
    EventBus.on('playBoard',     () => this.playBoard());
    EventBus.on('playEvade',     ({ success }) => this.playEvade(success));
    EventBus.on('playSabotage',  ({ success }) => this.playSabotage(success));
    EventBus.on('playNegotiate', ({ success }) => this.playNegotiate(success));
    EventBus.on('playTelegraph', ({ stance }) => this.playTelegraph(stance));
    EventBus.on('playVictory',   () => this.playVictory());
    EventBus.on('playDefeat',    () => this.playDefeat());
    EventBus.on('rainSplash',    ({ x }) => this._explode(x, this.H * 0.55, 0x8899cc, 4, 0.3));
  }

  destroy() {
    this.app?.destroy(true);
  }
}
