import Phaser from 'phaser';

const PLAYER_KEY = 'playerShip';
const ENEMY_KEY  = 'enemyShip';
const PLAYER_URL = '/lucid-origin_2D_side-view_pirate_warship_game_sprite_facing_right_perfectly_flat_side_profile-0-removebg-preview (1).png';
const ENEMY_URL  = '/lucid-origin_2D_side-view_pirate_warship_game_sprite_facing_LEFT_perfectly_flat_side_profile_-0-removebg-preview (1).png';

export default class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
    this.playerHP     = 100;
    this.enemyHP      = 100;
    this.round        = 1;
    this._waveOffsets = [];
    this._waveGfx     = [];
  }

  preload() {
    this.load.image(PLAYER_KEY, PLAYER_URL);
    this.load.image(ENEMY_KEY,  ENEMY_URL);
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.W = W; this.H = H;

    // Ships sit at 46% height so they dominate the upper canvas
    this.playerAnchor = { x: W * 0.20, y: H * 0.46 };
    this.enemyAnchor  = { x: W * 0.80, y: H * 0.46 };

    this._buildBackground(W, H);
    this._buildClouds(W, H);
    this._buildOcean(W, H);
    this._buildIsland(W, H);

    this.playerShip = this._placeShip(this.playerAnchor.x, this.playerAnchor.y, false);
    this.enemyShip  = this._placeShip(this.enemyAnchor.x,  this.enemyAnchor.y, true);

    this._buildHPBar('player', this.playerAnchor.x, H * 0.73);
    this._buildHPBar('enemy',  this.enemyAnchor.x,  H * 0.73);

    // Crossfire glow lines between ships — pure atmosphere
    this._buildBattleCorridor(W, H);

    this.game.events.on('initCombat',   d => this._onInit(d));
    this.game.events.on('combatUpdate', s => this._onUpdate(s));
  }

  update() {
    const W = this.W, H = this.H;
    const waterY = H * 0.70;
    for (let i = 0; i < this._waveGfx.length; i++) {
      const g = this._waveGfx[i];
      const wy = waterY + 8 + i * 14;
      this._waveOffsets[i] = (this._waveOffsets[i] || 0) + 0.9 + i * 0.25;
      const off = this._waveOffsets[i];
      g.clear();
      g.lineStyle(1.5, 0x00f5d4, 0.04 + i * 0.022);
      g.beginPath(); g.moveTo(0, wy);
      for (let x = 0; x <= W; x += 10)
        g.lineTo(x, wy + Math.sin((x + off) * 0.028) * (5 + i * 1.8));
      g.strokePath();
    }
    if (Phaser.Math.Between(1, 2800) === 1) this._flashLightning();
  }

  // ─── BACKGROUND ──────────────────────────────────────────────────────────
  _buildBackground(W, H) {
    const g = this.add.graphics().setDepth(0);
    // Sky: deep navy to near-black with subtle blue
    const rows = 24;
    for (let i = 0; i < rows; i++) {
      const t  = i / rows;
      const r  = Math.round(Phaser.Math.Linear(0x01, 0x05, t));
      const gv = Math.round(Phaser.Math.Linear(0x04, 0x0a, t));
      const b  = Math.round(Phaser.Math.Linear(0x0c, 0x14, t));
      g.fillStyle((r << 16) | (gv << 8) | b, 1);
      g.fillRect(0, (H / rows) * i, W, H / rows + 1);
    }
    // Horizon fire — red-orange ember glow at 65%
    const hy = H * 0.65;
    [0.045, 0.028, 0.016, 0.008, 0.004].forEach((a, i) => {
      g.fillStyle(0xff2200, a);
      g.fillRect(0, hy - (60 + i * 70) / 2, W, 60 + i * 70);
    });
    // Subtle violet mist around ship zones
    g.fillStyle(0x220044, 0.06);
    g.fillEllipse(this.playerAnchor?.x || W*0.2, H*0.5, W*0.55, H*0.6);
    g.fillStyle(0x440011, 0.06);
    g.fillEllipse(this.enemyAnchor?.x  || W*0.8, H*0.5, W*0.55, H*0.6);
    // Rain streaks — 250 vertical micro-lines
    const rain = this.add.graphics().setDepth(1);
    rain.lineStyle(1, 0x8899aa, 0.025);
    for (let i = 0; i < 250; i++) {
      const rx = Phaser.Math.Between(0, W);
      const ry = Phaser.Math.Between(0, H);
      rain.beginPath();
      rain.moveTo(rx, ry);
      rain.lineTo(rx + Phaser.Math.Between(-2, 2), ry + Phaser.Math.Between(6, 18));
      rain.strokePath();
    }
  }

  _buildClouds(W, H) {
    const clouds = [
      { x: W*0.08, y: H*0.07, w: 520, h: 110, a: 0.94 },
      { x: W*0.42, y: H*0.04, w: 400, h:  85, a: 0.88 },
      { x: W*0.72, y: H*0.10, w: 460, h:  95, a: 0.92 },
      { x: W*0.28, y: H*0.17, w: 360, h:  72, a: 0.85 },
      { x: W*0.85, y: H*0.20, w: 320, h:  68, a: 0.80 },
      { x: W*0.55, y: H*0.13, w: 280, h:  60, a: 0.75 },
    ];
    clouds.forEach((c, i) => {
      const cg = this.add.graphics().setDepth(2);
      cg.fillStyle(0x070b12, c.a);
      cg.fillEllipse(c.x, c.y, c.w, c.h);
      // Second darker layer
      cg.fillStyle(0x040810, c.a * 0.6);
      cg.fillEllipse(c.x + 20, c.y + 10, c.w * 0.7, c.h * 0.7);
      this.tweens.add({
        targets: cg, x: Phaser.Math.Between(-80, 80), alpha: { from: c.a*0.9, to: c.a },
        duration: Phaser.Math.Between(9000, 18000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1, delay: i * 2200,
      });
    });
  }

  _buildOcean(W, H) {
    const waterY = H * 0.70;
    const ob = this.add.graphics().setDepth(3);
    // Deep ocean gradient
    ob.fillStyle(0x020c14, 1); ob.fillRect(0, waterY, W, H - waterY);
    ob.fillStyle(0x010810, 1); ob.fillRect(0, waterY + (H-waterY)*0.4, W, (H-waterY)*0.6);
    // Wave lines (animated in update)
    for (let i = 0; i < 9; i++) {
      this._waveGfx.push(this.add.graphics().setDepth(4));
      this._waveOffsets.push(i * 28);
    }
    // Foam line at waterline — bright and crisp
    const foam = this.add.graphics().setDepth(4);
    foam.lineStyle(1.5, 0xffffff, 0.12);
    foam.beginPath(); foam.moveTo(0, waterY); foam.lineTo(W, waterY); foam.strokePath();
    // Foam dots
    for (let i = 0; i < 40; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, W), waterY + Phaser.Math.Between(-3, 3),
        Phaser.Math.Between(1, 3), 0xccddee, 0.15
      ).setDepth(4);
      this.tweens.add({
        targets: dot, x: `+=${Phaser.Math.Between(-40, 40)}`, alpha: { from: 0.04, to: 0.22 },
        duration: Phaser.Math.Between(2500, 7000), ease: 'Sine.easeInOut',
        yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 4000),
      });
    }
    // Ship ocean glows
    const pGlow = this.add.ellipse(this.playerAnchor.x, waterY + 12, 300, 44, 0x00f5d4, 0.07).setDepth(3);
    const eGlow = this.add.ellipse(this.enemyAnchor.x,  waterY + 12, 300, 44, 0xff3333, 0.07).setDepth(3);
    this.tweens.add({ targets:[pGlow,eGlow], alpha:{from:0.04,to:0.14}, duration:2400, yoyo:true, repeat:-1 });
  }

  _buildIsland(W, H) {
    const g = this.add.graphics().setDepth(5);
    const cx = W/2, cy = H * 0.66;
    g.fillStyle(0x000a06, 0.6); g.fillEllipse(cx, cy+14, 200, 44);
    g.fillStyle(0x071510, 1);   g.fillEllipse(cx, cy, 170, 38);
    g.fillStyle(0x0b2018, 1);
    g.fillTriangle(cx-50, cy, cx+8, cy-46, cx+38, cy);
    g.fillTriangle(cx+22, cy, cx+65, cy-32, cx+100, cy);
    g.lineStyle(1, 0x00f5d4, 0.10); g.strokeEllipse(cx, cy, 170, 38);
    // Torches
    [cx-25, cx+48].forEach(tx => {
      const t = this.add.circle(tx, cy-7, 2.5, 0xff9030, 1).setDepth(6);
      this.tweens.add({ targets:t, alpha:{from:1,to:0.25}, scaleX:{from:1,to:1.6}, duration:Phaser.Math.Between(220,480), ease:'Sine.easeInOut', yoyo:true, repeat:-1, delay:Phaser.Math.Between(0,300) });
    });
  }

  // Battle corridor — subtle crossing light beams between ships
  _buildBattleCorridor(W, H) {
    const g = this.add.graphics().setDepth(6);
    const pA = this.playerAnchor, eA = this.enemyAnchor;
    // Faint crossed beam lines
    g.lineStyle(1, 0x00f5d4, 0.03);
    g.beginPath(); g.moveTo(pA.x, pA.y - 60); g.lineTo(eA.x, eA.y - 60); g.strokePath();
    g.lineStyle(1, 0xff3333, 0.03);
    g.beginPath(); g.moveTo(pA.x, pA.y + 20); g.lineTo(eA.x, eA.y + 20); g.strokePath();
    // Center divider glow — vertical line at W/2
    const div = this.add.graphics().setDepth(6);
    div.lineStyle(1, 0xffd700, 0.06);
    div.beginPath(); div.moveTo(W/2, H*0.12); div.lineTo(W/2, H*0.68); div.strokePath();
    // Pulsing center cross
    const cx = this.add.circle(W/2, H*0.50, 6, 0xffd700, 0.25).setDepth(7);
    this.tweens.add({ targets:cx, alpha:{from:0.1,to:0.45}, scaleX:{from:0.8,to:1.4}, scaleY:{from:0.8,to:1.4}, duration:1800, ease:'Sine.easeInOut', yoyo:true, repeat:-1 });
  }

  _flashLightning() {
    const W = this.W, H = this.H;
    const flash = this.add.rectangle(W/2, H/2, W, H, 0xffffff, 0.05).setDepth(26);
    this.tweens.add({ targets:flash, alpha:0, duration:160, ease:'Power2', onComplete:()=>flash.destroy() });
    const lx = Phaser.Math.Between(W*0.15, W*0.85);
    const bolt = this.add.graphics().setDepth(26);
    bolt.lineStyle(2, 0xddeeff, 0.65);
    bolt.beginPath(); bolt.moveTo(lx, 0);
    let cy2 = 0;
    while (cy2 < H*0.44) { cy2 += Phaser.Math.Between(16, 36); bolt.lineTo(lx + Phaser.Math.Between(-26, 26), cy2); }
    bolt.strokePath();
    this.tweens.add({ targets:bolt, alpha:0, duration:200, ease:'Power2', onComplete:()=>bolt.destroy() });
  }

  // ─── SHIP PLACEMENT ────────────────────────────────────────────────────────
  _placeShip(cx, cy, isEnemy) {
    const W = this.W, H = this.H;
    const key = isEnemy ? ENEMY_KEY : PLAYER_KEY;

    // MASSIVE — target height = 42% of screen
    const targetH = H * 0.42;
    const sprite = this.add.image(cx, cy, key);
    const scale  = targetH / sprite.height;
    sprite.setScale(scale).setDepth(8).setOrigin(0.5, 0.88);

    // Blend mode removes white background fringing
    sprite.setBlendMode(Phaser.BlendModes.SCREEN);

    // Enemy: crimson tint
    if (isEnemy) sprite.setTint(0xffbbbb);

    // Drop shadow
    const shadowW = sprite.displayWidth * 0.80;
    this.add.ellipse(cx, cy + 8, shadowW, 26, 0x000000, 0.45).setDepth(7);

    // Halo glow behind ship — large, soft, colored
    const glowCol = isEnemy ? 0xff2222 : 0x00f5d4;
    const halo = this.add.ellipse(
      cx, cy - sprite.displayHeight * 0.28,
      sprite.displayWidth * 1.1, sprite.displayHeight * 0.85,
      glowCol, 0.04
    ).setDepth(7);
    this.tweens.add({ targets:halo, alpha:{from:0.02,to:0.08}, duration:2200, ease:'Sine.easeInOut', yoyo:true, repeat:-1 });

    // BOB
    this.tweens.add({ targets:sprite, y:cy+14, duration:2400+(isEnemy?350:0), ease:'Sine.easeInOut', yoyo:true, repeat:-1 });
    // ROLL
    this.tweens.add({ targets:sprite, angle:isEnemy?1.8:-1.8, duration:3200+(isEnemy?500:0), ease:'Sine.easeInOut', yoyo:true, repeat:-1 });

    // Cannon port glows — 4 dots along hull midline
    sprite._dW = sprite.displayWidth;
    sprite._dH = sprite.displayHeight;
    const portY = cy + sprite._dH * 0.22;
    const portXs = [-0.30, -0.11, 0.09, 0.28].map(p => cx + sprite._dW * p * (isEnemy ? -1 : 1));
    portXs.forEach(px => {
      const pg = this.add.circle(px, portY, 4, 0xff8830, 0.55).setDepth(9);
      this.tweens.add({ targets:pg, alpha:{from:0.55,to:0.10}, duration:Phaser.Math.Between(500,1200), ease:'Sine.easeInOut', yoyo:true, repeat:-1, delay:Phaser.Math.Between(0,700) });
    });
    if (!this._ports) this._ports = {};
    this._ports[isEnemy ? 'enemy' : 'player'] = {
      muzzle: { x: isEnemy ? cx - sprite._dW*0.45 : cx + sprite._dW*0.45, y: portY },
    };

    return sprite;
  }

  // ─── HP BARS ──────────────────────────────────────────────────────────────
  _buildHPBar(which, cx, cy) {
    const barW = 260, barH = 20;
    const bx = cx - barW/2;
    const col = which === 'player' ? 0x00f5d4 : 0xff4444;
    const colStr = which === 'player' ? '#00f5d4' : '#ff4444';

    // Outer glow track
    const glow = this.add.graphics().setDepth(9);
    glow.lineStyle(8, col, 0.06);
    glow.strokeRoundedRect(bx-4, cy-4, barW+8, barH+8, 6);

    // Track
    const track = this.add.graphics().setDepth(10);
    track.fillStyle(0x080e1a, 1);
    track.fillRoundedRect(bx, cy, barW, barH, 4);
    track.lineStyle(1, col, 0.30);
    track.strokeRoundedRect(bx, cy, barW, barH, 4);

    // Fill
    const fillGfx = this.add.graphics().setDepth(11);
    this._redrawBar(fillGfx, bx, cy, barW, barH, 100);

    // Segments
    const seg = this.add.graphics().setDepth(12);
    seg.lineStyle(1, 0x000000, 0.45);
    for (let i = 1; i < 10; i++) {
      const sx = bx + (barW/10)*i;
      seg.beginPath(); seg.moveTo(sx, cy+2); seg.lineTo(sx, cy+barH-2); seg.strokePath();
    }

    // Label — ABOVE bar, bold, spaced
    this.add.text(cx, cy - 18, which === 'player' ? 'YOU' : 'ENEMY', {
      fontFamily: "'Courier New', monospace", fontSize: '11px',
      color: colStr, letterSpacing: 5, fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(12);

    // HP number — large, beside bar
    const numX = which === 'player' ? bx + barW + 12 : bx - 12;
    const hpNum = this.add.text(numX, cy + barH/2, '100', {
      fontFamily: "'Courier New', monospace", fontSize: '18px',
      color: colStr, fontStyle: 'bold',
    }).setOrigin(which === 'player' ? 0 : 1, 0.5).setDepth(12);

    // Warn pulse
    const warn = this.add.graphics().setDepth(13).setAlpha(0);
    warn.lineStyle(2, 0xff4444, 1);
    warn.strokeRoundedRect(bx-1, cy-1, barW+2, barH+2, 4);

    this[`${which}Fill`]  = fillGfx;
    this[`${which}Num`]   = hpNum;
    this[`${which}BarX`]  = bx;
    this[`${which}BarY`]  = cy;
    this[`${which}BarW`]  = barW;
    this[`${which}BarH`]  = barH;
    this[`${which}Warn`]  = warn;
    this[`${which}Pulse`] = null;
  }

  _redrawBar(gfx, bx, cy, barW, barH, hp) {
    const fillW = Math.max(0, (hp/100)*barW);
    gfx.clear();
    if (fillW < 2) return;
    const col = hp > 50 ? 0x00f5d4 : hp > 25 ? 0xffd700 : 0xff4444;
    gfx.fillStyle(col, 0.90);
    gfx.fillRoundedRect(bx, cy, fillW, barH, 4);
    // Bright top edge
    gfx.fillStyle(0xffffff, 0.14);
    gfx.fillRoundedRect(bx, cy, fillW, barH*0.4, 4);
  }

  _animBar(which, newHP) {
    const old = which === 'player' ? this.playerHP : this.enemyHP;
    const obj = { hp: old };
    const bx  = this[`${which}BarX`], cy = this[`${which}BarY`];
    const bW  = this[`${which}BarW`], bH = this[`${which}BarH`];
    const gfx = this[`${which}Fill`], num = this[`${which}Num`];
    this.tweens.add({
      targets: obj, hp: newHP, duration: 550, ease: 'Power2',
      onUpdate: () => { this._redrawBar(gfx, bx, cy, bW, bH, obj.hp); num.setText(Math.ceil(obj.hp)+''); },
      onComplete: () => {
        if (which==='player') this.playerHP = newHP; else this.enemyHP = newHP;
        if (newHP < 30) this._lowPulse(which);
      },
    });
    if (newHP < old) {
      const s = which==='player' ? this.playerShip : this.enemyShip;
      if (s) this.tweens.add({ targets:s, alpha:{from:0.15,to:1}, duration:200, ease:'Power1' });
    }
  }

  _lowPulse(which) {
    if (this[`${which}Pulse`]) return;
    const w = this[`${which}Warn`];
    if (!w) return;
    this[`${which}Pulse`] = this.tweens.add({ targets:w, alpha:{from:0.85,to:0}, duration:500, ease:'Sine.easeInOut', yoyo:true, repeat:-1 });
  }

  // ─── EVENTS ────────────────────────────────────────────────────────────────
  _onInit(data) {
    const ph = data.playerHealth ?? 100, eh = data.enemyHealth ?? 100;
    this._redrawBar(this.playerFill, this.playerBarX, this.playerBarY, this.playerBarW, this.playerBarH, ph);
    this._redrawBar(this.enemyFill,  this.enemyBarX,  this.enemyBarY,  this.enemyBarW,  this.enemyBarH,  eh);
    this.playerNum?.setText(String(ph)); this.enemyNum?.setText(String(eh));
    this.playerHP = ph; this.enemyHP = eh;
  }

  _onUpdate(state) {
    const ap = state.lastApproach;
    if (!ap) {
      this._animBar('player', state.playerHealth ?? this.playerHP);
      this._animBar('enemy',  state.enemyHealth  ?? this.enemyHP);
      return;
    }
    if (ap === 'ATTACK') {
      this._fireCannonball(true);
      if ((state.playerHealth ?? this.playerHP) < this.playerHP)
        this.time.delayedCall(520, () => this._fireCannonball(false));
      this.time.delayedCall(430, () => {
        this._animBar('player', state.playerHealth ?? this.playerHP);
        this._animBar('enemy',  state.enemyHealth  ?? this.enemyHP);
      });
    } else if (ap === 'INTIMIDATE') {
      this._intimidate();
      this.time.delayedCall(300, () => this._animBar('enemy', state.enemyHealth ?? this.enemyHP));
    } else if (ap === 'NEGOTIATE') {
      this._negotiate(state.status === 'PLAYER_WON' || (state.enemyHealth??this.enemyHP) < this.enemyHP);
      this.time.delayedCall(300, () => {
        this._animBar('player', state.playerHealth ?? this.playerHP);
        this._animBar('enemy',  state.enemyHealth  ?? this.enemyHP);
      });
    }
    if (state.status === 'PLAYER_WON')  this.time.delayedCall(700, () => this._victoryFX());
    if (state.status === 'PLAYER_LOST') this.time.delayedCall(700, () => this._defeatFX());
  }

  // ─── CANNONBALL ────────────────────────────────────────────────────────────
  _fireCannonball(fromPlayer) {
    const pS = this.playerShip, eS = this.enemyShip;
    const from = fromPlayer
      ? { x: this.playerAnchor.x + (pS?pS._dW*0.46:110), y: this.playerAnchor.y + (pS?pS._dH*0.18:20) }
      : { x: this.enemyAnchor.x  - (eS?eS._dW*0.46:110), y: this.enemyAnchor.y  + (eS?eS._dH*0.18:20) };
    const to   = fromPlayer
      ? { x: this.enemyAnchor.x  - (eS?eS._dW*0.18:40),  y: this.enemyAnchor.y  + (eS?eS._dH*0.18:20) }
      : { x: this.playerAnchor.x + (pS?pS._dW*0.18:40),  y: this.playerAnchor.y + (pS?pS._dH*0.18:20) };
    const col  = fromPlayer ? 0x00f5d4 : 0xff4444;
    const ball = this.add.circle(from.x, from.y, 8, col, 1).setDepth(15);
    const midX = (from.x+to.x)/2, midY = Math.min(from.y,to.y) - 100;
    const t0   = this.time.now;
    // Muzzle flash
    const mz = this.add.circle(from.x, from.y, 16, col, 0.8).setDepth(15);
    this.tweens.add({ targets:mz, scaleX:2.5, scaleY:2.5, alpha:0, duration:200, ease:'Power2', onComplete:()=>mz.destroy() });
    const tick = () => {
      if (!ball.active) return;
      const t = Math.min((this.time.now - t0) / 420, 1);
      const i = 1-t;
      ball.setPosition(i*i*from.x+2*i*t*midX+t*t*to.x, i*i*from.y+2*i*t*midY+t*t*to.y);
      ball.setScale(1 - t*0.35);
      if (t >= 1) {
        // Impact burst
        const flash = this.add.circle(to.x, to.y, 22, col, 0.85).setDepth(16);
        this.tweens.add({ targets:flash, scaleX:3.5, scaleY:3.5, alpha:0, duration:280, ease:'Power2', onComplete:()=>flash.destroy() });
        // Smoke
        for (let s=0;s<4;s++) {
          const sm = this.add.circle(to.x+Phaser.Math.Between(-12,12), to.y+Phaser.Math.Between(-12,12), Phaser.Math.Between(8,18), 0x334455, 0.45).setDepth(15);
          this.tweens.add({ targets:sm, scaleX:3, scaleY:3, alpha:0, y:sm.y-30, duration:Phaser.Math.Between(400,800), ease:'Power1', onComplete:()=>sm.destroy() });
        }
        // Sparks
        for (let j=0;j<12;j++) {
          const sp = this.add.circle(to.x, to.y, Phaser.Math.Between(2,6), col, 1).setDepth(16);
          this.tweens.add({ targets:sp, x:to.x+Phaser.Math.Between(-65,65), y:to.y+Phaser.Math.Between(-55,30), alpha:0, scaleX:0, scaleY:0, duration:Phaser.Math.Between(200,600), ease:'Power2', onComplete:()=>sp.destroy() });
        }
        const target = fromPlayer ? this.enemyShip : this.playerShip;
        if (target) this.tweens.add({ targets:target, alpha:{from:0.12,to:1}, duration:220, ease:'Power1' });
        this.cameras.main.shake(260, 0.005);
        ball.destroy(); return;
      }
      this.time.delayedCall(16, tick);
    };
    tick();
  }

  // ─── EFFECTS ───────────────────────────────────────────────────────────────
  _intimidate() {
    const { x, y } = this.playerAnchor;
    for (let i=0;i<15;i++) {
      const r = this.add.circle(x, y, 16+i*16, 0x9b59b6, 0).setDepth(14);
      this.tweens.add({ targets:r, scaleX:1.7, scaleY:1.7, alpha:{from:0.6,to:0}, duration:800, ease:'Power2', delay:i*75, onComplete:()=>r.destroy() });
    }
    if (this.enemyShip) {
      for (let i=0;i<6;i++) this.time.delayedCall(i*75, () => {
        if (!this.enemyShip?.active) return;
        this.tweens.add({ targets:this.enemyShip, x:this.enemyAnchor.x+Phaser.Math.Between(-9,9), duration:55, ease:'Power1', yoyo:true, onComplete:()=>{ if(this.enemyShip) this.enemyShip.x=this.enemyAnchor.x; } });
      });
    }
    const skull = this.add.text(this.enemyAnchor.x, this.enemyAnchor.y-70, '💀', { fontSize:'44px' }).setOrigin(0.5).setDepth(17).setAlpha(0);
    this.tweens.add({ targets:skull, alpha:{from:0,to:1}, y:this.enemyAnchor.y-120, duration:420, ease:'Power2', yoyo:true, hold:500, onComplete:()=>skull.destroy() });
    this.cameras.main.shake(420, 0.003);
  }

  _negotiate(success) {
    const W=this.W, H=this.H;
    if (success) {
      for (let i=0;i<24;i++) {
        const sp = this.add.circle(W/2+Phaser.Math.Between(-140,140), H*0.5, Phaser.Math.Between(3,7), 0xffd700, 1).setDepth(16);
        this.tweens.add({ targets:sp, y:sp.y-Phaser.Math.Between(90,200), alpha:0, duration:Phaser.Math.Between(600,1200), ease:'Power1', delay:Phaser.Math.Between(0,500), onComplete:()=>sp.destroy() });
      }
      const txt = this.add.text(W/2, H*0.45, 'DEAL STRUCK', { fontFamily:"'Courier New',monospace", fontSize:'30px', color:'#ffd700', fontStyle:'bold', letterSpacing:8, shadow:{x:0,y:0,color:'#ffd700',blur:16,fill:true} }).setOrigin(0.5).setDepth(20).setAlpha(0);
      this.tweens.add({ targets:txt, alpha:{from:0,to:1}, y:H*0.37, duration:360, ease:'Power2', yoyo:true, hold:800, onComplete:()=>txt.destroy() });
      const fl = this.add.rectangle(W/2,H/2,W,H,0xffffff,0.10).setDepth(15);
      this.tweens.add({ targets:fl, alpha:0, duration:320, ease:'Power2', onComplete:()=>fl.destroy() });
    } else {
      const sw = this.add.circle(this.enemyAnchor.x, this.enemyAnchor.y, 10, 0xff4466, 0.8).setDepth(15);
      this.tweens.add({ targets:sw, scaleX:14, scaleY:14, alpha:0, duration:550, ease:'Power2', onComplete:()=>sw.destroy() });
      const rt = this.add.text(W/2, H*0.18, 'REJECTED!', { fontFamily:"'Courier New',monospace", fontSize:'34px', color:'#ff4466', fontStyle:'bold', letterSpacing:8, shadow:{x:0,y:0,color:'#ff4466',blur:18,fill:true} }).setOrigin(0.5).setDepth(20).setAlpha(0);
      this.tweens.add({ targets:rt, alpha:{from:0,to:1}, y:H*0.40, duration:270, ease:'Power3', yoyo:true, hold:600, onComplete:()=>rt.destroy() });
      this.cameras.main.shake(320, 0.007);
    }
  }

  _victoryFX() {
    const W=this.W, H=this.H;
    const fl = this.add.rectangle(W/2,H/2,W,H,0x00f5d4,0.16).setDepth(22);
    this.tweens.add({ targets:fl, alpha:0, duration:900, ease:'Power2', onComplete:()=>fl.destroy() });
    for (let i=0;i<120;i++) {
      const sp = this.add.circle(W/2+Phaser.Math.Between(-180,180), H/2+Phaser.Math.Between(-90,90), Phaser.Math.Between(2,8), Phaser.Utils.Array.GetRandom([0xffd700,0x00f5d4,0xffffff,0xffa040,0x88ffcc]), 1).setDepth(23);
      this.tweens.add({ targets:sp, x:sp.x+Phaser.Math.Between(-340,340), y:sp.y+Phaser.Math.Between(-280,220), alpha:0, scaleX:0, scaleY:0, duration:Phaser.Math.Between(500,1400), ease:'Power2', delay:Phaser.Math.Between(0,600), onComplete:()=>sp.destroy() });
    }
    if (this.playerShip) this.tweens.add({ targets:this.playerShip, angle:-10, duration:700, ease:'Power2' });
    this.cameras.main.shake(450, 0.006);
  }

  _defeatFX() {
    const W=this.W, H=this.H;
    for (let i=0;i<3;i++) this.time.delayedCall(i*220, () => {
      const fl = this.add.rectangle(W/2,H/2,W,H,0xff0000,0.38).setDepth(22);
      this.tweens.add({ targets:fl, alpha:0, duration:170, ease:'Power2', onComplete:()=>fl.destroy() });
    });
    if (this.playerShip) this.tweens.add({ targets:this.playerShip, angle:16, y:this.playerAnchor.y+90, duration:1300, ease:'Power3' });
    if (this.enemyShip)  this.tweens.add({ targets:this.enemyShip,  y:this.enemyAnchor.y-35,  duration:320, ease:'Back.easeOut', yoyo:true, repeat:2 });
    this.cameras.main.shake(550, 0.009);
    this.time.delayedCall(850, () => this.cameras.main.fade(1100, 4, 2, 3));
  }
}
