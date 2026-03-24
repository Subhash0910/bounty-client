import Phaser from 'phaser';

export default class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
    this.playerHP    = 100;
    this.enemyHP     = 100;
    this.round       = 1;
    this.combatLog   = [];
    this.playerShipG = null;
    this.enemyShipG  = null;
    this.bars        = {};
    this._shaking    = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W; this.H = H;

    this._drawBackground(W, H);
    this._drawIslandSilhouette(W, H);
    this._drawWater(W, H);
    this._drawFog(W, H);

    this.playerShipG = this._buildShip(W * 0.20, H * 0.55, 0x00f5d4, false);
    this.enemyShipG  = this._buildShip(W * 0.80, H * 0.55, 0xff4444, true);

    this._addShipLabel(W * 0.20, H * 0.55 + 72, 'YOU',   '#00f5d4');
    this._addShipLabel(W * 0.80, H * 0.55 + 72, 'ENEMY', '#ff4444');

    this._buildHealthBars(W, H);
    this._buildRoundText(W);
    this._buildLog(W, H);

    this.playerCenter = { x: W * 0.20, y: H * 0.55 - 10 };
    this.enemyCenter  = { x: W * 0.80, y: H * 0.55 - 10 };

    this.game.events.on('updateCombat', (state) => this._applyState(state));
    this.game.events.on('addLog',       (msg)   => this._pushLog(msg));
  }

  // ─── Background ──────────────────────────────────────────────────────────
  _drawBackground(W, H) {
    const grad = this.add.graphics().setDepth(0);
    const rows = 12;
    for (let i = 0; i < rows; i++) {
      const t   = i / rows;
      const r   = Math.round(Phaser.Math.Linear(0x0a, 0x04, t));
      const g2  = Math.round(Phaser.Math.Linear(0x0a, 0x08, t));
      const b   = Math.round(Phaser.Math.Linear(0x0f, 0x18, t));
      const col = (r << 16) | (g2 << 8) | b;
      grad.fillStyle(col, 1);
      grad.fillRect(0, (H / rows) * i, W, H / rows + 1);
    }
    const grid = this.add.graphics().setDepth(1);
    grid.fillStyle(0x00f5d4, 0.04);
    for (let x = 30; x < W; x += 50)
      for (let y = 30; y < H; y += 50)
        grid.fillCircle(x, y, 1);
    const stars = this.add.graphics().setDepth(1);
    stars.fillStyle(0xffffff, 1);
    for (let i = 0; i < 60; i++) {
      const sx = Phaser.Math.Between(0, W);
      const sy = Phaser.Math.Between(0, H * 0.35);
      stars.fillCircle(sx, sy, Math.random() < 0.2 ? 1.5 : 0.8);
    }
    for (let i = 0; i < 8; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H * 0.3),
        1, 0xffffff, 0.9
      ).setDepth(1);
      this.tweens.add({
        targets: dot, alpha: { from: 0.9, to: 0.1 },
        duration: Phaser.Math.Between(800, 2000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 1500),
      });
    }
  }

  // ─── Island silhouette ───────────────────────────────────────────────────
  _drawIslandSilhouette(W, H) {
    const g = this.add.graphics().setDepth(2);
    const cx = W / 2, cy = H * 0.62;
    g.fillStyle(0x001a10, 0.6); g.fillEllipse(cx, cy + 10, 340, 70);
    g.fillStyle(0x0a1a12, 1);   g.fillEllipse(cx, cy, 300, 55);
    g.fillStyle(0x0d2018, 1);
    g.fillTriangle(cx - 60, cy, cx - 10, cy - 55, cx + 20, cy);
    g.fillTriangle(cx + 20, cy, cx + 70, cy - 40, cx + 110, cy);
    g.fillTriangle(cx - 120, cy, cx - 70, cy - 28, cx - 30, cy);
    g.lineStyle(1, 0x00f5d4, 0.15); g.strokeEllipse(cx, cy, 300, 55);
    [cx - 40, cx + 50, cx + 90].forEach(tx => {
      const torch = this.add.circle(tx, cy - 8, 2, 0xffa040, 1).setDepth(3);
      this.tweens.add({
        targets: torch, alpha: { from: 1, to: 0.3 }, scaleX: { from: 1, to: 1.4 },
        duration: Phaser.Math.Between(300, 600),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 400),
      });
    });
  }

  // ─── Animated water ──────────────────────────────────────────────────────
  _drawWater(W, H) {
    const waterY = H * 0.65;
    const wb = this.add.graphics().setDepth(2);
    wb.fillStyle(0x051520, 0.7);
    wb.fillRect(0, waterY, W, H - waterY);
    for (let row = 0; row < 5; row++) {
      const wy   = waterY + 12 + row * 14;
      const wave = this.add.graphics().setDepth(3);
      const drawWave = (offset) => {
        wave.clear();
        wave.lineStyle(1, 0x00f5d4, 0.06 + row * 0.02);
        wave.beginPath(); wave.moveTo(0, wy);
        for (let x = 0; x <= W; x += 8)
          wave.lineTo(x, wy + Math.sin((x + offset) * 0.035) * (3 + row));
        wave.strokePath();
      };
      let offset = 0;
      this.time.addEvent({ delay: 32, loop: true, callback: () => { offset += 1.2; drawWave(offset); } });
      drawWave(0);
    }
    for (let i = 0; i < 18; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(waterY, H),
        Phaser.Math.Between(1, 2), 0x00f5d4, 0.12
      ).setDepth(3);
      this.tweens.add({
        targets: dot, x: `+=${Phaser.Math.Between(-40, 40)}`,
        alpha: { from: 0.04, to: 0.22 },
        duration: Phaser.Math.Between(2000, 5000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }
  }

  // ─── Fog strips ──────────────────────────────────────────────────────────
  _drawFog(W, H) {
    for (let i = 0; i < 3; i++) {
      const fy  = H * (0.48 + i * 0.06);
      const fog = this.add.graphics().setDepth(4);
      fog.fillStyle(0x0a0e18, 0.18 - i * 0.04);
      fog.fillEllipse(W * 0.5, fy, W * 1.3, 60);
      this.tweens.add({
        targets: fog, x: Phaser.Math.Between(-30, 30),
        alpha: { from: 0.12, to: 0.22 },
        duration: Phaser.Math.Between(4000, 8000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: i * 800,
      });
    }
  }

  // ─── Ship builder ────────────────────────────────────────────────────────
  _buildShip(cx, cy, color, flip) {
    const container = this.add.container(cx, cy).setDepth(6);
    const g = this.add.graphics();
    const d = flip ? -1 : 1;
    g.fillStyle(0x000000, 0.3); g.fillEllipse(0, 28, 130, 22);
    g.fillStyle(0x0a1520, 1);
    g.beginPath();
    g.moveTo(-55*d,18); g.lineTo(65*d,18); g.lineTo(78*d,0);
    g.lineTo(60*d,-14); g.lineTo(-55*d,-14); g.lineTo(-65*d,4);
    g.closePath(); g.fillPath();
    g.lineStyle(2, color, 0.85);
    g.beginPath();
    g.moveTo(-55*d,18); g.lineTo(65*d,18); g.lineTo(78*d,0);
    g.lineTo(60*d,-14); g.lineTo(-55*d,-14); g.lineTo(-65*d,4);
    g.closePath(); g.strokePath();
    g.lineStyle(1, color, 0.12);
    [-6, 4].forEach(dy => { g.beginPath(); g.moveTo(-52*d, dy); g.lineTo(60*d, dy); g.strokePath(); });
    [0.3, 0.55, 0.75].forEach(t => {
      const px = Phaser.Math.Linear(-40*d, 50*d, t);
      g.fillStyle(color, 0.5); g.fillRect(px-3, 2, 6, 10);
      g.fillStyle(0x000000, 1); g.fillRect(px-2, 4, 4, 7);
    });
    g.lineStyle(2, color, 0.9);
    g.beginPath(); g.moveTo(0,-14); g.lineTo(0,-90); g.strokePath();
    g.fillStyle(0x0a1520,1); g.fillRect(-8,-95,16,10);
    g.lineStyle(1, color, 0.7); g.strokeRect(-8,-95,16,10);
    g.fillStyle(color, 0.6); g.fillCircle(0,-100,3);
    g.lineStyle(1, color, 0.5);
    g.beginPath(); g.moveTo(0,-70); g.lineTo(-30*d,-45); g.strokePath();
    g.fillStyle(color, 0.18);
    g.fillTriangle(0,-85, 40*d,-45, 0,-20);
    g.lineStyle(1, color, 0.5);
    g.strokeTriangle(0,-85, 40*d,-45, 0,-20);
    g.lineStyle(1, color, 0.2);
    g.beginPath(); g.moveTo(0,-55); g.lineTo(30*d,-42); g.strokePath();
    g.fillStyle(color, 0.9);
    g.fillTriangle(0,-92, 14*d,-86, 0,-80);
    g.lineStyle(1, color, 0.15);
    g.beginPath(); g.moveTo(0,-88); g.lineTo(60*d,-14); g.strokePath();
    g.beginPath(); g.moveTo(0,-88); g.lineTo(-40*d,-10); g.strokePath();
    container.add(g);
    this.tweens.add({
      targets: container, y: cy + 7,
      duration: 1800 + (flip ? 300 : 0),
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
    return container;
  }

  _addShipLabel(x, y, text, color) {
    this.add.text(x, y, text, {
      fontFamily: 'Courier New', fontSize: '11px',
      color, letterSpacing: 3,
    }).setOrigin(0.5, 0).setDepth(7);
  }

  // ─── Health bars (Graphics redraw — no scaleX anchor bug) ────────────────────
  _buildHealthBars(W, H) {
    const barW = W * 0.30, barH = 14, barY = 55, padX = W * 0.07;
    this.bars.playerW = barW; this.bars.enemyW = barW;
    this.bars.barY = barY; this.bars.barH = barH;
    this.bars.padX = padX; this.bars.eX = W - padX - barW;

    const pTrack = this.add.graphics().setDepth(8);
    pTrack.fillStyle(0x0d1a22,1); pTrack.fillRoundedRect(padX, barY-barH/2, barW, barH, 3);
    pTrack.lineStyle(1,0x00f5d455,1); pTrack.strokeRoundedRect(padX, barY-barH/2, barW, barH, 3);
    this.bars.playerGfx = this.add.graphics().setDepth(9);
    this._redrawBar(this.bars.playerGfx, padX, barY, barW, barH, 100, 100, 0x00f5d4);
    this.add.text(padX, barY-barH/2-14, 'YOU', { fontFamily:'Courier New', fontSize:'10px', color:'#00f5d4', fontStyle:'bold' }).setDepth(10);
    this.bars.playerLabel = this.add.text(padX+barW, barY-barH/2-14, '100', { fontFamily:'Courier New', fontSize:'10px', color:'#00f5d4' }).setOrigin(1,0).setDepth(10);

    const eX = this.bars.eX;
    const eTrack = this.add.graphics().setDepth(8);
    eTrack.fillStyle(0x0d1a22,1); eTrack.fillRoundedRect(eX, barY-barH/2, barW, barH, 3);
    eTrack.lineStyle(1,0xff444455,1); eTrack.strokeRoundedRect(eX, barY-barH/2, barW, barH, 3);
    this.bars.enemyGfx = this.add.graphics().setDepth(9);
    this._redrawBar(this.bars.enemyGfx, eX, barY, barW, barH, 100, 100, 0xff4444);
    this.add.text(eX+barW, barY-barH/2-14, 'ENEMY', { fontFamily:'Courier New', fontSize:'10px', color:'#ff4444', fontStyle:'bold' }).setOrigin(1,0).setDepth(10);
    this.bars.enemyLabel = this.add.text(eX, barY-barH/2-14, '100', { fontFamily:'Courier New', fontSize:'10px', color:'#ff4444' }).setDepth(10);
  }

  _redrawBar(gfx, x, barY, barW, barH, currentHP, maxHP, color) {
    const fillW = Math.max(0, (currentHP / maxHP) * barW);
    gfx.clear();
    if (fillW > 2) {
      gfx.fillStyle(color, 0.85); gfx.fillRoundedRect(x, barY-barH/2, fillW, barH, 3);
      gfx.fillStyle(0xffffff, 0.08); gfx.fillRoundedRect(x, barY-barH/2, fillW, barH/2, 3);
    }
  }

  _animateBar(isPlayer, newHP) {
    const oldHP = isPlayer ? this.playerHP : this.enemyHP;
    const gfx   = isPlayer ? this.bars.playerGfx  : this.bars.enemyGfx;
    const label = isPlayer ? this.bars.playerLabel : this.bars.enemyLabel;
    const x     = isPlayer ? this.bars.padX        : this.bars.eX;
    const color = isPlayer ? 0x00f5d4 : 0xff4444;
    const ship  = isPlayer ? this.playerShipG : this.enemyShipG;
    const { barW, barH, barY } = this.bars;
    const obj = { hp: oldHP };
    this.tweens.add({
      targets: obj, hp: newHP, duration: 450, ease: 'Power2',
      onUpdate: () => {
        this._redrawBar(gfx, x, barY, barW, barH, obj.hp, 100, color);
        label.setText(Math.ceil(obj.hp).toString());
      },
    });
    if (newHP < oldHP && ship) {
      this.tweens.add({ targets: ship, alpha: { from: 0.3, to: 1 }, duration: 200, ease: 'Power1' });
      this._screenShake(isPlayer ? 4 : 6);
    }
  }

  // ─── Screen shake ────────────────────────────────────────────────────────
  _screenShake(intensity = 5) {
    if (this._shaking) return;
    this._shaking = true;
    this.cameras.main.shake(280, intensity / 1000, false, () => { this._shaking = false; });
  }

  // ─── Round text ──────────────────────────────────────────────────────────
  _buildRoundText(W) {
    this.roundText = this.add.text(W / 2, 32, 'ROUND  1', {
      fontFamily: 'Courier New', fontSize: '13px',
      color: '#334455', letterSpacing: 6,
    }).setOrigin(0.5, 0).setDepth(10);
  }

  // ─── Combat log ──────────────────────────────────────────────────────────
  _buildLog(W, H) {
    const logY = H * 0.84;
    const bg = this.add.graphics().setDepth(9);
    bg.fillStyle(0x050810, 0.7); bg.fillRoundedRect(W/2-340, logY-8, 680, 70, 4);
    bg.lineStyle(1, 0x00f5d422, 1); bg.strokeRoundedRect(W/2-340, logY-8, 680, 70, 4);
    this.logTexts = [];
    for (let i = 0; i < 3; i++) {
      this.logTexts.push(
        this.add.text(W/2, logY + i*20, '', {
          fontFamily: 'Courier New', fontSize: '11px',
          color: i === 0 ? '#8899aa' : '#2a3a4a', align: 'center',
        }).setOrigin(0.5, 0).setDepth(11)
      );
    }
  }

  // ─── FIX 3: Cannonball — timer-based bezier, no conflicting tween props ──────────
  _fireCannonball(fromPlayer) {
    const from  = fromPlayer ? this.playerCenter : this.enemyCenter;
    const to    = fromPlayer ? this.enemyCenter  : this.playerCenter;
    const color = fromPlayer ? 0x00f5d4 : 0xff4444;
    const ball  = this.add.circle(from.x, from.y, 5, color, 1).setDepth(12);
    const midY  = Math.min(from.y, to.y) - 80;
    const midX  = (from.x + to.x) / 2;
    const totalDuration = 380;
    const startTime = this.time.now;

    const updateBall = () => {
      if (!ball.active) return; // guard if scene destroyed mid-flight
      const elapsed = this.time.now - startTime;
      const t = Math.min(elapsed / totalDuration, 1);
      // Quadratic bezier: P = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
      const inv = 1 - t;
      const x = inv*inv*from.x + 2*inv*t*midX + t*t*to.x;
      const y = inv*inv*from.y + 2*inv*t*midY  + t*t*to.y;
      ball.setPosition(x, y);

      if (t >= 1) {
        // Impact flash
        const flash = this.add.circle(to.x, to.y, 18, color, 0.7).setDepth(13);
        this.tweens.add({
          targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0,
          duration: 220, ease: 'Power2',
          onComplete: () => flash.destroy(),
        });
        // Debris sparks
        for (let i = 0; i < 8; i++) {
          const sp = this.add.circle(to.x, to.y, Phaser.Math.Between(2, 4), color, 1).setDepth(13);
          this.tweens.add({
            targets: sp,
            x: to.x + Phaser.Math.Between(-40, 40),
            y: to.y + Phaser.Math.Between(-40, 20),
            alpha: 0, scaleX: 0, scaleY: 0,
            duration: Phaser.Math.Between(200, 500),
            ease: 'Power2',
            onComplete: () => sp.destroy(),
          });
        }
        this._screenShake(fromPlayer ? 6 : 4);
        ball.destroy();
        return; // stop recursion
      }
      this.time.delayedCall(16, updateBall);
    };
    updateBall();
  }

  // ─── FIX 2: State application — NO fallback to 'ATTACK' on null approach ──────
  _applyState(state) {
    const newPlayerHP = state.playerHealth ?? 100;
    const newEnemyHP  = state.enemyHealth  ?? 100;
    const approach    = state.lastApproach; // undefined/null = no FX

    // Only trigger FX when there's an actual player action
    if (approach === 'ATTACK') {
      this._fireCannonball(true);
      if (newEnemyHP < this.enemyHP) {
        this.time.delayedCall(420, () => this._fireCannonball(false));
      }
    } else if (approach === 'INTIMIDATE') {
      this._intimidateFX();
    } else if (approach === 'NEGOTIATE') {
      this._negotiateFX(state.status === 'PLAYER_WON');
    }
    // null/undefined → no FX (initial load, sail start)

    this.time.delayedCall(400, () => {
      this._animateBar(true,  newPlayerHP);
      this._animateBar(false, newEnemyHP);
      this.playerHP = newPlayerHP;
      this.enemyHP  = newEnemyHP;
    });

    this.round = state.round ?? this.round;
    this.roundText.setText(`ROUND  ${this.round}`);

    if (state.status === 'PLAYER_WON')  this.time.delayedCall(600, () => this._victory());
    if (state.status === 'PLAYER_LOST') this.time.delayedCall(600, () => this._defeat());
  }

  // ─── Intimidate FX ───────────────────────────────────────────────────────
  _intimidateFX() {
    const { x, y } = this.playerCenter;
    for (let i = 0; i < 12; i++) {
      const ring = this.add.circle(x, y, 20 + i * 12, 0x9b59b6, 0).setDepth(12);
      this.tweens.add({
        targets: ring, scaleX: 1.5, scaleY: 1.5, alpha: { from: 0.5, to: 0 },
        duration: 600, ease: 'Power2', delay: i * 60,
        onComplete: () => ring.destroy(),
      });
    }
    this._screenShake(3);
  }

  // ─── Negotiate FX ────────────────────────────────────────────────────────
  _negotiateFX(success) {
    const col  = success ? 0xffd700 : 0xff4466;
    const W    = this.W, H = this.H;
    const text = this.add.text(W/2, H*0.4, success ? 'DEAL STRUCK' : 'REJECTED', {
      fontFamily: 'Courier New', fontSize: '22px',
      color: success ? '#ffd700' : '#ff4466',
      fontStyle: 'bold', letterSpacing: 6,
    }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({
      targets: text, alpha: { from: 0, to: 1 }, y: H*0.35,
      duration: 300, ease: 'Power2', yoyo: true, hold: 600,
      onComplete: () => text.destroy(),
    });
    if (!success) this._screenShake(5);
  }

  // ─── Log ─────────────────────────────────────────────────────────────────
  _pushLog(msg) {
    this.combatLog.unshift(msg);
    if (this.combatLog.length > 3) this.combatLog.pop();
    this.logTexts.forEach((t, i) => {
      t.setText(this.combatLog[i] || '');
      t.setColor(i === 0 ? '#8899aa' : '#2a3a4a');
    });
  }

  // ─── Victory FX ──────────────────────────────────────────────────────────
  _victory() {
    const W = this.W, H = this.H;
    for (let i = 0; i < 80; i++) {
      const spark = this.add.circle(
        W/2 + Phaser.Math.Between(-100,100),
        H/2 + Phaser.Math.Between(-60,60),
        Phaser.Math.Between(2,6),
        Phaser.Utils.Array.GetRandom([0xffd700,0x00f5d4,0xffffff,0xffa040]), 1
      ).setDepth(22);
      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-250,250),
        y: spark.y + Phaser.Math.Between(-200,200),
        alpha:0, scaleX:0, scaleY:0,
        duration: Phaser.Math.Between(500,1200),
        ease:'Power2', delay: Phaser.Math.Between(0,400),
        onComplete: () => spark.destroy(),
      });
    }
    this.add.text(W/2, H/2-10, 'VICTORY', {
      fontFamily:'Courier New', fontSize:'52px', color:'#ffd700', fontStyle:'bold',
      shadow:{ x:0, y:0, color:'#ffd700', blur:24, fill:true },
    }).setOrigin(0.5).setDepth(25);
    this.cameras.main.shake(400, 0.006);
  }

  // ─── Defeat FX ───────────────────────────────────────────────────────────
  _defeat() {
    const W = this.W, H = this.H;
    const flash = this.add.rectangle(W/2, H/2, W, H, 0xff0000, 0).setDepth(22);
    this.tweens.add({ targets:flash, alpha:{ from:0.45, to:0 }, duration:900, ease:'Power2' });
    this.cameras.main.shake(500, 0.008);
    this.add.text(W/2, H/2-10, 'DEFEATED', {
      fontFamily:'Courier New', fontSize:'52px', color:'#ff4466', fontStyle:'bold',
      shadow:{ x:0, y:0, color:'#ff4466', blur:24, fill:true },
    }).setOrigin(0.5).setDepth(25);
  }
}
