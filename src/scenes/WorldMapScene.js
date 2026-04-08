import Phaser from 'phaser';

const TYPE_COLORS = {
  DRIFTER:  0x4a9eff,
  MERCHANT: 0xffd700,
  WARLORD:  0xff4444,
  VOID:     0x9b59b6,
};

const SEA_EVENTS = [
  { id: 'merchant', icon: '🚢', title: 'MERCHANT VESSEL', desc: 'A fat merchant ship wallows nearby. Board her?', reward: 350, risk: 18, riskLabel: '−18 HP' },
  { id: 'wreck',    icon: '⚓', title: 'SUNKEN WRECK',    desc: 'A wreck bleeds gold into the tide. Dive for it?', reward: 200, risk: 0,  riskLabel: 'SAFE' },
  { id: 'storm',    icon: '🌊', title: 'STORM SURGE',     desc: 'A rogue wave batters your hull. Brace or outrun?', reward: 0, risk: 25, riskLabel: '−25 HP OR SAFE' },
  { id: 'duel',     icon: '⚔️', title: 'RIVAL CAPTAIN',   desc: 'A rival captain challenges you on the open sea.', reward: 500, risk: 30, riskLabel: '−30 HP' },
  { id: 'cache',    icon: '💰', title: 'BURIED CACHE',    desc: 'A half-buried chest winks from a sandbar.', reward: 150, risk: 0, riskLabel: 'SAFE' },
];

