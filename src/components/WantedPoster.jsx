import React from 'react';

const S = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  poster: {
    width: '280px',
    background: '#0b0e14',
    border: '2px solid #00f5d4',
    boxShadow: '0 0 30px #00f5d433, inset 0 0 60px #00000088',
    padding: '1.5rem 1.8rem',
    fontFamily: "'Courier New', Courier, monospace",
    color: '#c8d8c8',
    textAlign: 'center',
    position: 'relative',
  },
  cornerTL: { position: 'absolute', top: '6px',  left:  '6px',  color: '#00f5d455', fontSize: '10px' },
  cornerTR: { position: 'absolute', top: '6px',  right: '6px',  color: '#00f5d455', fontSize: '10px' },
  cornerBL: { position: 'absolute', bottom: '6px', left: '6px', color: '#00f5d455', fontSize: '10px' },
  cornerBR: { position: 'absolute', bottom: '6px', right: '6px',color: '#00f5d455', fontSize: '10px' },
  wanted: {
    fontSize: '0.65rem',
    letterSpacing: '0.4em',
    color: '#8899aa',
    marginBottom: '0.2rem',
  },
  dead: {
    fontSize: '0.55rem',
    letterSpacing: '0.3em',
    color: '#ff446688',
    marginBottom: '0.8rem',
  },
  silhouette: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, #0f2020 60%, #00f5d411 100%)',
    border: '1px solid #00f5d433',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem',
    fontSize: '2.2rem',
  },
  handle: {
    fontSize: '1.4rem',
    fontWeight: '900',
    letterSpacing: '0.15em',
    color: '#00f5d4',
    textShadow: '0 0 12px #00f5d466',
    marginBottom: '0.2rem',
  },
  tier: {
    fontSize: '0.7rem',
    letterSpacing: '0.2em',
    color: '#8899aa',
    marginBottom: '1rem',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(to right, transparent, #00f5d444, transparent)',
    margin: '0.75rem 0',
  },
  bountyLabel: {
    fontSize: '0.6rem',
    letterSpacing: '0.3em',
    color: '#8899aa',
    marginBottom: '0.2rem',
  },
  bountyValue: {
    fontSize: '1.8rem',
    fontWeight: '900',
    color: '#ffd700',
    textShadow: '0 0 16px #ffd70066',
    letterSpacing: '0.05em',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '1rem',
    fontSize: '0.7rem',
  },
  statBox: {
    flex: 1,
    padding: '0.4rem 0',
    border: '1px solid #00f5d422',
  },
  statVal: { color: '#00f5d4', fontWeight: '700', fontSize: '1rem' },
  statLbl: { color: '#556677', fontSize: '0.6rem', letterSpacing: '0.1em' },
  shareBtn: {
    marginTop: '1rem',
    width: '100%',
    background: 'transparent',
    border: '1px solid #00f5d444',
    color: '#00f5d4',
    padding: '0.5rem',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.8rem',
    letterSpacing: '0.15em',
    cursor: 'pointer',
  },
};

export default function WantedPoster({ player }) {
  const {
    handle = '???',
    bounty = 0,
    tier = 'Drifter',
    islandsConquered = 0,
    seasonRank = null,
  } = player || {};

  const handleShare = async () => {
    const text = `🏴 WANTED: ${handle} | BOUNTY: ${Number(bounty).toLocaleString()} | TIER: ${tier} | ${islandsConquered} islands conquered | #BountyGame`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BOUNTY — Wanted Poster', text });
      } catch (_) {}
    } else {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    }
  };

  return (
    <div style={S.wrapper}>
      <div style={S.poster}>
        <span style={S.cornerTL}>+</span>
        <span style={S.cornerTR}>+</span>
        <span style={S.cornerBL}>+</span>
        <span style={S.cornerBR}>+</span>

        <p style={S.wanted}>WANTED</p>
        <p style={S.dead}>DEAD OR ALIVE</p>

        <div style={S.silhouette}>🏴</div>

        <h2 style={S.handle}>{handle}</h2>
        <p style={S.tier}>{tier.toUpperCase()}</p>

        <div style={S.divider} />

        <p style={S.bountyLabel}>BOUNTY</p>
        <p style={S.bountyValue}>{Number(bounty).toLocaleString()}</p>

        <div style={S.divider} />

        <div style={S.statsRow}>
          <div style={S.statBox}>
            <div style={S.statVal}>{islandsConquered}</div>
            <div style={S.statLbl}>ISLANDS</div>
          </div>
          <div style={{ ...S.statBox, borderLeft: 'none' }}>
            <div style={S.statVal}>{seasonRank ? `#${seasonRank}` : '—'}</div>
            <div style={S.statLbl}>RANK</div>
          </div>
        </div>
      </div>

      <button style={S.shareBtn} onClick={handleShare}>
        📎 SHARE YOUR WANTED POSTER
      </button>
    </div>
  );
}
