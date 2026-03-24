import Phaser from 'phaser';

export default class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
    this.playerHP = 100;
    this.enemyHP  = 100;
    this.round    = 1;
    this._shaking = false;
    this._waveOffsets = [];
    this._waveGfx     = [];
    this._lightningTimer = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W; this.H = H;

    // Ship anchor points — pushed far to edges
    this.playerAnchor = { x: W * 0.22, y: H * 0.50 };
    this.enemyAnchor  = { x: W * 0.78, y: H * 0.50 };

    this._drawAtmosphere(W, H);
    this._drawStormClouds(W, H);
    this._drawOcean(W, H);
    this._drawLightningBg(W, H);
    this._drawIslandCenter(W, H);

    this.playerShip = this._buildShip(this.playerAnchor.x, this.playerAnchor.y, false);
    this.enemyShip  = this._buildShip(this.enemyAnchor.x,  this.enemyAnchor.y, true);

    this._buildHPBar('player', this.playerAnchor.x, this.playerAnchor.y + 145);
    this._buildHPBar('enemy',  this.enemyAnchor.x,  this.enemyAnchor.y + 145);

    // Round counter
    this.roundText = this.add.text(W / 2, 58, 'ROUND  1', {
      fontFamily: 'Courier New', fontSize: '13px',
      color: '#ffd700', letterSpacing: 6,
    }).setOrigin(0.5, 0).setDepth(20);

    this.game.events.on('initCombat',   (d) => this._onInit(d));
    this.game.events.on('combatUpdate', (s) => this._onUpdate(s));
  }

  // ─── update loop ───────────────────────────────────────────────────────────
  update() {
    // Animate waves each frame
    const W = this.W, H = this.H;
    const waterY = H * 0.68;
    for (let i = 0; i < this._waveGfx.length; i++) {
      const g  = this._waveGfx[i];
      const wy = waterY + 10 + i * 16;
      this._waveOffsets[i] = (this._waveOffsets[i] || 0) + 1.0 + i * 0.3;
      const off = this._waveOffsets[i];
      g.clear();
      g.lineStyle(1, 0x00f5d4, 0.05 + i * 0.025);
      g.beginPath(); g.moveTo(0, wy);
      for (let x = 0; x <= W; x += 8)
        g.lineTo(x, wy + Math.sin((x + off) * 0.030) * (4 + i * 1.5));
      g.strokePath();
    }
    // Rare lightning flicker
    if (Phaser.Math.Between(1, 3000) === 1) this._flashLightning();
  }

  // ─── ATMOSPHERE ──────────────────────────────────────────────────────────
  _drawAtmosphere(W, H) {
    const g = this.add.graphics().setDepth(0);
    const rows = 20;
    const topColors    = [0x02, 0x05, 0x08];
    const bottomColors = [0x08, 0x0f, 0x18];
    for (let i = 0; i < rows; i++) {
      const t  = i / rows;
      const r  = Math.round(Phaser.Math.Linear(topColors[0], bottomColors[0], t));
      const gv = Math.round(Phaser.Math.Linear(topColors[1], bottomColors[1], t));
      const b  = Math.round(Phaser.Math.Linear(topColors[2], bottomColors[2], t));
      g.fillStyle((r << 16) | (gv << 8) | b, 1);
      g.fillRect(0, (H / rows) * i, W, H / rows + 1);
    }
    // Battle-fire horizon glow at 60% height
    const horizonY = H * 0.60;
    for (let i = 0; i < 6; i++) {
      const a = (0.025 - i * 0.003);
      const spread = 80 + i * 60;
      g.fillStyle(0xff2200, a);
      g.fillRect(0, horizonY - spread / 2, W, spread);
    }
    // Rain mist: 200 random 1px dots
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
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(c.col, 0.92);
      g.fillEllipse(c.x, c.y, c.w, c.h);
      this.tweens.add({
        targets: g,
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
    // Base ocean
    const ob = this.add.graphics().setDepth(3);
    ob.fillStyle(0x030d18, 1);
    ob.fillRect(0, waterY, W, H - waterY);
    // Darker deep band
    ob.fillStyle(0x020810, 1);
    ob.fillRect(0, waterY + (H - waterY) * 0.5, W, (H - waterY) * 0.5);
    // Wave lines (drawn each frame in update)
    for (let i = 0; i < 8; i++) {
      const wg = this.add.graphics().setDepth(4);
      this._waveGfx.push(wg);
      this._waveOffsets.push(i * 30);
    }
    // Foam dots along waterline
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
    // Ocean reflection glow under each ship
    const pg = this.add.ellipse(this.playerAnchor.x, waterY + 20, 220, 40, 0x00f5d4, 0.06).setDepth(3);
    const eg = this.add.ellipse(this.enemyAnchor.x,  waterY + 20, 220, 40, 0xff4444, 0.06).setDepth(3);
    this.tweens.add({ targets: [pg, eg], alpha: { from: 0.04, to: 0.10 }, duration: 2000, yoyo: true, repeat: -1 });
  }

  _drawLightningBg(W, H) {
    this._flashLightningTimer = null; // called from update randomly too
  }

  _flashLightning() {
    const W = this.W, H = this.H;
    const flash = this.add.rectangle(W/2, H/2, W, H, 0xffffff, 0.04).setDepth(25);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 180, ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
    // Jagged bolt
    const lx  = Phaser.Math.Between(W * 0.2, W * 0.8);
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

  _drawIslandCenter(W, H) {
    const g = this.add.graphics().setDepth(5);
    const cx = W / 2, cy = H * 0.65;
    // Shadow
    g.fillStyle(0x001008, 0.5); g.fillEllipse(cx, cy + 12, 180, 40);
    // Island body
    g.fillStyle(0x08180e, 1);   g.fillEllipse(cx, cy, 160, 36);
    // Peaks
    g.fillStyle(0x0c2014, 1);
    g.fillTriangle(cx - 40, cy, cx + 5, cy - 42, cx + 30, cy);
    g.fillTriangle(cx + 18, cy, cx + 60, cy - 30, cx + 90, cy);
    // Outline
    g.lineStyle(1, 0x00f5d4, 0.12); g.strokeEllipse(cx, cy, 160, 36);
    // Torches
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

  // ─── SHIP BUILDER ──────────────────────────────────────────────────────────
  _buildShip(cx, cy, isEnemy) {
    const color = isEnemy ? 0xff4444 : 0x00f5d4;
    const d = isEnemy ? -1 : 1;  // mirror for enemy
    const container = this.add.container(cx, cy).setDepth(8);
    const g = this.add.graphics();

    // — Shadow ellipse under ship
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(0, 42, 280, 28);

    // — HULL — large, 220px wide
    g.fillStyle(0x060e18, 1);
    g.beginPath();
    g.moveTo(-110*d, 30); g.lineTo( 120*d, 30);
    g.lineTo( 138*d,  8); g.lineTo( 118*d,-22);
    g.lineTo(-110*d,-22); g.lineTo(-128*d,  4);
    g.closePath(); g.fillPath();
    // Hull glow border
    g.lineStyle(2.5, color, 0.9);
    g.beginPath();
    g.moveTo(-110*d, 30); g.lineTo( 120*d, 30);
    g.lineTo( 138*d,  8); g.lineTo( 118*d,-22);
    g.lineTo(-110*d,-22); g.lineTo(-128*d,  4);
    g.closePath(); g.strokePath();
    // Hull planking lines
    g.lineStyle(1, color, 0.10);
    [-10, 2, 14].forEach(dy => {
      g.beginPath(); g.moveTo(-108*d, dy); g.lineTo(116*d, dy); g.strokePath();
    });
    // Battle damage scratches
    g.lineStyle(1, color, 0.18);
    [[-60*d, -18, -40*d, -8], [30*d, 8, 50*d, 20]].forEach(([x1,y1,x2,y2]) => {
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.strokePath();
    });
    // 4 cannon ports
    [-70*d, -30*d, 10*d, 50*d].forEach(px => {
      g.fillStyle(0x000000, 1); g.fillRect(px - 5, 4, 10, 14);
      g.lineStyle(1, color, 0.5); g.strokeRect(px - 5, 4, 10, 14);
      // Cannon glow dot
      const cg = this.add.circle(px + cx, 11 + cy, 3, 0xff8830, 0.5).setDepth(9);
      // (Note: relative coords will be off if not added to container)
    });
    // Inner deck accent
    g.fillStyle(color, 0.06); g.fillRect(-100*d, -20, 210, 18);

    // — MAIN MAST (center, tall 200px)
    g.lineStyle(3, color, 0.95);
    g.beginPath(); g.moveTo(5*d, -22); g.lineTo(5*d, -222); g.strokePath();
    // Crow’s nest
    g.fillStyle(0x080f18, 1); g.fillRect(-10*d, -218, 20, 10);
    g.lineStyle(1, color, 0.6); g.strokeRect(-10*d, -218, 20, 10);
    // Mast cap
    g.fillStyle(color, 0.8); g.fillCircle(5*d, -224, 4);

    // — FORE MAST (forward, shorter 150px)
    g.lineStyle(2.5, color, 0.85);
    g.beginPath(); g.moveTo(80*d, -22); g.lineTo(80*d, -172); g.strokePath();
    g.fillStyle(color, 0.7); g.fillCircle(80*d, -176, 3);

    // — RIGGING web
    g.lineStyle(1, color, 0.18);
    const rigging = [
      [5*d,-200, 80*d,-150], [5*d,-200, -100*d,-22],
      [5*d,-200, 120*d,-22], [80*d,-150, 120*d,-22],
      [5*d,-140, 80*d,-100], [5*d,-80,  80*d, -50],
    ];
    rigging.forEach(([x1,y1,x2,y2]) => {
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.strokePath();
    });

    // — MAIN SAIL (large polygon)
    g.fillStyle(color, 0.22);
    g.fillTriangle(5*d,-195, 5*d,-30, 100*d,-80);
    g.lineStyle(1, color, 0.45);
    g.strokeTriangle(5*d,-195, 5*d,-30, 100*d,-80);
    // Sail creases
    g.lineStyle(1, color, 0.12);
    [[5*d,-150, 70*d,-65],[5*d,-110, 55*d,-60],[5*d,-72, 40*d,-52]].forEach(([x1,y1,x2,y2]) => {
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.strokePath();
    });
    // Sail tear
    g.lineStyle(1, color, 0.35);
    g.beginPath(); g.moveTo(40*d,-120); g.lineTo(55*d,-108); g.lineTo(42*d,-95); g.strokePath();

    // — FORE SAIL (smaller)
    g.fillStyle(color, 0.16);
    g.fillTriangle(80*d,-160, 80*d,-22, 138*d,-60);
    g.lineStyle(1, color, 0.35);
    g.strokeTriangle(80*d,-160, 80*d,-22, 138*d,-60);
    [[80*d,-130, 118*d,-55],[80*d,-90, 110*d,-52]].forEach(([x1,y1,x2,y2]) => {
      g.lineStyle(1, color, 0.10);
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.strokePath();
    });

    // — ANCHOR CHAIN
    g.lineStyle(2, color, 0.30);
    g.beginPath(); g.moveTo(-118*d, 20); g.lineTo(-130*d, 40); g.strokePath();

    // — FLAG on main mast
    const flagG = this.add.graphics();
    if (!isEnemy) {
      // Teal skull flag
      flagG.fillStyle(color, 0.85);
      flagG.fillRect(5*d, -222, 28*d, 16);
      flagG.lineStyle(1, 0xffffff, 0.5);
      flagG.fillCircle(14*d + (d > 0 ? 5 : -5), -214, 4);
      flagG.lineStyle(1, 0xffffff, 0.4);
      flagG.beginPath();
      flagG.moveTo(14*d, -210); flagG.lineTo(10*d, -208); flagG.strokePath();
      flagG.beginPath();
      flagG.moveTo(14*d, -210); flagG.lineTo(18*d, -208); flagG.strokePath();
    } else {
      // Red enemy flag
      flagG.fillStyle(0xff4444, 0.85);
      flagG.fillRect(5*d, -222, 28*d, 16);
      flagG.lineStyle(1.5, 0xffffff, 0.5);
      flagG.beginPath();
      flagG.moveTo(10*d,-218); flagG.lineTo(20*d,-208); flagG.strokePath();
      flagG.beginPath();
      flagG.moveTo(20*d,-218); flagG.lineTo(10*d,-208); flagG.strokePath();
    }
    // Flag wave animation (tip)
    const flagTip = this.add.circle((d > 0 ? 33 : -3) + cx, -214 + cy, 2, color, 0.9).setDepth(9);
    this.tweens.add({
      targets: flagTip,
      y: flagTip.y + 4, x: flagTip.x + d * 2,
      duration: 400, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      delay: isEnemy ? 200 : 0,
    });

    // — Soft color glow under hull
    g.fillStyle(color, 0.06);
    g.fillEllipse(0, 34, 320, 50);

    container.add([g, flagG]);

    // — BOB animation
    this.tweens.add({
      targets: container,
      y: cy + 12,
      duration: 2200 + (isEnemy ? 300 : 0),
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
    // Slight roll rotation
    this.tweens.add({
      targets: container,
      angle: isEnemy ? 1.5 : -1.5,
      duration: 3000 + (isEnemy ? 400 : 0),
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    // Cannon port glow circles (in scene, not container)
    const ports = isEnemy ? [0.36, 0.47, 0.58, 0.69] : [0.31, 0.42, 0.53, 0.64];
    ports.forEach(fx => {
      const portX = isEnemy
        ? this.enemyAnchor.x + (fx - 0.5) * 220 * (-1)
        : this.playerAnchor.x + (fx - 0.5) * 220;
      const portGlow = this.add.circle(portX, cy + 11, 3, 0xff8830, 0.5).setDepth(9);
      this.tweens.add({
        targets: portGlow, alpha: { from: 0.5, to: 0.15 },
        duration: Phaser.Math.Between(600, 1200),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 500),
      });
    });

    return container;
  }

  // ─── HP BARS ─────────────────────────────────────────────────────────────────
  _buildHPBar(which, cx, cy) {
    const barW = 220, barH = 18;
    const bx = cx - barW / 2;
    const color = which === 'player' ? 0x00f5d4 : 0xff4444;
    const colorStr = which === 'player' ? '#00f5d4' : '#ff4444';
    const labelStr = which === 'player' ? 'YOU' : 'ENEMY';

    // Track
    const track = this.add.graphics().setDepth(10);
    track.fillStyle(0x0a1520, 1);
    track.fillRoundedRect(bx, cy, barW, barH, 4);
    track.lineStyle(1, color, 0.35);
    track.strokeRoundedRect(bx, cy, barW, barH, 4);

    // Fill (redrawn on damage)
    const fillGfx = this.add.graphics().setDepth(11);
    this._drawHPFill(fillGfx, bx, cy, barW, barH, 100);

    // Segment dividers (static, on top of fill)
    const segGfx = this.add.graphics().setDepth(12);
    segGfx.lineStyle(1, 0x000000, 0.5);
    for (let i = 1; i < 10; i++) {
      const sx = bx + (barW / 10) * i;
      segGfx.beginPath(); segGfx.moveTo(sx, cy); segGfx.lineTo(sx, cy + barH); segGfx.strokePath();
    }

    // Label
    this.add.text(cx, cy - 14, labelStr, {
      fontFamily: 'Courier New', fontSize: '11px',
      color: colorStr, letterSpacing: 4, fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(12);

    // HP number (right of bar)
    const numX = which === 'player' ? bx + barW + 8 : bx - 8;
    const numOrigin = which === 'player' ? [0, 0.5] : [1, 0.5];
    const hpNum = this.add.text(numX, cy + barH / 2, '100', {
      fontFamily: 'Courier New', fontSize: '16px',
      color: colorStr, fontStyle: 'bold',
    }).setOrigin(...numOrigin).setDepth(12);

    // Warning pulse rect (hidden initially)
    const warnGfx = this.add.graphics().setDepth(13).setAlpha(0);
    warnGfx.lineStyle(2, 0xff4444, 1);
    warnGfx.strokeRoundedRect(bx - 1, cy - 1, barW + 2, barH + 2, 4);

    // Store references
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
    // Color by HP level
    const col = hp > 50 ? 0x00f5d4 : hp > 25 ? 0xffd700 : 0xff4444;
    gfx.fillStyle(col, 0.88);
    gfx.fillRoundedRect(bx, cy, fillW, barH, 4);
    // Shine highlight
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
    // Flash ship if taking damage
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
    if (this[`${which}LowPulse`]) return; // already pulsing
    const wg = this[`${which}WarnGfx`];
    if (!wg) return;
    this[`${which}LowPulse`] = this.tweens.add({
      targets: wg, alpha: { from: 0.8, to: 0 },
      duration: 500, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
  }

  // ─── SCREEN SHAKE ──────────────────────────────────────────────────────────
  _screenShake(intensity = 5) {
    if (this._shaking) return;
    this._shaking = true;
    this.cameras.main.shake(280, intensity / 1000, false, () => { this._shaking = false; });
  }

  // ─── INIT / UPDATE HANDLERS ─────────────────────────────────────────────────
  _onInit(data) {
    // Set initial HP from server without any FX
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
    const approach = state.lastApproach; // null = no FX
    const W = this.W;

    // Update round display
    if (state.round) {
      this.round = state.round;
      this.roundText.setText(`ROUND  ${this.round}`);
    }

    if (!approach) {
      // Initial / fallback — just animate bars
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

  // ─── CANNONBALL ────────────────────────────────────────────────────────────
  _fireCannonball(fromPlayer) {
    const from  = fromPlayer
      ? { x: this.playerAnchor.x + 120, y: this.playerAnchor.y + 5 }
      : { x: this.enemyAnchor.x  - 120, y: this.enemyAnchor.y  + 5 };
    const to    = fromPlayer
      ? { x: this.enemyAnchor.x  - 40, y: this.enemyAnchor.y  }
      : { x: this.playerAnchor.x + 40, y: this.playerAnchor.y };
    const color = fromPlayer ? 0x00f5d4 : 0xff4444;
    const ball  = this.add.circle(from.x, from.y, 7, color, 1).setDepth(15);
    const midX  = (from.x + to.x) / 2;
    const midY  = Math.min(from.y, to.y) - 90;
    const totalDuration = 400;
    const startTime = this.time.now;
    // Muzzle flash at origin
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
      const x = inv*inv*from.x + 2*inv*t*midX + t*t*to.x;
      const y = inv*inv*from.y + 2*inv*t*midY  + t*t*to.y;
      ball.setPosition(x, y);
      // Shrink slightly as it travels
      ball.setScale(1 - t * 0.3);
      if (t >= 1) {
        // Impact
        const flash = this.add.circle(to.x, to.y, 20, color, 0.8).setDepth(16);
        this.tweens.add({
          targets: flash, scaleX: 3, scaleY: 3, alpha: 0,
          duration: 260, ease: 'Power2', onComplete: () => flash.destroy(),
        });
        // Smoke puffs
        for (let s = 0; s < 3; s++) {
          const smoke = this.add.circle(
            to.x + Phaser.Math.Between(-10,10), to.y + Phaser.Math.Between(-10,10),
            Phaser.Math.Between(8,16), 0x445566, 0.4
          ).setDepth(15);
          this.tweens.add({
            targets: smoke, scaleX: 2.5, scaleY: 2.5, alpha: 0,
            y: smoke.y - 25, duration: Phaser.Math.Between(400,700), ease: 'Power1',
            onComplete: () => smoke.destroy(),
          });
        }
        // Debris sparks
        for (let i = 0; i < 10; i++) {
          const sp = this.add.circle(to.x, to.y, Phaser.Math.Between(2,5), color, 1).setDepth(16);
          this.tweens.add({
            targets: sp,
            x: to.x + Phaser.Math.Between(-55,55),
            y: to.y + Phaser.Math.Between(-50,25),
            alpha:0, scaleX:0, scaleY:0,
            duration: Phaser.Math.Between(220,550), ease:'Power2',
            onComplete: () => sp.destroy(),
          });
        }
        // Target ship flash
        const targetShip = fromPlayer ? this.enemyShip : this.playerShip;
        if (targetShip) {
          this.tweens.add({ targets: targetShip, alpha: { from:0.15, to:1 }, duration:220, ease:'Power1' });
        }
        this.cameras.main.shake(250, 0.005);
        ball.destroy();
        return;
      }
      this.time.delayedCall(16, tick);
    };
    tick();
  }

  // ─── INTIMIDATE EFFECT ───────────────────────────────────────────────────────
  _intimidateEffect() {
    const { x, y } = this.playerAnchor;
    // 15 expanding purple rings
    for (let i = 0; i < 15; i++) {
      const ring = this.add.circle(x, y, 18 + i * 14, 0x9b59b6, 0).setDepth(14);
      this.tweens.add({
        targets: ring, scaleX: 1.6, scaleY: 1.6, alpha: { from: 0.55, to: 0 },
        duration: 700, ease: 'Power2', delay: i * 70,
        onComplete: () => ring.destroy(),
      });
    }
    // Enemy ship shake
    if (this.enemyShip) {
      for (let i = 0; i < 5; i++) {
        this.time.delayedCall(i * 80, () => {
          if (!this.enemyShip?.active) return;
          this.tweens.add({
            targets: this.enemyShip,
            x: this.enemyAnchor.x + Phaser.Math.Between(-8, 8),
            duration: 60, ease: 'Power1', yoyo: true,
          });
        });
      }
    }
    // Ghostly skull text at enemy
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

  // ─── NEGOTIATE EFFECT ───────────────────────────────────────────────────────
  _negotiateEffect(success) {
    const W = this.W, H = this.H;
    if (success) {
      // Gold sparkles drift upward
      for (let i = 0; i < 20; i++) {
        const sp = this.add.circle(
          W/2 + Phaser.Math.Between(-120,120), H*0.5,
          Phaser.Math.Between(3,6), 0xffd700, 1
        ).setDepth(16);
        this.tweens.add({
          targets: sp, y: sp.y - Phaser.Math.Between(80,180), alpha:0,
          duration: Phaser.Math.Between(600,1100), ease:'Power1',
          delay: Phaser.Math.Between(0,400),
          onComplete: () => sp.destroy(),
        });
      }
      // 'DEAL STRUCK' text rises
      const txt = this.add.text(W/2, H*0.45, 'DEAL STRUCK', {
        fontFamily:'Courier New', fontSize:'28px', color:'#ffd700',
        fontStyle:'bold', letterSpacing:6,
        shadow:{ x:0, y:0, color:'#ffd700', blur:12, fill:true },
      }).setOrigin(0.5).setDepth(20).setAlpha(0);
      this.tweens.add({
        targets: txt, alpha:{ from:0, to:1 }, y: H*0.38,
        duration:350, ease:'Power2', yoyo:true, hold:700,
        onComplete: () => txt.destroy(),
      });
      // Gentle white flash
      const flash = this.add.rectangle(W/2,H/2,W,H,0xffffff,0.12).setDepth(15);
      this.tweens.add({ targets:flash, alpha:0, duration:300, ease:'Power2', onComplete:()=>flash.destroy() });
    } else {
      // Red shockwave from enemy
      const shockwave = this.add.circle(this.enemyAnchor.x, this.enemyAnchor.y, 10, 0xff4466, 0.7).setDepth(15);
      this.tweens.add({
        targets: shockwave, scaleX:12, scaleY:12, alpha:0,
        duration:500, ease:'Power2', onComplete:()=>shockwave.destroy(),
      });
      // 'REJECTED!' slams down
      const rtxt = this.add.text(W/2, H*0.2, 'REJECTED!', {
        fontFamily:'Courier New', fontSize:'32px', color:'#ff4466',
        fontStyle:'bold', letterSpacing:6,
        shadow:{ x:0, y:0, color:'#ff4466', blur:16, fill:true },
      }).setOrigin(0.5).setDepth(20).setAlpha(0);
      this.tweens.add({
        targets: rtxt, alpha:{ from:0, to:1 }, y: H*0.42,
        duration:260, ease:'Power3', yoyo:true, hold:500,
        onComplete:()=>rtxt.destroy(),
      });
      this.cameras.main.shake(300, 0.006);
    }
  }

  // ─── VICTORY FX ──────────────────────────────────────────────────────────────
  _victoryFX() {
    const W = this.W, H = this.H;
    // Teal full-screen flash
    const flood = this.add.rectangle(W/2, H/2, W, H, 0x00f5d4, 0.15).setDepth(22);
    this.tweens.add({ targets:flood, alpha:0, duration:800, ease:'Power2', onComplete:()=>flood.destroy() });
    // 100 particle burst
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
        duration: Phaser.Math.Between(500,1300),
        ease:'Power2', delay: Phaser.Math.Between(0,500),
        onComplete: () => spark.destroy(),
      });
    }
    // Player ship tilts forward
    if (this.playerShip) {
      this.tweens.add({ targets:this.playerShip, angle:-8, duration:600, ease:'Power2' });
    }
    this.cameras.main.shake(400, 0.006);
  }

  // ─── DEFEAT FX ─────────────────────────────────────────────────────────────
  _defeatFX() {
    const W = this.W, H = this.H;
    // 3x rapid red flash
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 200, () => {
        const flash = this.add.rectangle(W/2,H/2,W,H,0xff0000,0.35).setDepth(22);
        this.tweens.add({ targets:flash, alpha:0, duration:160, ease:'Power2', onComplete:()=>flash.destroy() });
      });
    }
    // Player ship sinks
    if (this.playerShip) {
      this.tweens.add({ targets:this.playerShip, angle:15, y: this.playerAnchor.y + 80, duration:1200, ease:'Power3' });
    }
    // Enemy ship celebration bounce
    if (this.enemyShip) {
      this.tweens.add({ targets:this.enemyShip, y: this.enemyAnchor.y - 30, duration:300, ease:'Back.easeOut', yoyo:true, repeat:2 });
    }
    this.cameras.main.shake(500, 0.008);
    // Fade to dark
    this.time.delayedCall(800, () => {
      this.cameras.main.fade(1000, 5, 3, 4);
    });
  }
}