export default class WorldMapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldMapScene' });
    this.islands    = [];
    this.playerData = { handle: '', bounty: 0 };
  }

  // Guard: returns true if the scene is still alive after an async gap.
  // Call this after every await before touching this.add / this.tweens.
  _alive() {
    return this.sys && this.sys.isActive();
  }

  async create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W; this.H = H;

    this._drawOceanBackground(W, H);
    this._drawStarField(W, H);
    this._drawOceanTexture(W, H);
    this._drawAnimatedWaves(W, H);
    this._drawVignette(W, H);

    this.playerData.handle = localStorage.getItem('handle') || 'Drifter';
    this.playerData.bounty = Number(localStorage.getItem('bounty') || 0);

    // ── Audio: only start after a user gesture to avoid autoplay block ─────
    this.input.once('pointerdown', () => {
      if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
        this.sound.context.resume();
      }
    });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/world/map',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('map fetch failed');
      this.islands = await res.json();
    } catch (e) {
      // Scene may have been torn down while we awaited — guard before touching this.add
      if (!this._alive()) return;
      this._showError('Could not load world map.');
      return;
    }

    // ── Critical guard: scene destroyed while fetch was in-flight ──────────
    if (!this._alive()) return;

    this.islands.forEach(island => this._renderIsland(island, W, H));
    this._buildTooltip(W, H);
    this._drawCompass(W, H);
    this._drawLeaderboard(W, H);
    this._scheduleSeaEvent(W, H);
  }

  // ─── Ocean background ─────────────────────────────────────────────────────
  _drawOceanBackground(W, H) {
    const g = this.add.graphics().setDepth(0);
    const rows = 20;
    for (let i = 0; i < rows; i++) {
      const t  = i / rows;
      const r  = Math.round(Phaser.Math.Linear(0x06, 0x01, t));
      const gv = Math.round(Phaser.Math.Linear(0x0a, 0x05, t));
      const b  = Math.round(Phaser.Math.Linear(0x16, 0x10, t));
      g.fillStyle((r << 16) | (gv << 8) | b, 1);
      g.fillRect(0, (H / rows) * i, W, Math.ceil(H / rows) + 1);
    }
  }

  _drawStarField(W, H) {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 140; i++) {
      const sx = Phaser.Math.Between(0, W);
      const sy = Phaser.Math.Between(0, H * 0.48);
      g.fillCircle(sx, sy, Math.random() < 0.12 ? 1.6 : 0.65);
    }
    for (let i = 0; i < 14; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H * 0.42),
        Phaser.Math.Between(1, 2), 0xffffff, 0.9
      ).setDepth(1);
      this.tweens.add({
        targets: dot, alpha: { from: 0.9, to: 0.1 },
        duration: Phaser.Math.Between(700, 2200),
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }
    const moon = this.add.graphics().setDepth(1);
    moon.fillStyle(0xdde8f0, 0.92);
    moon.fillCircle(W * 0.72, H * 0.09, 20);
    moon.fillStyle(0x06090f, 1);
    moon.fillCircle(W * 0.72 + 8, H * 0.09 - 5, 16);
  }

  _drawOceanTexture(W, H) {
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(1, 0x00f5d4, 0.05);
    const step = 55;
    for (let x = 0; x < W; x += step)
      for (let y = 0; y < H; y += step)
        g.strokeRect(x, y, step, step);
    g.fillStyle(0x00f5d4, 0.08);
    for (let x = 0; x < W; x += step)
      for (let y = 0; y < H; y += step)
        g.fillCircle(x, y, 1.4);
  }

  _drawAnimatedWaves(W, H) {
    for (let i = 0; i < 7; i++) {
      const wy      = H * (0.32 + i * 0.095);
      const opacity = 0.045 + i * 0.012;
      const wave    = this.add.graphics().setDepth(3);
      let offset    = i * 40;
      const draw = () => {
        if (!this._alive()) return;   // stop redrawing if scene destroyed
        wave.clear();
        wave.lineStyle(1, 0x00f5d4, opacity);
        wave.beginPath();
        wave.moveTo(0, wy);
        for (let x = 0; x <= W; x += 6)
          wave.lineTo(x, wy + Math.sin((x + offset) * 0.025) * (4 + i * 1.5));
        wave.strokePath();
        offset += 0.75;
      };
      this.time.addEvent({ delay: 30, loop: true, callback: draw });
      draw();
    }
  }

  _drawVignette(W, H) {
    const g = this.add.graphics().setDepth(5);
    for (let i = 0; i < 14; i++) {
      g.fillStyle(0x040810, (1 - i / 14) * 0.45);
      g.fillRect(0, i * 5, W, 5);
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle(0x040810, (1 - i / 14) * 0.45);
      g.fillRect(0, H - i * 5 - 5, W, 5);
    }
    for (let i = 0; i < 10; i++) {
      g.fillStyle(0x040810, (1 - i / 10) * 0.28);
      g.fillRect(i * 6, 0, 6, H);
      g.fillRect(W - i * 6 - 6, 0, 6, H);
    }
  }

  _drawCompass(W, H) {
    const cx = W - 48, cy = H - 48;
    const g  = this.add.graphics().setDepth(15);
    g.lineStyle(1, 0x00f5d4, 0.35);
    g.strokeCircle(cx, cy, 30);
    g.fillStyle(0x00f5d4, 0.8);
    g.fillTriangle(cx, cy - 26, cx - 5, cy, cx + 5, cy);
    g.fillStyle(0x223344, 0.8);
    g.fillTriangle(cx, cy + 26, cx - 5, cy, cx + 5, cy);
    g.lineStyle(1, 0x00f5d4, 0.25);
    g.moveTo(cx - 26, cy); g.lineTo(cx + 26, cy); g.strokePath();
    this.add.text(cx, cy - 32, 'N', {
      fontFamily: 'Courier New', fontSize: '9px', color: '#00f5d4', fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(15);
  }

  _drawLeaderboard(W, H) {
    const token = localStorage.getItem('token');
    fetch(
      (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/leaderboard',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .then(r => r.ok ? r.json() : [])
    .catch(() => [])
    .then(data => {
      // Guard: user may have navigated away before fetch completed
      if (!this._alive()) return;

      const players = Array.isArray(data) ? data.slice(0, 5) : [];
      const bw = 168, rowH = 20;
      const totalH = 24 + players.length * rowH + 10;
      const bx = W - bw - 10;
      const by = 62;

      const bg = this.add.graphics().setDepth(14);
      bg.fillStyle(0x010306, 0.97);
      bg.fillRect(bx, by, bw, totalH);
      bg.lineStyle(1, 0x00f5d422, 1);
      bg.strokeRect(bx, by, bw, totalH);
      bg.lineStyle(2, 0x00f5d455, 1);
      bg.moveTo(bx, by); bg.lineTo(bx + bw, by); bg.strokePath();

      this.add.text(bx + bw / 2, by + 7, 'TOP CAPTAINS', {
        fontFamily: 'Courier New', fontSize: '8px', color: '#2a4a5a', letterSpacing: 3,
      }).setOrigin(0.5, 0).setDepth(15);

      if (players.length === 0) {
        this.add.text(bx + bw / 2, by + 26, 'BE FIRST', {
          fontFamily: 'Courier New', fontSize: '9px', color: '#1a3040',
        }).setOrigin(0.5, 0).setDepth(15);
        return;
      }

      const myHandle = (localStorage.getItem('handle') || '').toLowerCase();
      const medals = ['#ffd700', '#b0b8c8', '#cd7f32', '#6a8a9a', '#6a8a9a'];
      const nums   = ['1', '2', '3', '4', '5'];

      players.forEach((p, i) => {
        const ry   = by + 22 + i * rowH;
        const isMe = (p.handle || '').toLowerCase() === myHandle;
        const col  = isMe ? '#ffffff' : medals[i];
        this.add.text(bx + 10, ry, nums[i], {
          fontFamily: 'Courier New', fontSize: '9px', color: medals[i], fontStyle: 'bold',
        }).setOrigin(0, 0).setDepth(15);
        this.add.text(bx + 26, ry, (p.handle || '???').toUpperCase().slice(0, 11), {
          fontFamily: 'Courier New', fontSize: '9px', color: col, fontStyle: isMe ? 'bold' : 'normal',
        }).setOrigin(0, 0).setDepth(15);
        this.add.text(bx + bw - 8, ry, `₦${Number(p.bounty || 0).toLocaleString()}`, {
          fontFamily: 'Courier New', fontSize: '9px', color: '#ffd70077',
        }).setOrigin(1, 0).setDepth(15);
      });
    });
  }

  _scheduleSeaEvent(W, H) {
    this.time.delayedCall(Phaser.Math.Between(18000, 35000), () => {
      if (!this._alive()) return;
      const ev = SEA_EVENTS[Phaser.Math.Between(0, SEA_EVENTS.length - 1)];
      this._showSeaEvent(ev, W, H);
    });
  }

  _showSeaEvent(ev, W, H) {
    if (!this._alive()) return;
    const px = W / 2, py = H / 2;
    const bw = 320, bh = 160;
    const container = this.add.container(px, py + 40).setDepth(50).setAlpha(0);

    const bg = this.add.graphics();
    bg.fillStyle(0x010408, 0.98);
    bg.fillRect(-bw/2, -bh/2, bw, bh);
    bg.lineStyle(2, 0xffd700, 0.7);
    bg.strokeRect(-bw/2, -bh/2, bw, bh);
    bg.lineStyle(2, 0xffd700, 0.9);
    bg.moveTo(-bw/2, -bh/2); bg.lineTo(bw/2, -bh/2); bg.strokePath();

    const iconT  = this.add.text(0, -bh/2 + 16, ev.icon, { fontSize: '22px' }).setOrigin(0.5, 0);
    const titleT = this.add.text(0, -bh/2 + 42, ev.title, {
      fontFamily: 'Courier New', fontSize: '12px', color: '#ffd700', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5, 0);
    const descT  = this.add.text(0, -bh/2 + 62, ev.desc, {
      fontFamily: 'Courier New', fontSize: '10px', color: '#8aaabb',
      align: 'center', wordWrap: { width: bw - 40 },
    }).setOrigin(0.5, 0);
    const riskT  = this.add.text(0, bh/2 - 52, `RISK: ${ev.riskLabel}`, {
      fontFamily: 'Courier New', fontSize: '8px',
      color: ev.risk > 0 ? '#ff4466aa' : '#00f5d4aa', letterSpacing: 2,
    }).setOrigin(0.5, 0.5);

    const mkBtn = (bx, label, fillColor, borderColor, textColor) => {
      const btnBg = this.add.graphics();
      btnBg.fillStyle(fillColor, 0.14);
      btnBg.fillRect(bx - 60, bh/2 - 42, 120, 28);
      btnBg.lineStyle(1, borderColor, 0.7);
      btnBg.strokeRect(bx - 60, bh/2 - 42, 120, 28);
      const btnT = this.add.text(bx, bh/2 - 28, label, {
        fontFamily: 'Courier New', fontSize: '9px', color: textColor, letterSpacing: 2,
      }).setOrigin(0.5, 0.5);
      const zone = this.add.zone(bx, bh/2 - 28, 120, 28).setInteractive({ useHandCursor: true });
      return { btnBg, btnT, zone };
    };

    const accept = mkBtn(-bw/2 + 80, `TAKE IT  +${ev.reward}₦`, 0xffd700, 0xffd700, '#ffd700');
    accept.zone.on('pointerdown', () => {
      const cur = Number(localStorage.getItem('bounty') || 0);
      localStorage.setItem('bounty', Math.max(0, cur + ev.reward - ev.risk));
      this.cameras.main.flash(200, 255, 215, 0, false);
      container.destroy();
      this.game.events.emit('seaEventResult', { gained: ev.reward - ev.risk, event: ev.id });
      this._scheduleSeaEvent(W, H);
    });

    const ignore = mkBtn(bw/2 - 80, 'SAIL PAST', 0xff4466, 0xff4466, '#ff446699');
    ignore.zone.on('pointerdown', () => { container.destroy(); this._scheduleSeaEvent(W, H); });

    container.add([bg, iconT, titleT, descT, riskT,
      accept.btnBg, accept.btnT, accept.zone,
      ignore.btnBg, ignore.btnT, ignore.zone]);

    this.tweens.add({ targets: container, alpha: 1, y: py, duration: 300, ease: 'Back.easeOut' });
  }

  // ─── Island renderer ──────────────────────────────────────────────────────
  _renderIsland(island, W, H) {
    if (!this._alive()) return;   // guard in case called after scene destroyed

    const pad      = 90;
    const x        = pad + (island.positionX / 1000) * (W - pad * 2);
    const y        = pad + (island.positionY / 1000) * (H - pad * 2);
    const color    = TYPE_COLORS[island.type] || 0x00f5d4;
    const r        = 11 + island.difficulty * 2.5;
    const myHandle = (localStorage.getItem('handle') || '').toLowerCase();
    const isOwned  = !!island.ownerId;
    const isMine   = isOwned && (island.ownerHandle || '').toLowerCase() === myHandle;

    const glow = this.add.circle(x, y, r + 14, color, 0.07).setDepth(6);
    this.tweens.add({
      targets: glow, scaleX: 1.7, scaleY: 1.7, alpha: 0,
      duration: 1800 + island.difficulty * 200,
      ease: 'Sine.easeOut', repeat: -1,
      delay: Phaser.Math.Between(0, 1500),
    });
    const midGlow = this.add.circle(x, y, r + 6, color, 0.16).setDepth(7);
    this.tweens.add({
      targets: midGlow, alpha: { from: 0.16, to: 0.04 },
      duration: 1200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      delay: Phaser.Math.Between(0, 800),
    });

    const body = this.add.circle(x, y, r, color, 0.92).setDepth(8).setInteractive({ useHandCursor: true });
    const hl   = this.add.graphics().setDepth(9);
    hl.fillStyle(0xffffff, 0.14);
    hl.fillCircle(x - r * 0.28, y - r * 0.28, r * 0.42);

    const ring = this.add.graphics().setDepth(9);
    ring.lineStyle(1.5, color, 0.9);
    ring.strokeCircle(x, y, r + 1);
    if (island.difficulty >= 4) {
      ring.lineStyle(1, color, 0.3);
      ring.strokeCircle(x, y, r + 5);
    }
    if (isOwned) {
      const ownerRing = this.add.graphics().setDepth(9);
      ownerRing.lineStyle(2, isMine ? 0xffd700 : 0xffffff, 0.55);
      ownerRing.strokeCircle(x, y, r + 3);
    }

    this.add.text(x, y + r + 9, island.name, {
      fontFamily: 'Courier New', fontSize: '11px', fontStyle: 'bold',
      color: isMine ? '#ffd700' : '#ffffff',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0).setDepth(10);

    if (isOwned) {
      const ownerLabel = (island.ownerHandle || '').toUpperCase();
      const tagColor   = isMine ? '#ffd700' : '#e0e8f0';
      const tagBg      = isMine ? 0xffd700 : 0xffffff;
      const tagY       = y - r - 8;
      const pillW      = ownerLabel.length * 6 + 20;
      const pill       = this.add.graphics().setDepth(10);
      pill.fillStyle(tagBg, 0.12);
      pill.fillRoundedRect(x - pillW/2, tagY - 11, pillW, 14, 4);
      pill.lineStyle(1, tagBg, 0.4);
      pill.strokeRoundedRect(x - pillW/2, tagY - 11, pillW, 14, 4);
      this.add.text(x, tagY - 4, ownerLabel, {
        fontFamily: 'Courier New', fontSize: '8px', fontStyle: 'bold',
        color: tagColor, stroke: '#000000', strokeThickness: 2, align: 'center',
      }).setOrigin(0.5, 0.5).setDepth(11);
    }

    body.on('pointerover', () => { body.setScale(1.18); this._showTooltip(island, x, y - r - 8); });
    body.on('pointerout',  () => { body.setScale(1);    this._hideTooltip(); });
    body.on('pointerdown', () => {
      this.cameras.main.shake(120, 0.002);
      this.game.events.emit('islandSelected', island);
    });
  }

  _buildTooltip(W, H) {
    this.tooltipContainer = this.add.container(0, 0).setDepth(20).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x010408, 0.98);
    bg.fillRect(-108, -56, 216, 112);
    bg.lineStyle(1, 0x00f5d4, 0.35);
    bg.strokeRect(-108, -56, 216, 112);
    bg.lineStyle(2, 0x00f5d4, 0.6);
    bg.moveTo(-108, -56); bg.lineTo(108, -56); bg.strokePath();
    this.tooltipL1 = this.add.text(0, -44, '', { fontFamily: 'Courier New', fontSize: '12px', color: '#00f5d4', fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0);
    this.tooltipL2 = this.add.text(0, -24, '', { fontFamily: 'Courier New', fontSize: '10px', color: '#ffd700', align: 'center' }).setOrigin(0.5, 0);
    this.tooltipL3 = this.add.text(0, -6,  '', { fontFamily: 'Courier New', fontSize: '10px', color: '#556677', align: 'center' }).setOrigin(0.5, 0);
    this.tooltipL4 = this.add.text(0,  12, '', { fontFamily: 'Courier New', fontSize: '10px', color: '#aabbcc', align: 'center' }).setOrigin(0.5, 0);
    this.tooltipL5 = this.add.text(0,  30, '', { fontFamily: 'Courier New', fontSize: '9px',  color: '#8899aa', fontStyle: 'italic', align: 'center', wordWrap: { width: 200 } }).setOrigin(0.5, 0);
    this.tooltipContainer.add([bg, this.tooltipL1, this.tooltipL2, this.tooltipL3, this.tooltipL4, this.tooltipL5]);
  }

  _showTooltip(island, x, y) {
    if (!this._alive()) return;
    const stars = '★'.repeat(island.difficulty) + '☆'.repeat(5 - island.difficulty);
    const tc    = { DRIFTER: '#4a9eff', MERCHANT: '#ffd700', WARLORD: '#ff4444', VOID: '#9b59b6' };
    this.tooltipL1.setText(island.name).setColor(tc[island.type] || '#00f5d4');
    this.tooltipL2.setText(`${stars}   ${island.type}`);
    this.tooltipL3.setText(`REWARD  ₦ ${island.bountyReward.toLocaleString()}`);
    this.tooltipL4.setText(island.ownerHandle ? `⚑ ${island.ownerHandle}` : 'UNCLAIMED');
    this.tooltipL5.setText(island.lore || '');
    const tx = Phaser.Math.Clamp(x, 115, this.W - 115);
    const ty = Phaser.Math.Clamp(y, 62, this.H - 130);
    this.tooltipContainer.setPosition(tx, ty).setVisible(true);
  }

  _hideTooltip() {
    if (this.tooltipContainer) this.tooltipContainer.setVisible(false);
  }

  _showError(msg) {
    if (!this._alive()) return;
    this.add.text(this.W / 2, this.H / 2, msg, {
      fontFamily: 'Courier New', fontSize: '14px', color: '#ff4466', align: 'center',
    }).setOrigin(0.5).setDepth(30);
  }
}
