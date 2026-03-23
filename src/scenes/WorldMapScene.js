import Phaser from 'phaser';

const TYPE_COLORS = {
  DRIFTER:  0x4a9eff,
  MERCHANT: 0xffd700,
  WARLORD:  0xff4444,
  VOID:     0x9b59b6,
};

export default class WorldMapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldMapScene' });
    this.islands    = [];
    this.playerData = { handle: '', bounty: 0 };
  }

  // ─────────────────────────────────────────────────────────────────────────
  async create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W; this.H = H;

    this._drawOceanBackground(W, H);
    this._drawStarField(W, H);
    this._drawOceanTexture(W, H);
    this._drawAnimatedWaves(W, H);
    this._drawFogLayers(W, H);
    this._drawVignette(W, H);

    this.playerData.handle = localStorage.getItem('handle') || 'Drifter';
    this.playerData.bounty = localStorage.getItem('bounty') || '0';
    this._drawHUD(W, H);
    this._drawLogoutButton(W);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/world/map',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('map fetch failed');
      this.islands = await res.json();
    } catch (e) {
      this._showError('Could not load world map. Is the server running?');
      return;
    }

    this.islands.forEach(island => this._renderIsland(island, W, H));
    this._buildTooltip(W, H);
    this._drawCompass(W, H);
  }

  // ─── Ocean gradient background ───────────────────────────────────────────
  _drawOceanBackground(W, H) {
    const g = this.add.graphics().setDepth(0);
    const rows = 16;
    for (let i = 0; i < rows; i++) {
      const t  = i / rows;
      const r  = Math.round(Phaser.Math.Linear(0x08, 0x02, t));
      const gv = Math.round(Phaser.Math.Linear(0x0c, 0x08, t));
      const b  = Math.round(Phaser.Math.Linear(0x18, 0x22, t));
      g.fillStyle((r << 16) | (gv << 8) | b, 1);
      g.fillRect(0, (H / rows) * i, W, H / rows + 1);
    }
  }

  // ─── Star field ────────────────────────────────────────────────────────────
  _drawStarField(W, H) {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 120; i++) {
      const sx = Phaser.Math.Between(0, W);
      const sy = Phaser.Math.Between(0, H * 0.45);
      const sr = Math.random() < 0.15 ? 1.5 : 0.7;
      g.fillCircle(sx, sy, sr);
    }
    // Occasional twinkling stars
    for (let i = 0; i < 12; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H * 0.4),
        Phaser.Math.Between(1, 2), 0xffffff, 0.9
      ).setDepth(1);
      this.tweens.add({
        targets: dot, alpha: { from: 0.9, to: 0.1 },
        duration: Phaser.Math.Between(700, 2200),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }
    // Moon
    const moon = this.add.graphics().setDepth(1);
    moon.fillStyle(0xeeeedd, 0.9);
    moon.fillCircle(W * 0.88, H * 0.10, 18);
    moon.fillStyle(0x0c1020, 1);
    moon.fillCircle(W * 0.88 + 7, H * 0.10 - 4, 14); // crescent cutout
  }

  // ─── Ocean texture (dot grid + hex cells) ────────────────────────────────
  _drawOceanTexture(W, H) {
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(1, 0x00f5d4, 0.04);
    const step = 55;
    for (let x = 0; x < W; x += step)
      for (let y = 0; y < H; y += step) {
        g.strokeRect(x, y, step, step);
      }
    // Brighter intersection dots
    g.fillStyle(0x00f5d4, 0.07);
    for (let x = 0; x < W; x += step)
      for (let y = 0; y < H; y += step)
        g.fillCircle(x, y, 1.5);
  }

  // ─── Animated wave lines across whole map ──────────────────────────────
  _drawAnimatedWaves(W, H) {
    const numWaves = 8;
    for (let i = 0; i < numWaves; i++) {
      const wy      = H * (0.3 + i * 0.09);
      const opacity = 0.04 + i * 0.01;
      const wave    = this.add.graphics().setDepth(3);
      let offset    = i * 40;
      const draw = () => {
        wave.clear();
        wave.lineStyle(1, 0x00f5d4, opacity);
        wave.beginPath();
        wave.moveTo(0, wy);
        for (let x = 0; x <= W; x += 6)
          wave.lineTo(x, wy + Math.sin((x + offset) * 0.025) * (4 + i * 1.5));
        wave.strokePath();
        offset += 0.8;
      };
      this.time.addEvent({ delay: 30, loop: true, callback: draw });
      draw();
    }
  }

  // ─── Fog ────────────────────────────────────────────────────────────────────
  _drawFogLayers(W, H) {
    for (let i = 0; i < 4; i++) {
      const fy  = H * (0.2 + i * 0.18);
      const fog = this.add.graphics().setDepth(4);
      fog.fillStyle(0x080c18, 0.14 - i * 0.02);
      fog.fillEllipse(W * 0.5, fy, W * 1.5, 80);
      this.tweens.add({
        targets: fog,
        x: Phaser.Math.Between(-50, 50),
        alpha: { from: 0.08, to: 0.18 },
        duration: Phaser.Math.Between(5000, 10000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: i * 1200,
      });
    }
    // Drifting particles across full ocean
    for (let i = 0; i < 30; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H),
        Phaser.Math.Between(1, 2), 0x00f5d4, 0.08
      ).setDepth(4);
      this.tweens.add({
        targets: dot,
        x: `+=${Phaser.Math.Between(-80, 80)}`,
        y: `+=${Phaser.Math.Between(-30, 30)}`,
        alpha: { from: 0.03, to: 0.18 },
        duration: Phaser.Math.Between(3000, 8000),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
      });
    }
  }

  // ─── Edge vignette ─────────────────────────────────────────────────────────
  _drawVignette(W, H) {
    const g = this.add.graphics().setDepth(5);
    // Top edge fade
    for (let i = 0; i < 12; i++) {
      const a = (1 - i / 12) * 0.35;
      g.fillStyle(0x040610, a);
      g.fillRect(0, i * 5, W, 5);
    }
    // Bottom edge
    for (let i = 0; i < 12; i++) {
      const a = (1 - i / 12) * 0.35;
      g.fillStyle(0x040610, a);
      g.fillRect(0, H - i * 5 - 5, W, 5);
    }
    // Left & right
    for (let i = 0; i < 10; i++) {
      const a = (1 - i / 10) * 0.2;
      g.fillStyle(0x040610, a);
      g.fillRect(i * 6, 0, 6, H);
      g.fillRect(W - i * 6 - 6, 0, 6, H);
    }
  }

  // ─── Compass rose (bottom-right) ──────────────────────────────────────────
  _drawCompass(W, H) {
    const cx = W - 44, cy = H - 44;
    const g  = this.add.graphics().setDepth(15);
    g.lineStyle(1, 0x00f5d4, 0.3);
    g.strokeCircle(cx, cy, 28);
    // N needle (teal)
    g.fillStyle(0x00f5d4, 0.7);
    g.fillTriangle(cx, cy - 24, cx - 5, cy, cx + 5, cy);
    // S needle (dim)
    g.fillStyle(0x334455, 0.7);
    g.fillTriangle(cx, cy + 24, cx - 5, cy, cx + 5, cy);
    g.lineStyle(1, 0x00f5d4, 0.2);
    g.moveTo(cx - 24, cy); g.lineTo(cx + 24, cy); g.strokePath();
    this.add.text(cx, cy - 30, 'N', {
      fontFamily: 'Courier New', fontSize: '9px', color: '#00f5d4',
    }).setOrigin(0.5, 1).setDepth(15);
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────────
  _drawHUD(W, H) {
    const bg = this.add.graphics().setDepth(14);
    bg.fillStyle(0x05080f, 0.88);
    bg.fillRoundedRect(10, 10, 220, 62, 5);
    bg.lineStyle(1, 0x00f5d422, 1);
    bg.strokeRoundedRect(10, 10, 220, 62, 5);

    this.add.text(22, 22, this.playerData.handle.toUpperCase(), {
      fontFamily: 'Courier New', fontSize: '14px',
      color: '#00f5d4', fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(15);

    this.add.text(22, 44, 'BOUNTY', {
      fontFamily: 'Courier New', fontSize: '10px', color: '#334455',
    }).setDepth(15);
    this.add.text(80, 44, Number(this.playerData.bounty).toLocaleString(), {
      fontFamily: 'Courier New', fontSize: '10px', color: '#ffd700', fontStyle: 'bold',
    }).setDepth(15);

    // Season badge
    this.add.text(W / 2, 16, 'SEASON  1', {
      fontFamily: 'Courier New', fontSize: '11px',
      color: '#223344', letterSpacing: 5,
    }).setOrigin(0.5, 0).setDepth(15);
  }

  _drawLogoutButton(W) {
    // React handles this — keep DOM button, but remove the old Phaser one if present
  }

  // ─── Island renderer ────────────────────────────────────────────────────────
  _renderIsland(island, W, H) {
    const pad   = 90;
    const x     = pad + (island.positionX / 1000) * (W - pad * 2);
    const y     = pad + (island.positionY / 1000) * (H - pad * 2);
    const color = TYPE_COLORS[island.type] || 0x00f5d4;
    const r     = 11 + island.difficulty * 2.5;

    // Outer soft glow (pulse)
    const glow = this.add.circle(x, y, r + 14, color, 0.08).setDepth(6);
    this.tweens.add({
      targets: glow, scaleX: 1.6, scaleY: 1.6, alpha: 0,
      duration: 2000 + island.difficulty * 200,
      ease: 'Sine.easeOut', repeat: -1,
      delay: Phaser.Math.Between(0, 1500),
    });

    // Mid glow ring
    const midGlow = this.add.circle(x, y, r + 6, color, 0.18).setDepth(7);
    this.tweens.add({
      targets: midGlow, alpha: { from: 0.18, to: 0.05 },
      duration: 1200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      delay: Phaser.Math.Between(0, 800),
    });

    // Island body
    const body = this.add.circle(x, y, r, color, 0.92).setDepth(8).setInteractive({ useHandCursor: true });

    // Inner highlight
    const hl = this.add.graphics().setDepth(9);
    hl.fillStyle(0xffffff, 0.12);
    hl.fillCircle(x - r * 0.25, y - r * 0.25, r * 0.45);

    // Difficulty ring
    const ring = this.add.graphics().setDepth(9);
    ring.lineStyle(1.5, color, 0.9);
    ring.strokeCircle(x, y, r + 1);
    // Second outer ring for hard islands
    if (island.difficulty >= 4) {
      ring.lineStyle(1, color, 0.35);
      ring.strokeCircle(x, y, r + 5);
    }

    // Island name
    this.add.text(x, y + r + 8, island.name, {
      fontFamily: 'Courier New', fontSize: '10px',
      color: '#c0d0e0', align: 'center',
    }).setOrigin(0.5, 0).setDepth(10);

    // Owner flag
    if (island.ownerId) {
      this.add.text(x + r - 2, y - r - 12, '\uD83C\uDFF4', {
        fontSize: '13px',
      }).setOrigin(0, 1).setDepth(10);
    }

    // Hover
    body.on('pointerover', () => {
      body.setScale(1.18);
      ring.setAlpha(1.4);
      this._showTooltip(island, x, y - r - 8);
    });
    body.on('pointerout', () => {
      body.setScale(1);
      ring.setAlpha(1);
      this._hideTooltip();
    });
    body.on('pointerdown', () => {
      this.cameras.main.shake(120, 0.002);
      this.game.events.emit('islandSelected', island);
    });
  }

  // ─── Tooltip ─────────────────────────────────────────────────────────────────
  _buildTooltip(W, H) {
    this.tooltipContainer = this.add.container(0, 0).setDepth(20).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x04070e, 0.96);
    bg.fillRoundedRect(-105, -54, 210, 108, 5);
    bg.lineStyle(1, 0x00f5d4, 0.3);
    bg.strokeRoundedRect(-105, -54, 210, 108, 5);
    // Top accent line
    bg.lineStyle(2, 0x00f5d4, 0.6);
    bg.beginPath(); bg.moveTo(-105, -54); bg.lineTo(105, -54); bg.strokePath();

    this.tooltipL1 = this.add.text(0, -42, '', {
      fontFamily: 'Courier New', fontSize: '12px', color: '#00f5d4',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0);
    this.tooltipL2 = this.add.text(0, -22, '', {
      fontFamily: 'Courier New', fontSize: '10px', color: '#ffd700', align: 'center',
    }).setOrigin(0.5, 0);
    this.tooltipL3 = this.add.text(0, -4, '', {
      fontFamily: 'Courier New', fontSize: '10px', color: '#556677', align: 'center',
    }).setOrigin(0.5, 0);
    this.tooltipL4 = this.add.text(0, 16, '', {
      fontFamily: 'Courier New', fontSize: '10px', color: '#aabbcc', align: 'center',
    }).setOrigin(0.5, 0);
    this.tooltipL5 = this.add.text(0, 36, '', {
      fontFamily: 'Courier New', fontSize: '10px', color: '#8899aa',
      fontStyle: 'italic', align: 'center', wordWrap: { width: 190 },
    }).setOrigin(0.5, 0);
    this.tooltipContainer.add([bg, this.tooltipL1, this.tooltipL2, this.tooltipL3, this.tooltipL4, this.tooltipL5]);
  }

  _showTooltip(island, x, y) {
    const stars  = '\u2605'.repeat(island.difficulty) + '\u2606'.repeat(5 - island.difficulty);
    const typeColors = { DRIFTER: '#4a9eff', MERCHANT: '#ffd700', WARLORD: '#ff4444', VOID: '#9b59b6' };
    this.tooltipL1.setText(island.name).setColor(typeColors[island.type] || '#00f5d4');
    this.tooltipL2.setText(`${stars}   ${island.type}`);
    this.tooltipL3.setText(`BOUNTY REWARD   ${island.bountyReward.toLocaleString()}`);
    this.tooltipL4.setText(island.ownerHandle ? `\u2691 ${island.ownerHandle}` : 'UNCLAIMED');
    this.tooltipL5.setText(island.lore || '');
    const tx = Phaser.Math.Clamp(x, 115, this.W - 115);
    const ty = Phaser.Math.Clamp(y, 60, this.H - 120);
    this.tooltipContainer.setPosition(tx, ty).setVisible(true);
  }

  _hideTooltip() {
    this.tooltipContainer.setVisible(false);
  }

  _showError(msg) {
    this.add.text(this.W / 2, this.H / 2, msg, {
      fontFamily: 'Courier New', fontSize: '14px',
      color: '#ff4466', align: 'center',
    }).setOrigin(0.5).setDepth(30);
  }
}
