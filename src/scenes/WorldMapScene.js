import Phaser from 'phaser';

const TYPE_COLORS = {
  DRIFTER:  0x4a9eff,
  MERCHANT: 0xffd700,
  WARLORD:  0xff4444,
  VOID:     0x9b59b6,
};

const RANK_TIERS = [
  { min: 0,     label: 'CABIN BOY',    color: '#6a8a9a' },
  { min: 500,   label: 'DECKHAND',     color: '#4a9eff' },
  { min: 2000,  label: 'BUCCANEER',    color: '#00f5d4' },
  { min: 5000,  label: 'CORSAIR',      color: '#ffd700' },
  { min: 12000, label: 'WARLORD',      color: '#ff8800' },
  { min: 25000, label: 'DREAD PIRATE', color: '#ff4466' },
];

function getRank(bounty) {
  let rank = RANK_TIERS[0];
  for (const t of RANK_TIERS) { if (bounty >= t.min) rank = t; }
  return rank;
}

const SEA_EVENTS = [
  { id: 'merchant', icon: '🚢', title: 'MERCHANT VESSEL', desc: 'A fat merchant ship wallows nearby. Board her?', reward: 350, risk: 18, riskLabel: '−18 HP' },
  { id: 'wreck',    icon: '⚓', title: 'SUNKEN WRECK',    desc: 'A wreck bleeds gold into the tide. Dive for it?', reward: 200, risk: 0,  riskLabel: 'SAFE'   },
  { id: 'storm',    icon: '🌊', title: 'STORM SURGE',     desc: 'A rogue wave batters your hull. Brace or outrun?', reward: 0, risk: 25, riskLabel: '−25 HP OR SAFE'  },
  { id: 'duel',     icon: '⚔️', title: 'RIVAL CAPTAIN',   desc: 'A rival captain challenges you on the open sea.', reward: 500, risk: 30, riskLabel: '−30 HP' },
  { id: 'cache',    icon: '💰', title: 'BURIED CACHE',    desc: 'A half-buried chest winks from a sandbar.', reward: 150, risk: 0, riskLabel: 'SAFE' },
];

