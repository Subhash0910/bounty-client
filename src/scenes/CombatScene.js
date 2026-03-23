import Phaser from 'phaser';

export default class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
    this.playerHP   = 100;
    this.enemyHP    = 100;
    this.round      = 1;
    this.combatLog  = [];
    this.bars       = {};
  }

  preload() {
    // Particle texture
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.destroy();
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0f);
    this._drawGrid(W, H);
    this._spawnAmbientParticles(W, H);

    // Ships
    this._drawShip(W * 0.22, H * 0.58, 0x00f5d4, 'PLAYER');
    this._drawShip(W * 0.78, H * 0.58, 0xff4444, 'ENEMY', true);

    // Health bars
    this._buildHealthBars(W, H);

    // Round counter
    this.roundText = this.add.text(W / 2, 28, 'ROUND 1', {
      fontFamily: 'Courier New', fontSize: '14px',
      color: '#445566', letterSpacing: 4,
    }).setOrigin(0.5, 0).setDepth(10);

    // Combat log
    this.logTexts = [];
    for (let i = 0; i < 3; i++) {
      this.logTexts.push(
        this.add.text(W / 2, H * 0.82 + i * 18, '', {
          fontFamily: 'Courier New', fontSize: '11px',
          color: i === 0 ? '#8899aa' : '#334455',
          align: 'center',
        }).setOrigin(0.5, 0).setDepth(10)
      );
    }

    // Listen for state updates from React
    this.game.events.on('updateCombat', (state) => this._applyState(state));
    this.game.events.on('addLog', (msg) => this._pushLog(msg));
  }

  // ── State application ─────────────────────────────────────────────────
  _applyState(state) {
    const newPlayerHP = state.playerHealth ?? 100;
    const newEnemyHP  = state.enemyHealth  ?? 100;

    this._animateBar(this.bars.playerFill, this.playerHP, newPlayerHP, 100, this.bars.playerW, 0x00f5d4);
    this._animateBar(this.bars.enemyFill,  this.enemyHP,  newEnemyHP,  100, this.bars.enemyW,  0xff4444);

    this.playerHP = newPlayerHP;
    this.enemyHP  = newEnemyHP;
    this.round    = state.round ?? this.round;
    this.roundText.setText(`ROUND ${this.round}`);

    if (state.status === 'PLAYER_WON')  this._victory();
    if (state.status === 'PLAYER_LOST') this._defeat();
  }

  // ── Health bars ───────────────────────────────────────────────────────────
  _buildHealthBars(W, H) {
    const barW  = W * 0.32;
    const barH  = 12;
    const barY  = 60;
    const padX  = W * 0.08;

    // Player bar
    this.add.rectangle(padX + barW / 2, barY, barW, barH, 0x0f0f1a).setDepth(5);
    this.bars.playerFill = this.add.rectangle(padX + barW / 2, barY, barW, barH, 0x00f5d4).setDepth(6);
    this.add.text(padX, barY - 16, 'YOU', { fontFamily: 'Courier New', fontSize: '10px', color: '#00f5d4' }).setDepth(7);
    this.bars.playerW = barW;
    this.bars.playerX = padX;

    // Enemy bar (right-aligned)
    const eX = W - padX - barW;
    this.add.rectangle(eX + barW / 2, barY, barW, barH, 0x0f0f1a).setDepth(5);
    this.bars.enemyFill = this.add.rectangle(eX + barW / 2, barY, barW, barH, 0xff4444).setDepth(6);
    this.add.text(eX + barW, barY - 16, 'ENEMY', { fontFamily: 'Courier New', fontSize: '10px', color: '#ff4444', align: 'right' }).setOrigin(1, 0).setDepth(7);
    this.bars.enemyW = barW;
    this.bars.enemyX = eX;

    // HP labels
    this.bars.playerLabel = this.add.text(padX + barW / 2, barY + 16, '100 / 100', { fontFamily: 'Courier New', fontSize: '10px', color: '#445566' }).setOrigin(0.5, 0).setDepth(7);
    this.bars.enemyLabel  = this.add.text(eX  + barW / 2, barY + 16, '100 / 100', { fontFamily: 'Courier New', fontSize: '10px', color: '#445566' }).setOrigin(0.5, 0).setDepth(7);
  }

  _animateBar(barRect, oldHP, newHP, maxHP, barW, color) {
    const targetScaleX = Math.max(0, newHP / maxHP);
    this.tweens.add({
      targets: barRect,
      scaleX: targetScaleX,
      duration: 400,
      ease: 'Power2',
    });
    // Flash red on damage
    if (newHP < oldHP) {
      this.tweens.add({
        targets: barRect,
        fillColor: { from: 0xffffff, to: color },
        duration: 300,
        ease: 'Linear',
      });
    }
    const label = color === 0x00f5d4 ? this.bars.playerLabel : this.bars.enemyLabel;
    if (label) label.setText(`${Math.max(0, newHP)} / 100`);
  }

  // ── Ship drawings ───────────────────────────────────────────────────────────
  _drawShip(cx, cy, color, label, flip = false) {
    const g = this.add.graphics().setDepth(4);
    const dir = flip ? -1 : 1;
    g.fillStyle(color, 0.15);
    g.fillEllipse(cx, cy + 10, 110, 40);
    g.lineStyle(2, color, 0.7);
    // Hull
    g.beginPath();
    g.moveTo(cx - 50 * dir, cy + 20);
    g.lineTo(cx + 60 * dir, cy + 20);
    g.lineTo(cx + 70 * dir, cy);
    g.lineTo(cx + 50 * dir, cy - 10);
    g.lineTo(cx - 50 * dir, cy - 10);
    g.closePath();
    g.strokePath();
    // Mast
    g.moveTo(cx, cy - 10);
    g.lineTo(cx, cy - 70);
    g.strokePath();
    // Sail
    g.fillStyle(color, 0.2);
    g.fillTriangle(
      cx, cy - 65,
      cx + 35 * dir, cy - 30,
      cx, cy - 20
    );
    // Bob tween
    this.tweens.add({
      targets: g, y: 6, duration: 1800,
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      delay: flip ? 400 : 0,
    });
    this.add.text(cx, cy + 35, label, {
      fontFamily: 'Courier New', fontSize: '10px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(5);
  }

  // ── Log ───────────────────────────────────────────────────────────────────
  _pushLog(msg) {
    this.combatLog.unshift(msg);
    if (this.combatLog.length > 3) this.combatLog.pop();
    this.logTexts.forEach((t, i) => {
      t.setText(this.combatLog[i] || '');
      t.setColor(i === 0 ? '#8899aa' : '#334455');
    });
  }

  // ── Win / Lose FX ─────────────────────────────────────────────────────────
  _victory() {
    const W = this.scale.width;
    const H = this.scale.height;
    // Gold particle burst
    for (let i = 0; i < 60; i++) {
      const spark = this.add.circle(
        W / 2, H / 2,
        Phaser.Math.Between(2, 5),
        Phaser.Utils.Array.GetRandom([0xffd700, 0x00f5d4, 0xffffff]),
        1
      ).setDepth(20);
      this.tweens.add({
        targets: spark,
        x: W / 2 + Phaser.Math.Between(-300, 300),
        y: H / 2 + Phaser.Math.Between(-300, 300),
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: Phaser.Math.Between(600, 1400),
        ease: 'Power2',
        delay: Phaser.Math.Between(0, 300),
        onComplete: () => spark.destroy(),
      });
    }
    this.add.text(W / 2, H / 2, 'VICTORY', {
      fontFamily: 'Courier New', fontSize: '42px',
      color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(25);
  }

  _defeat() {
    const W = this.scale.width;
    const H = this.scale.height;
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(20);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0.35, to: 0 },
      duration: 800, ease: 'Power2',
    });
    this.add.text(W / 2, H / 2, 'DEFEATED', {
      fontFamily: 'Courier New', fontSize: '42px',
      color: '#ff4466', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(25);
  }

  // ── Ambient ────────────────────────────────────────────────────────────────
  _drawGrid(W, H) {
    const g = this.add.graphics();
    g.lineStyle(1, 0x0d1a2a, 0.5);
    for (let x = 0; x < W; x += 60) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y < H; y += 60) { g.moveTo(0, y); g.lineTo(W, y); }
    g.strokePath();
  }

  _spawnAmbientParticles(W, H) {
    for (let i = 0; i < 25; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H),
        Phaser.Math.Between(1, 2),
        0x00f5d4, 0.1
      );
      this.tweens.add({
        targets: dot,
        x: `+=${Phaser.Math.Between(-60, 60)}`,
        y: `+=${Phaser.Math.Between(-20, 20)}`,
        alpha: { from: 0.05, to: 0.2 },
        duration: Phaser.Math.Between(2500, 6000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }
  }
}
