import Phaser from 'phaser';

const TYPE_COLORS = {
  DRIFTER:  0x4a9eff,
  MERCHANT: 0xffd700,
  WARLORD:  0xff4444,
  VOID:     0x9b59b6,
};

const TYPE_GLOW = {
  DRIFTER:  '#4a9eff',
  MERCHANT: '#ffd700',
  WARLORD:  '#ff4444',
  VOID:     '#9b59b6',
};

export default class WorldMapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldMapScene' });
    this.islands    = [];
    this.particles  = [];
    this.tooltip    = null;
    this.playerData = { handle: '', bounty: 0 };
  }

  // ── Preload ────────────────────────────────────────────────────────────────
  preload() {
    // Generate a tiny white circle texture for particles
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x00f5d4, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle', 8, 8);
    g.destroy();
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dark ocean background
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0f);

    // Subtle grid lines for ocean depth feel
    this._drawGrid(W, H);

    // Wave particles
    this._spawnWaves(W, H);

    // Player info from localStorage
    this.playerData.handle = localStorage.getItem('handle') || 'Drifter';
    this.playerData.bounty = localStorage.getItem('bounty') || '0';
    this._drawHUD();

    // Fetch islands
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/world/map',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to load map');
      this.islands = await res.json();
    } catch (e) {
      this._showError('Could not load world map. Is the server running?');
      return;
    }

    // Render islands
    this.islands.forEach(island => this._renderIsland(island, W, H));

    // Tooltip container (hidden until hover)
    this._buildTooltip();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _drawGrid(W, H) {
    const g = this.add.graphics();
    g.lineStyle(1, 0x0d1a2a, 0.6);
    for (let x = 0; x < W; x += 60) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y < H; y += 60) { g.moveTo(0, y); g.lineTo(W, y); }
    g.strokePath();
  }

  _spawnWaves(W, H) {
    // Floating teal dots that drift slowly across the screen
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, W);
      const y = Phaser.Math.Between(0, H);
      const dot = this.add.circle(x, y, Phaser.Math.Between(1, 3), 0x00f5d4, 0.15);
      this.tweens.add({
        targets: dot,
        x: x + Phaser.Math.Between(-80, 80),
        y: y + Phaser.Math.Between(-30, 30),
        alpha: { from: 0.05, to: 0.25 },
        duration: Phaser.Math.Between(3000, 7000),
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
      });
      this.particles.push(dot);
    }
  }

  _drawHUD() {
    const pad = 18;
    // HUD background strip
    this.add.rectangle(110, 34, 220, 52, 0x0f0f1a, 0.85).setDepth(10);
    this.add.text(pad, pad, this.playerData.handle, {
      fontFamily: 'Courier New',
      fontSize: '15px',
      color: '#00f5d4',
      fontStyle: 'bold',
    }).setDepth(11);
    this.add.text(pad, pad + 20, `BOUNTY  ${Number(this.playerData.bounty).toLocaleString()}`, {
      fontFamily: 'Courier New',
      fontSize: '12px',
      color: '#8899aa',
    }).setDepth(11);
  }

  _renderIsland(island, W, H) {
    // Scale positions from [0,1000] to canvas size with padding
    const pad = 80;
    const x = pad + (island.positionX / 1000) * (W - pad * 2);
    const y = pad + (island.positionY / 1000) * (H - pad * 2);
    const color = TYPE_COLORS[island.type] || 0x00f5d4;
    const radius = 14 + island.difficulty * 2;

    // Glow ring (outer)
    const glow = this.add.circle(x, y, radius + 8, color, 0.12).setDepth(1);
    // Pulse tween on glow
    this.tweens.add({
      targets: glow,
      scaleX: 1.3, scaleY: 1.3,
      alpha: { from: 0.12, to: 0.0 },
      duration: 1800,
      ease: 'Sine.easeOut',
      yoyo: false,
      repeat: -1,
      delay: Phaser.Math.Between(0, 1500),
    });

    // Island circle (interactive)
    const circle = this.add.circle(x, y, radius, color, 0.9)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });

    // Difficulty ring border
    const border = this.add.graphics().setDepth(2);
    border.lineStyle(2, color, 1);
    border.strokeCircle(x, y, radius + 2);

    // Island name label
    this.add.text(x, y + radius + 10, island.name, {
      fontFamily: 'Courier New',
      fontSize: '11px',
      color: '#c0d0e0',
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(3);

    // Flag emoji if owned
    if (island.ownerId) {
      this.add.text(x, y - radius - 18, '🏴', {
        fontSize: '14px',
      }).setOrigin(0.5, 0).setDepth(3);
    }

    // Hover: show tooltip
    circle.on('pointerover', () => {
      circle.setScale(1.15);
      this._showTooltip(island, x, y - radius - 10);
    });
    circle.on('pointerout', () => {
      circle.setScale(1);
      this._hideTooltip();
    });

    // Click: emit event for React to catch
    circle.on('pointerdown', () => {
      this.game.events.emit('islandSelected', island);
    });
  }

  _buildTooltip() {
    this.tooltipContainer = this.add.container(0, 0).setDepth(20).setVisible(false);
    this.tooltipBg = this.add.rectangle(0, 0, 200, 90, 0x0f0f1a, 0.95);
    this.tooltipBg.setStrokeStyle(1, 0x00f5d4, 0.4);
    this.tooltipLine1 = this.add.text(-90, -38, '', { fontFamily: 'Courier New', fontSize: '13px', color: '#00f5d4', fontStyle: 'bold' });
    this.tooltipLine2 = this.add.text(-90, -18, '', { fontFamily: 'Courier New', fontSize: '11px', color: '#ffd700' });
    this.tooltipLine3 = this.add.text(-90,   0, '', { fontFamily: 'Courier New', fontSize: '11px', color: '#8899aa' });
    this.tooltipLine4 = this.add.text(-90,  18, '', { fontFamily: 'Courier New', fontSize: '11px', color: '#aabbcc' });
    this.tooltipContainer.add([this.tooltipBg, this.tooltipLine1, this.tooltipLine2, this.tooltipLine3, this.tooltipLine4]);
  }

  _showTooltip(island, x, y) {
    const stars = '★'.repeat(island.difficulty) + '☆'.repeat(5 - island.difficulty);
    this.tooltipLine1.setText(island.name);
    this.tooltipLine2.setText(`${stars}  ${island.type}`);
    this.tooltipLine3.setText(`BOUNTY  ${island.bountyReward.toLocaleString()}`);
    this.tooltipLine4.setText(island.ownerHandle ? `⚑ ${island.ownerHandle}` : 'UNCLAIMED');
    // Keep tooltip on screen
    const tx = Math.min(x, this.scale.width  - 110);
    const ty = Math.max(y, 60);
    this.tooltipContainer.setPosition(tx, ty).setVisible(true);
  }

  _hideTooltip() {
    this.tooltipContainer.setVisible(false);
  }

  _showError(msg) {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.text(W / 2, H / 2, msg, {
      fontFamily: 'Courier New',
      fontSize: '14px',
      color: '#ff4466',
      align: 'center',
    }).setOrigin(0.5);
  }
}