export default class WorldMapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldMapScene' });
    this.islands    = [];
    this.playerData = { handle: '', bounty: 0 };
    this._seaEventTimeout = null;
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

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/world/map',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('map fetch failed');
      this.islands = await res.json();
    } catch (e) {
      this._showError('Could not load world map.');
      return;
    }

    this.islands.forEach(island => this._renderIsland(island, W, H));
    this._buildTooltip(W, H);
    this._drawCompass(W, H);
    this._drawLeaderboard(W, H);
    this._scheduleSeaEvent(W, H);
  }

  _drawOceanBackground(W, H) {
    const g = this.add.graphics().setDepth(0);
    // Solid crisp gradient — no transparency
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
      const sr = Math.random() < 0.12 ? 1.6 : 0.65;
      g.fillCircle(sx, sy, sr);
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
    // Moon
    const moon = this.add.graphics().setDepth(1);
    moon.fillStyle(0xdde8f0, 0.92);
    moon.fillCircle(W * 0.88, H * 0.10, 20);
    moon.fillStyle(0x06090f, 1);
    moon.fillCircle(W * 0.88 + 8, H * 0.10 - 5, 16);
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

  // ─── Leaderboard (top-right, below React HUD) ───────────────────────────
  _drawLeaderboard(W, H) {
    // Fetch top players
    const token = localStorage.getItem('token');
    fetch(
      (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/leaderboard',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .then(r => r.ok ? r.json() : [])
    .catch(() => [])
    .then(data => {
      const players = Array.isArray(data) ? data.slice(0, 5) : [];
      const bx = W - 178, by = 66;
      const bw = 162, rowH = 22;
      const totalH = 28 + players.length * rowH + 8;

      const bg = this.add.graphics().setDepth(14);
      bg.fillStyle(0x020508, 0.96);
      bg.fillRect(bx, by, bw, totalH);
      bg.lineStyle(1, 0x00f5d422, 1);
      bg.strokeRect(bx, by, bw, totalH);
      // Top accent
      bg.lineStyle(2, 0x00f5d488, 1);
      bg.moveTo(bx, by); bg.lineTo(bx + bw, by); bg.strokePath();

      this.add.text(bx + bw / 2, by + 8, 'TOP CAPTAINS', {
        fontFamily: 'Courier New', fontSize: '8px', color: '#2a5060', letterSpacing: 3,
      }).setOrigin(0.5, 0).setDepth(15);

      if (players.length === 0) {
        this.add.text(bx + bw / 2, by + 28, 'NO DATA', {
          fontFamily: 'Courier New', fontSize: '9px', color: '#1a3040',
        }).setOrigin(0.5, 0).setDepth(15);
        return;
      }

      const myHandle = (localStorage.getItem('handle') || '').toLowerCase();
      players.forEach((p, i) => {
        const ry     = by + 26 + i * rowH;
        const isMe   = (p.handle || '').toLowerCase() === myHandle;
        const medals = ['🥇','🥈','🥉','④','⑤'];
        const col    = isMe ? '#ffd700' : i === 0 ? '#ffd700' : '#6a8a9a';

        this.add.text(bx + 8, ry, medals[i] || `${i+1}.`, {
          fontFamily: 'Courier New', fontSize: '9px', color: col,
        }).setOrigin(0, 0).setDepth(15);

        const nameText = (p.handle || '???').toUpperCase().slice(0, 10);
        this.add.text(bx + 28, ry, nameText, {
          fontFamily: 'Courier New', fontSize: '9px',
          color: isMe ? '#ffffff' : col, fontStyle: isMe ? 'bold' : 'normal',
        }).setOrigin(0, 0).setDepth(15);

        this.add.text(bx + bw - 8, ry, `₦${Number(p.bounty || 0).toLocaleString()}`, {
          fontFamily: 'Courier New', fontSize: '9px', color: '#ffd70099',
        }).setOrigin(1, 0).setDepth(15);
      });
    });
  }

  // ─── Sea Event popup ────────────────────────────────────────────────────
  _scheduleSeaEvent(W, H) {
    const delay = Phaser.Math.Between(18000, 35000);
    this._seaEventTimeout = this.time.delayedCall(delay, () => {
      const ev = SEA_EVENTS[Phaser.Math.Between(0, SEA_EVENTS.length - 1)];
      this._showSeaEvent(ev, W, H);
    });
  }

  _showSeaEvent(ev, W, H) {
    const px = W / 2, py = H / 2;
    const bw = 320, bh = 160;

    const container = this.add.container(px, py).setDepth(50);

    const bg = this.add.graphics();
    bg.fillStyle(0x010408, 0.98);
    bg.fillRect(-bw/2, -bh/2, bw, bh);
    bg.lineStyle(2, 0xffd700, 0.7);
    bg.strokeRect(-bw/2, -bh/2, bw, bh);
    bg.lineStyle(2, 0xffd700, 0.9);
    bg.moveTo(-bw/2, -bh/2); bg.lineTo(bw/2, -bh/2); bg.strokePath();

    const iconT  = this.add.text(0, -bh/2 + 18, ev.icon, { fontSize: '22px' }).setOrigin(0.5, 0);
    const titleT = this.add.text(0, -bh/2 + 44, ev.title, {
      fontFamily: 'Courier New', fontSize: '12px', color: '#ffd700', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5, 0);
    const descT = this.add.text(0, -bh/2 + 64, ev.desc, {
      fontFamily: 'Courier New', fontSize: '10px', color: '#8aaabb',
      align: 'center', wordWrap: { width: bw - 40 },
    }).setOrigin(0.5, 0);

    // Accept button
    const acceptBg = this.add.graphics();
    acceptBg.fillStyle(0xffd700, 0.12);
    acceptBg.fillRect(-bw/2 + 20, bh/2 - 42, 120, 28);
    acceptBg.lineStyle(1, 0xffd700, 0.7);
    acceptBg.strokeRect(-bw/2 + 20, bh/2 - 42, 120, 28);
    const acceptT = this.add.text(-bw/2 + 80, bh/2 - 28, `TAKE IT  +${ev.reward}₦`, {
      fontFamily: 'Courier New', fontSize: '9px', color: '#ffd700', letterSpacing: 2,
    }).setOrigin(0.5, 0.5);
    const acceptZone = this.add.zone(-bw/2 + 80, bh/2 - 28, 120, 28).setInteractive({ useHandCursor: true });
    acceptZone.on('pointerdown', () => {
      const cur = Number(localStorage.getItem('bounty') || 0);
      const gained = ev.reward - ev.risk;
      localStorage.setItem('bounty', Math.max(0, cur + gained));
      this.cameras.main.flash(200, 255, 215, 0, false);
      container.destroy();
      this.game.events.emit('seaEventResult', { gained, event: ev.id });
      this._scheduleSeaEvent(W, H);
    });

    // Ignore button
    const ignoreBg = this.add.graphics();
    ignoreBg.fillStyle(0xff4466, 0.08);
    ignoreBg.fillRect(bw/2 - 140, bh/2 - 42, 120, 28);
    ignoreBg.lineStyle(1, 0xff446655, 1);
    ignoreBg.strokeRect(bw/2 - 140, bh/2 - 42, 120, 28);
    const ignoreT = this.add.text(bw/2 - 80, bh/2 - 28, 'SAIL PAST', {
      fontFamily: 'Courier New', fontSize: '9px', color: '#ff446699', letterSpacing: 2,
    }).setOrigin(0.5, 0.5);
    const ignoreZone = this.add.zone(bw/2 - 80, bh/2 - 28, 120, 28).setInteractive({ useHandCursor: true });
    ignoreZone.on('pointerdown', () => {
      container.destroy();
      this._scheduleSeaEvent(W, H);
    });

    // Risk label
    const riskT = this.add.text(0, bh/2 - 52, `RISK: ${ev.riskLabel}`, {
      fontFamily: 'Courier New', fontSize: '8px', color: ev.risk > 0 ? '#ff4466aa' : '#00f5d4aa', letterSpacing: 2,
    }).setOrigin(0.5, 0.5);

    container.add([bg, iconT, titleT, descT, acceptBg, acceptT, acceptZone, ignoreBg, ignoreT, ignoreZone, riskT]);

    // Slide in
    container.setAlpha(0);
    container.y = py + 40;
    this.tweens.add({
      targets: container, alpha: 1, y: py,
      duration: 300, ease: 'Back.easeOut',
    });
  }

  _renderIsland(island, W, H) {
    const pad   = 90;
    const x     = pad + (island.positionX / 1000) * (W - pad * 2);
    const y     = pad + (island.positionY / 1000) * (H - pad * 2);
    const color = TYPE_COLORS[island.type] || 0x00f5d4;
    const r     = 11 + island.difficulty * 2.5;
    const myHandle = (localStorage.getItem('handle') || '').toLowerCase();
    const isOwned  = !!island.ownerId;
    const isMine   = isOwned && (island.ownerHandle || '').toLowerCase() === myHandle;

    // Outer glow pulse
    const glow = this.add.circle(x, y, r + 14, color, 0.07).setDepth(6);
    this.tweens.add({
      targets: glow, scaleX: 1.7, scaleY: 1.7, alpha: 0,
      duration: 1800 + island.difficulty * 200,
      ease: 'Sine.easeOut', repeat: -1,
      delay: Phaser.Math.Between(0, 1500),
    });

    // Mid glow
    const midGlow = this.add.circle(x, y, r + 6, color, 0.16).setDepth(7);
    this.tweens.add({
      targets: midGlow, alpha: { from: 0.16, to: 0.04 },
      duration: 1200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      delay: Phaser.Math.Between(0, 800),
    });

    // Island body
    const body = this.add.circle(x, y, r, color, 0.92).setDepth(8).setInteractive({ useHandCursor: true });

    // Inner highlight
    const hl = this.add.graphics().setDepth(9);
    hl.fillStyle(0xffffff, 0.14);
    hl.fillCircle(x - r * 0.28, y - r * 0.28, r * 0.42);

    // Ring
    const ring = this.add.graphics().setDepth(9);
    ring.lineStyle(1.5, color, 0.9);
    ring.strokeCircle(x, y, r + 1);
    if (island.difficulty >= 4) {
      ring.lineStyle(1, color, 0.3);
      ring.strokeCircle(x, y, r + 5);
    }

    // Ownership ring — gold if mine, white if someone else's
    if (isOwned) {
      const ownerRing = this.add.graphics().setDepth(9);
      const ownerColor = isMine ? 0xffd700 : 0xffffff;
      ownerRing.lineStyle(2, ownerColor, 0.6);
      ownerRing.strokeCircle(x, y, r + 3);
    }

    // Island name
    this.add.text(x, y + r + 8, island.name, {
      fontFamily: 'Courier New', fontSize: '10px',
      color: isMine ? '#ffd700' : '#c0d0e0', align: 'center',
    }).setOrigin(0.5, 0).setDepth(10);

    // Flag
    if (isOwned) {
      const flagColor = isMine ? '#ffd700' : '#ffffff';
      const flagEmoji = isMine ? '🏴‍☠️' : '🚩';
      this.add.text(x + r - 2, y - r - 14, flagEmoji, {
        fontSize: '13px',
      }).setOrigin(0, 1).setDepth(11);
      // Owner label
      this.add.text(x, y - r - 16, island.ownerHandle || '', {
        fontFamily: 'Courier New', fontSize: '8px', color: flagColor,
      }).setOrigin(0.5, 1).setDepth(11);
    }

    // Hover / click
    body.on('pointerover', () => {
      body.setScale(1.18);
      this._showTooltip(island, x, y - r - 8);
    });
    body.on('pointerout', () => {
      body.setScale(1);
      this._hideTooltip();
    });
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
    this.tooltipL4 = this.add.text(0, 12,  '', { fontFamily: 'Courier New', fontSize: '10px', color: '#aabbcc', align: 'center' }).setOrigin(0.5, 0);
    this.tooltipL5 = this.add.text(0, 30,  '', { fontFamily: 'Courier New', fontSize: '9px',  color: '#8899aa', fontStyle: 'italic', align: 'center', wordWrap: { width: 200 } }).setOrigin(0.5, 0);
    this.tooltipContainer.add([bg, this.tooltipL1, this.tooltipL2, this.tooltipL3, this.tooltipL4, this.tooltipL5]);
  }

  _showTooltip(island, x, y) {
    const stars = '★'.repeat(island.difficulty) + '☆'.repeat(5 - island.difficulty);
    const tc    = { DRIFTER: '#4a9eff', MERCHANT: '#ffd700', WARLORD: '#ff4444', VOID: '#9b59b6' };
    this.tooltipL1.setText(island.name).setColor(tc[island.type] || '#00f5d4');
    this.tooltipL2.setText(`${stars}   ${island.type}`);
    this.tooltipL3.setText(`REWARD  ₦ ${island.bountyReward.toLocaleString()}`);
    this.tooltipL4.setText(island.ownerHandle ? `⚑ ${island.ownerHandle}` : 'UNCLAIMED');
    this.tooltipL5.setText(island.lore || '');
    const tx = Phaser.Math.Clamp(x, 115, this.W - 115);
    const ty = Phaser.Math.Clamp(y, 60, this.H - 130);
    this.tooltipContainer.setPosition(tx, ty).setVisible(true);
  }

  _hideTooltip() { this.tooltipContainer.setVisible(false); }

  _showError(msg) {
    this.add.text(this.W / 2, this.H / 2, msg, {
      fontFamily: 'Courier New', fontSize: '14px', color: '#ff4466', align: 'center',
    }).setOrigin(0.5).setDepth(30);
  }
}
