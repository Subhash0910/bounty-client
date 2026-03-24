import Phaser from 'phaser';

// Asset keys
const PLAYER_SHIP_KEY = 'playerShip';
const ENEMY_SHIP_KEY  = 'enemyShip';

// Exact filenames as uploaded to /public
const PLAYER_SHIP_URL = '/lucid-origin_2D_side-view_pirate_warship_game_sprite_facing_right_perfectly_flat_side_profile-0-removebg-preview (1).png';
const ENEMY_SHIP_URL  = '/lucid-origin_2D_side-view_pirate_warship_game_sprite_facing_LEFT_perfectly_flat_side_profile_-0-removebg-preview (1).png';

export default class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
    this.playerHP        = 100;
    this.enemyHP         = 100;
    this.round           = 1;
    this._shaking        = false;
    this._waveOffsets    = [];
    this._waveGfx        = [];
  }

  // ── PRELOAD ──────────────────────────────────────────────────────────────────
  preload() {
    this.load.image(PLAYER_SHIP_KEY, PLAYER_SHIP_URL);
    this.load.image(ENEMY_SHIP_KEY,  ENEMY_SHIP_URL);
  }

  // ── CREATE ───────────────────────────────────────────────────────────────────
  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W; this.H = H;

    // Ship anchor points — pushed to edges, vertical centre slightly above mid
    this.playerAnchor = { x: W * 0.22, y: H * 0.48 };
    this.enemyAnchor  = { x: W * 0.78, y: H * 0.48 };

    this._drawAtmosphere(W, H);
    this._drawStormClouds(W, H);
    this._drawOcean(W, H);
    this._drawIslandCenter(W, H);

    // Place sprite ships
    this.playerShip = this._buildShipSprite(this.playerAnchor.x, this.playerAnchor.y, false);
    this.enemyShip  = this._buildShipSprite(this.enemyAnchor.x,  this.enemyAnchor.y, true);

    // Ocean glow under each ship (drawn after ships so it sits on water)
    this._buildShipGlow(this.playerAnchor.x, H * 0.68, 0x00f5d4);
    this._buildShipGlow(this.enemyAnchor.x,  H * 0.68, 0xff4444);

    // HP bars directly under ships
    this._buildHPBar('player', this.playerAnchor.x, this.playerAnchor.y + H * 0.20);
    this._buildHPBar('enemy',  this.enemyAnchor.x,  this.enemyAnchor.y + H * 0.20);

    // Round text (rendered by React too — this is Phaser-only fallback)
    this.roundText = this.add.text(W / 2, 58, 'ROUND  1', {
      fontFamily: 'Courier New', fontSize: '13px',
      color: '#ffd700', letterSpacing: 6,
    }).setOrigin(0.5, 0).setDepth(20);

    this.game.events.on('initCombat',   (d) => this._onInit(d));
    this.game.events.on('combatUpdate', (s) => this._onUpdate(s));
  }

  // ── UPDATE LOOP ──────────────────────────────────────────────────────────────
  update() {
    const W = this.W, H = this.H;
    const waterY = H * 0.68;
    for (let i = 0; i < this._waveGfx.length; i++) {
      const g  = this._waveGfx[i];
      const wy = waterY + 10 + i * 16;
      this._waveOffsets[i] = (this._waveOffsets[i] || 0) + 1.0 + i * 0.3;
      const off = this._waveOffsets[i];
      g.clear();
      g.lineStyle(1, 0x00f5d4, 0.06 + i * 0.025);
      g.beginPath(); g.moveTo(0, wy);
      for (let x = 0; x <= W; x += 8)
        g.lineTo(x, wy + Math.sin((x + off) * 0.030) * (4 + i * 1.5));
      g.strokePath();
    }
    if (Phaser.Math.Between(1, 3000) === 1) this._flashLightning();
  }

  // ── ATMOSPHERE ──────────────────────────────────────────────────────────────
  _drawAtmosphere(W, H) {
    const g = this.add.graphics().setDepth(0);
    const rows = 20;
    const topC = [0x02, 0x05, 0x08], botC = [0x08, 0x0f, 0x18];
    for (let i = 0; i < rows; i++) {
      const t  = i / rows;
      const r  = Math.round(Phaser.Math.Linear(topC[0], botC[0], t));
      const gv = Math.round(Phaser.Math.Linear(topC[1], botC[1], t));
      const b  = Math.round(Phaser.Math.Linear(topC[2], botC[2], t));
      g.fillStyle((r << 16) | (gv << 8) | b, 1);
      g.fillRect(0, (H / rows) * i, W, H / rows + 1);
    }
    // Battle-fire horizon glow at 60% height
    const horizonY = H * 0.60;
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0xff2200, 0.025 - i * 0.003);
      g.fillRect(0, horizonY - (80 + i * 60) / 2, W, 80 + i * 60);
    }
    // Rain/mist dots
    const noise = this.add.graphics().setDepth(1);
    noise.fillStyle(0xaabbcc, 0.03);
    for (let i = 0; i < 200; i++)
      noise.fillRect(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H),
        1, Phaser.Math.Between(2, 8)
      );
  }

  _drawStormClouds(W, H) {
    const configs = [
      { x: W*0.10, y: H*0.08, w: 480, h: 100, col: 0x0a0e18 },
      { x: W*0.40, y: H*0.05, w: 380, h:  80, col: 0x080c14 },
      { x: W*0.70, y: H*0.12, w: 420, h:  90, col: 0x060a10 },
      { x: W*0.25, y: H*0.18, w: 340, h:  70, col: 0x0c1018 },
      { x: W*0.80, y: H*0.22, w: 300, h:  65, col: 0x0a0e18 },
    ];
    configs.forEach((c, i) => {
      const cg = this.add.graphics().setDepth(2);
      cg.fillStyle(c.col, 0.92);
      cg.fillEllipse(c.x, c.y, c.w, c.h);
      this.tweens.add({
        targets: cg,
        x: Phaser.Math.Between(-60, 60),
        alpha: { from: 0.85, to: 1 },
        duration: Phaser.Math.Between(8000, 15000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: i * 1800,
      });
    });
  }

  _drawOcean(W, H) {
    const waterY = H * 0.68;
    const ob = this.add.graphics().setDepth(3);
    ob.fillStyle(0x030d18, 1);
    ob.fillRect(0, waterY, W, H - waterY);
    ob.fillStyle(0x020810, 1);
    ob.fillRect(0, waterY + (H - waterY) * 0.5, W, (H - waterY) * 0.5);
    for (let i = 0; i < 8; i++) {
      const wg = this.add.graphics().setDepth(4);
      this._waveGfx.push(wg);
      this._waveOffsets.push(i * 30);
    }
    // Foam dots
    for (let i = 0; i < 30; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, W), waterY + Phaser.Math.Between(-4, 4),
        Phaser.Math.Between(1, 3), 0xaaccdd, 0.18
      ).setDepth(4);
      this.tweens.add({
        targets: dot, x: `+=${Phaser.Math.Between(-50, 50)}`,
        alpha: { from: 0.05, to: 0.28 },
        duration: Phaser.Math.Between(2000, 6000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
      });
    }
  }

  _buildShipGlow(cx, waterY, color) {
    const glow = this.add.ellipse(cx, waterY + 10, 280, 40, color, 0.07).setDepth(5);
    this.tweens.add({
      targets: glow, alpha: { from: 0.04, to: 0.13 },
      duration: 2200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
  }

  _drawIslandCenter(W, H) {
    const g = this.add.graphics().setDepth(5);
    const cx = W / 2, cy = H * 0.65;
    g.fillStyle(0x001008, 0.5); g.fillEllipse(cx, cy + 12, 180, 40);
    g.fillStyle(0x08180e, 1);   g.fillEllipse(cx, cy, 160, 36);
    g.fillStyle(0x0c2014, 1);
    g.fillTriangle(cx - 40, cy, cx + 5, cy - 42, cx + 30, cy);
    g.fillTriangle(cx + 18, cy, cx + 60, cy - 30, cx + 90, cy);
    g.lineStyle(1, 0x00f5d4, 0.12); g.strokeEllipse(cx, cy, 160, 36);
    [cx - 20, cx + 40].forEach(tx => {
      const t = this.add.circle(tx, cy - 6, 2, 0xff8820, 1).setDepth(6);
      this.tweens.add({
        targets: t, alpha: { from: 1, to: 0.3 }, scaleX: { from: 1, to: 1.5 },
        duration: Phaser.Math.Between(250, 500),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 300),
      });
    });
  }

  _flashLightning() {
    const W = this.W, H = this.H;
    const flash = this.add.rectangle(W/2, H/2, W, H, 0xffffff, 0.04).setDepth(25);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 180, ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
    const lx = Phaser.Math.Between(W * 0.2, W * 0.8);
    const bolt = this.add.graphics().setDepth(25);
    bolt.lineStyle(2, 0xeeeeff, 0.6);
    bolt.beginPath(); bolt.moveTo(lx, 0);
    let cy2 = 0;
    while (cy2 < H * 0.45) {
      cy2 += Phaser.Math.Between(18, 38);
      bolt.lineTo(lx + Phaser.Math.Between(-22, 22), cy2);
    }
    bolt.strokePath();
    this.tweens.add({
      targets: bolt, alpha: 0, duration: 220, ease: 'Power2',
      onComplete: () => bolt.destroy(),
    });
  }

  // ── SPRITE SHIP BUILDER ──────────────────────────────────────────────────────
  _buildShipSprite(cx, cy, isEnemy) {
    const W = this.W, H = this.H;
    const key = isEnemy ? ENEMY_SHIP_KEY : PLAYER_SHIP_KEY;

    // Target display height ~38% of screen height so ships feel MASSIVE
    const targetH = H * 0.38;

    const sprite = this.add.image(cx, cy, key);

    // Scale to fill target height
    const scale = targetH / sprite.height;
    sprite.setScale(scale);
    sprite.setDepth(8);
    sprite.setOrigin(0.5, 0.85); // anchor near waterline

    // Tint: keep player natural, give enemy a slight red tint overlay
    if (isEnemy) {
      sprite.setTint(0xffaaaa);
    }

    // Soft drop shadow beneath ship
    const shadowW = sprite.displayWidth * 0.85;
    const shadow = this.add.ellipse(cx, cy + 10, shadowW, 28, 0x000000, 0.38).setDepth(7);

    // Subtle colored halo glow behind ship
    const glowColor = isEnemy ? 0xff3333 : 0x00f5d4;
    const halo = this.add.ellipse(cx, cy - sprite.displayHeight * 0.3, sprite.displayWidth * 0.9, sprite.displayHeight * 0.7, glowColor, 0.05).setDepth(7);
    this.tweens.add({
      targets: halo, alpha: { from: 0.03, to: 0.09 },
      duration: 2000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    // BOB animation — container approach using y tween on sprite directly
    this.tweens.add({
      targets: sprite,
      y: cy + 12,
      duration: 2200 + (isEnemy ? 300 : 0),
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
    this.tweens.add({
      targets: [sprite, shadow, halo],
      angle: isEnemy ? 1.5 : -1.5,
      duration: 3000 + (isEnemy ? 400 : 0),
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    // Cannon port glow dots (approximate positions on hull)
    const portYOffset = sprite.displayHeight * 0.35;
    const portOffsets = [-0.28, -0.10, 0.08, 0.26];
    portOffsets.forEach(pct => {
      const px = cx + sprite.displayWidth * pct * (isEnemy ? -1 : 1);
      const portGlow = this.add.circle(px, cy + portYOffset, 4, 0xff8830, 0.55).setDepth(9);
      this.tweens.add({
        targets: portGlow, alpha: { from: 0.55, to: 0.12 },
        duration: Phaser.Math.Between(500, 1100),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 600),
      });
      // Store cannon port positions for cannonball origin
      if (!this._cannonPorts) this._cannonPorts = {};
      const portKey = isEnemy ? 'enemy' : 'player';
      if (!this._cannonPorts[portKey]) this._cannonPorts[portKey] = [];
      this._cannonPorts[portKey].push({ x: px, y: cy + portYOffset });
    });

    // Store scale info for FX positioning
    sprite._displayW = sprite.displayWidth;
    sprite._displayH = sprite.displayHeight;

    return sprite;
  }

  // ── HP BARS ──────────────────────────────────────────────────────────────────
  _buildHPBar(which, cx, cy) {
    const barW = 240, barH = 18;
    const bx = cx - barW / 2;
    const color = which === 'player' ? 0x00f5d4 : 0xff4444;
    const colorStr = which === 'player' ? '#00f5d4' : '#ff4444';
    const labelStr = which === 'player' ? 'YOU' : 'ENEMY';

    const track = this.add.graphics().setDepth(10);
    track.fillStyle(0x0a1520, 1);
    track.fillRoundedRect(bx, cy, barW, barH, 4);
    track.lineStyle(1, color, 0.35);
    track.strokeRoundedRect(bx, cy, barW, barH, 4);

    const fillGfx = this.add.graphics().setDepth(11);
    this._drawHPFill(fillGfx, bx, cy, barW, barH, 100);

    const segGfx = this.add.graphics().setDepth(12);
    segGfx.lineStyle(1, 0x000000, 0.5);
    for (let i = 1; i < 10; i++) {
      const sx = bx + (barW / 10) * i;
      segGfx.beginPath(); segGfx.moveTo(sx, cy); segGfx.lineTo(sx, cy + barH); segGfx.strokePath();
    }

    this.add.text(cx, cy - 14, labelStr, {
      fontFamily: 'Courier New', fontSize: '11px',
      color: colorStr, letterSpacing: 4, fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(12);

    const numX = which === 'player' ? bx + barW + 10 : bx - 10;
    const numOrigin = which === 'player' ? [0, 0.5] : [1, 0.5];
    const hpNum = this.add.text(numX, cy + barH / 2, '100', {
      fontFamily: 'Courier New', fontSize: '16px',
      color: colorStr, fontStyle: 'bold',
    }).setOrigin(...numOrigin).setDepth(12);

    const warnGfx = this.add.graphics().setDepth(13).setAlpha(0);
    warnGfx.lineStyle(2, 0xff4444, 1);
    warnGfx.strokeRoundedRect(bx - 1, cy - 1, barW + 2, barH + 2, 4);

    this[`${which}BarFill`]  = fillGfx;
    this[`${which}BarNum`]   = hpNum;
    this[`${which}BarX`]     = bx;
    this[`${which}BarY`]     = cy;
    this[`${which}BarW`]     = barW;
    this[`${which}BarH`]     = barH;
    this[`${which}WarnGfx`]  = warnGfx;
    this[`${which}LowPulse`] = null;
  }

  _drawHPFill(gfx, bx, cy, barW, barH, hp) {
    const fillW = Math.max(0, (hp / 100) * barW);
    gfx.clear();
    if (fillW < 2) return;
    const col = hp > 50 ? 0x00f5d4 : hp > 25 ? 0xffd700 : 0xff4444;
    gfx.fillStyle(col, 0.88);
    gfx.fillRoundedRect(bx, cy, fillW, barH, 4);
    gfx.fillStyle(0xffffff, 0.10);
    gfx.fillRoundedRect(bx, cy, fillW, barH / 2, 4);
  }

  _animateHPBar(which, newHP) {
    const oldHP = which === 'player' ? this.playerHP : this.enemyHP;
    const gfx   = this[`${which}BarFill`];
    const num   = this[`${which}BarNum`];
    const bx    = this[`${which}BarX`];
    const cy2   = this[`${which}BarY`];
    const barW  = this[`${which}BarW`];
    const barH  = this[`${which}BarH`];
    const obj   = { hp: oldHP };
    this.tweens.add({
      targets: obj, hp: newHP, duration: 500, ease: 'Power2',
      onUpdate: () => {
        this._drawHPFill(gfx, bx, cy2, barW, barH, obj.hp);
        num.setText(Math.ceil(obj.hp).toString());
      },
      onComplete: () => {
        if (which === 'player') this.playerHP = newHP;
        else                    this.enemyHP  = newHP;
        if (newHP < 30) this._startLowHPPulse(which);
      },
    });
    if (newHP < oldHP) {
      const ship = which === 'player' ? this.playerShip : this.enemyShip;
      if (ship) {
        this.tweens.add({
          targets: ship, alpha: { from: 0.25, to: 1 },
          duration: 200, ease: 'Power1',
        });
      }
    }
  }

  _startLowHPPulse(which) {
    if (this[`${which}LowPulse`]) return;
    const wg = this[`${which}WarnGfx`];
    if (!wg) return;
    this[`${which}LowPulse`] = this.tweens.add({
      targets: wg, alpha: { from: 0.8, to: 0 },
      duration: 500, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
  }

  // ── SCREEN SHAKE ────────────────────────────────────────────────────────────
  _screenShake(intensity = 5) {
    if (this._shaking) return;
    this._shaking = true;
    this.cameras.main.shake(280, intensity / 1000, false, () => { this._shaking = false; });
  }

  // ── INIT / UPDATE HANDLERS ──────────────────────────────────────────────────
  _onInit(data) {
    const ph = data.playerHealth ?? 100;
    const eh = data.enemyHealth  ?? 100;
    this._drawHPFill(this.playerBarFill, this.playerBarX, this.playerBarY, this.playerBarW, this.playerBarH, ph);
    this._drawHPFill(this.enemyBarFill,  this.enemyBarX,  this.enemyBarY,  this.enemyBarW,  this.enemyBarH,  eh);
    this.playerBarNum.setText(String(ph));
    this.enemyBarNum.setText(String(eh));
    this.playerHP = ph; this.enemyHP = eh;
    this.round = data.round ?? 1;
    this.roundText.setText(`ROUND  ${this.round}`);
  }

  _onUpdate(state) {
    const approach = state.lastApproach;
    if (state.round) {
      this.round = state.round;
      this.roundText.setText(`ROUND  ${this.round}`);
    }
    if (!approach) {
      this._animateHPBar('player', state.playerHealth ?? this.playerHP);
      this._animateHPBar('enemy',  state.enemyHealth  ?? this.enemyHP);
      return;
    }
    if (approach === 'ATTACK') {
      this._fireCannonball(true);
      const playerTookDamage = (state.playerHealth ?? this.playerHP) < this.playerHP;
      if (playerTookDamage) this.time.delayedCall(500, () => this._fireCannonball(false));
      this.time.delayedCall(420, () => {
        this._animateHPBar('player', state.playerHealth ?? this.playerHP);
        this._animateHPBar('enemy',  state.enemyHealth  ?? this.enemyHP);
      });
    } else if (approach === 'INTIMIDATE') {
      this._intimidateEffect();
      this.time.delayedCall(300, () => this._animateHPBar('enemy', state.enemyHealth ?? this.enemyHP));
    } else if (approach === 'NEGOTIATE') {
      const success = state.status === 'PLAYER_WON' ||
                      (state.enemyHealth ?? this.enemyHP) < this.enemyHP;
      this._negotiateEffect(success);
      this.time.delayedCall(300, () => {
        this._animateHPBar('player', state.playerHealth ?? this.playerHP);
        this._animateHPBar('enemy',  state.enemyHealth  ?? this.enemyHP);
      });
    }
    if (state.status === 'PLAYER_WON')  this.time.delayedCall(700, () => this._victoryFX());
    if (state.status === 'PLAYER_LOST') this.time.delayedCall(700, () => this._defeatFX());
  }

  // ── CANNONBALL ──────────────────────────────────────────────────────────────
  _fireCannonball(fromPlayer) {
    const pSprite = this.playerShip;
    const eSprite = this.enemyShip;

    const from = fromPlayer
      ? { x: this.playerAnchor.x + (pSprite ? pSprite._displayW * 0.48 : 120), y: this.playerAnchor.y }
      : { x: this.enemyAnchor.x  - (eSprite ? eSprite._displayW * 0.48 : 120), y: this.enemyAnchor.y };
    const to   = fromPlayer
      ? { x: this.enemyAnchor.x  - (eSprite ? eSprite._displayW * 0.2 : 40), y: this.enemyAnchor.y }
      : { x: this.playerAnchor.x + (pSprite ? pSprite._displayW * 0.2 : 40), y: this.playerAnchor.y };

    const color = fromPlayer ? 0x00f5d4 : 0xff4444;
    const ball  = this.add.circle(from.x, from.y, 7, color, 1).setDepth(15);
    const midX  = (from.x + to.x) / 2;
    const midY  = Math.min(from.y, to.y) - 90;
    const totalDuration = 400;
    const startTime = this.time.now;

    const muzzle = this.add.circle(from.x, from.y, 14, color, 0.7).setDepth(15);
    this.tweens.add({
      targets: muzzle, scaleX: 2.2, scaleY: 2.2, alpha: 0,
      duration: 180, ease: 'Power2', onComplete: () => muzzle.destroy(),
    });

    const tick = () => {
      if (!ball.active) return;
      const elapsed = this.time.now - startTime;
      const t = Math.min(elapsed / totalDuration, 1);
      const inv = 1 - t;
      ball.setPosition(
        inv*inv*from.x + 2*inv*t*midX + t*t*to.x,
        inv*inv*from.y + 2*inv*t*midY  + t*t*to.y
      );
      ball.setScale(1 - t * 0.3);
      if (t >= 1) {
        const flash = this.add.circle(to.x, to.y, 20, color, 0.8).setDepth(16);
        this.tweens.add({
          targets: flash, scaleX: 3, scaleY: 3, alpha: 0,
          duration: 260, ease: 'Power2', onComplete: () => flash.destroy(),
        });
        for (let s = 0; s < 3; s++) {
          const smoke = this.add.circle(
            to.x + Phaser.Math.Between(-10,10), to.y + Phaser.Math.Between(-10,10),
            Phaser.Math.Between(8,16), 0x445566, 0.4
          ).setDepth(15);
          this.tweens.add({
            targets: smoke, scaleX: 2.5, scaleY: 2.5, alpha: 0, y: smoke.y - 25,
            duration: Phaser.Math.Between(400,700), ease: 'Power1',
            onComplete: () => smoke.destroy(),
          });
        }
        for (let i = 0; i < 10; i++) {
          const sp = this.add.circle(to.x, to.y, Phaser.Math.Between(2,5), color, 1).setDepth(16);
          this.tweens.add({
            targets: sp,
            x: to.x + Phaser.Math.Between(-55,55),
            y: to.y + Phaser.Math.Between(-50,25),
            alpha: 0, scaleX: 0, scaleY: 0,
            duration: Phaser.Math.Between(220,550), ease: 'Power2',
            onComplete: () => sp.destroy(),
          });
        }
        const targetShip = fromPlayer ? this.enemyShip : this.playerShip;
        if (targetShip) {
          this.tweens.add({ targets: targetShip, alpha: { from: 0.15, to: 1 }, duration: 220, ease: 'Power1' });
        }
        this.cameras.main.shake(250, 0.005);
        ball.destroy();
        return;
      }
      this.time.delayedCall(16, tick);
    };
    tick();
  }

  // ── INTIMIDATE EFFECT ───────────────────────────────────────────────────────
  _intimidateEffect() {
    const { x, y } = this.playerAnchor;
    for (let i = 0; i < 15; i++) {
      const ring = this.add.circle(x, y, 18 + i * 14, 0x9b59b6, 0).setDepth(14);
      this.tweens.add({
        targets: ring, scaleX: 1.6, scaleY: 1.6, alpha: { from: 0.55, to: 0 },
        duration: 700, ease: 'Power2', delay: i * 70,
        onComplete: () => ring.destroy(),
      });
    }
    if (this.enemyShip) {
      for (let i = 0; i < 5; i++) {
        this.time.delayedCall(i * 80, () => {
          if (!this.enemyShip?.active) return;
          this.tweens.add({
            targets: this.enemyShip,
            x: this.enemyAnchor.x + Phaser.Math.Between(-8, 8),
            duration: 60, ease: 'Power1', yoyo: true,
            onComplete: () => { if (this.enemyShip) this.enemyShip.x = this.enemyAnchor.x; },
          });
        });
      }
    }
    const skull = this.add.text(this.enemyAnchor.x, this.enemyAnchor.y - 60, '💀', {
      fontSize: '40px',
    }).setOrigin(0.5).setDepth(16).setAlpha(0);
    this.tweens.add({
      targets: skull, alpha: { from: 0, to: 0.9 }, y: this.enemyAnchor.y - 100,
      duration: 400, ease: 'Power2', yoyo: true, hold: 400,
      onComplete: () => skull.destroy(),
    });
    this.cameras.main.shake(400, 0.003);
  }

  // ── NEGOTIATE EFFECT ────────────────────────────────────────────────────────
  _negotiateEffect(success) {
    const W = this.W, H = this.H;
    if (success) {
      for (let i = 0; i < 20; i++) {
        const sp = this.add.circle(
          W/2 + Phaser.Math.Between(-120,120), H*0.5,
          Phaser.Math.Between(3,6), 0xffd700, 1
        ).setDepth(16);
        this.tweens.add({
          targets: sp, y: sp.y - Phaser.Math.Between(80,180), alpha: 0,
          duration: Phaser.Math.Between(600,1100), ease: 'Power1',
          delay: Phaser.Math.Between(0,400),
          onComplete: () => sp.destroy(),
        });
      }
      const txt = this.add.text(W/2, H*0.45, 'DEAL STRUCK', {
        fontFamily: 'Courier New', fontSize: '28px', color: '#ffd700',
        fontStyle: 'bold', letterSpacing: 6,
        shadow: { x:0, y:0, color:'#ffd700', blur:12, fill:true },
      }).setOrigin(0.5).setDepth(20).setAlpha(0);
      this.tweens.add({
        targets: txt, alpha: { from:0, to:1 }, y: H*0.38,
        duration: 350, ease: 'Power2', yoyo: true, hold: 700,
        onComplete: () => txt.destroy(),
      });
      const flash = this.add.rectangle(W/2,H/2,W,H,0xffffff,0.12).setDepth(15);
      this.tweens.add({ targets:flash, alpha:0, duration:300, ease:'Power2', onComplete:()=>flash.destroy() });
    } else {
      const shockwave = this.add.circle(this.enemyAnchor.x, this.enemyAnchor.y, 10, 0xff4466, 0.7).setDepth(15);
      this.tweens.add({
        targets: shockwave, scaleX:12, scaleY:12, alpha:0,
        duration:500, ease:'Power2', onComplete:()=>shockwave.destroy(),
      });
      const rtxt = this.add.text(W/2, H*0.2, 'REJECTED!', {
        fontFamily: 'Courier New', fontSize: '32px', color: '#ff4466',
        fontStyle: 'bold', letterSpacing: 6,
        shadow: { x:0, y:0, color:'#ff4466', blur:16, fill:true },
      }).setOrigin(0.5).setDepth(20).setAlpha(0);
      this.tweens.add({
        targets: rtxt, alpha:{from:0,to:1}, y: H*0.42,
        duration:260, ease:'Power3', yoyo:true, hold:500,
        onComplete:()=>rtxt.destroy(),
      });
      this.cameras.main.shake(300, 0.006);
    }
  }

  // ── VICTORY FX ──────────────────────────────────────────────────────────────
  _victoryFX() {
    const W = this.W, H = this.H;
    const flood = this.add.rectangle(W/2, H/2, W, H, 0x00f5d4, 0.15).setDepth(22);
    this.tweens.add({ targets:flood, alpha:0, duration:800, ease:'Power2', onComplete:()=>flood.destroy() });
    for (let i = 0; i < 100; i++) {
      const spark = this.add.circle(
        W/2 + Phaser.Math.Between(-160,160),
        H/2 + Phaser.Math.Between(-80,80),
        Phaser.Math.Between(2,7),
        Phaser.Utils.Array.GetRandom([0xffd700, 0x00f5d4, 0xffffff, 0xffa040]), 1
      ).setDepth(23);
      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-300,300),
        y: spark.y + Phaser.Math.Between(-250,200),
        alpha:0, scaleX:0, scaleY:0,
        duration: Phaser.Math.Between(500,1300), ease:'Power2',
        delay: Phaser.Math.Between(0,500),
        onComplete: () => spark.destroy(),
      });
    }
    if (this.playerShip) {
      this.tweens.add({ targets:this.playerShip, angle:-8, duration:600, ease:'Power2' });
    }
    this.cameras.main.shake(400, 0.006);
  }

  // ── DEFEAT FX ───────────────────────────────────────────────────────────────
  _defeatFX() {
    const W = this.W, H = this.H;
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 200, () => {
        const flash = this.add.rectangle(W/2,H/2,W,H,0xff0000,0.35).setDepth(22);
        this.tweens.add({ targets:flash, alpha:0, duration:160, ease:'Power2', onComplete:()=>flash.destroy() });
      });
    }
    if (this.playerShip) {
      this.tweens.add({ targets:this.playerShip, angle:15, y: this.playerAnchor.y + 80, duration:1200, ease:'Power3' });
    }
    if (this.enemyShip) {
      this.tweens.add({ targets:this.enemyShip, y: this.enemyAnchor.y - 30, duration:300, ease:'Back.easeOut', yoyo:true, repeat:2 });
    }
    this.cameras.main.shake(500, 0.008);
    this.time.delayedCall(800, () => {
      this.cameras.main.fade(1000, 5, 3, 4);
    });
  }
}
