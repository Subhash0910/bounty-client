import React from 'react';
import { useNavigate } from 'react-router-dom';

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0f',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Courier New', Courier, monospace",
    color: '#e0e0e0',
    userSelect: 'none',
  },
  title: {
    fontSize: '6rem',
    fontWeight: '900',
    letterSpacing: '0.3em',
    color: '#00f5d4',
    textShadow: '0 0 40px #00f5d4aa, 0 0 80px #00f5d455',
    marginBottom: '1rem',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#8899aa',
    letterSpacing: '0.15em',
    marginBottom: '3.5rem',
    textAlign: 'center',
  },
  btnRow: {
    display: 'flex',
    gap: '1.5rem',
  },
  btnPrimary: {
    padding: '0.85rem 2.4rem',
    background: '#00f5d4',
    color: '#0a0a0f',
    border: 'none',
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: '700',
    fontSize: '1rem',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
    boxShadow: '0 0 18px #00f5d488',
  },
  btnSecondary: {
    padding: '0.85rem 2.4rem',
    background: 'transparent',
    color: '#00f5d4',
    border: '1px solid #00f5d4',
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: '700',
    fontSize: '1rem',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
  },
  divider: {
    width: '120px',
    height: '1px',
    background: '#00f5d433',
    margin: '2.5rem 0',
  },
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>BOUNTY</h1>
      <p style={styles.subtitle}>
        Sail. Fight. Earn your bounty.<br />
        The ocean remembers.
      </p>
      <div style={styles.divider} />
      <div style={styles.btnRow}>
        <button
          style={styles.btnPrimary}
          onClick={() => navigate('/register')}
          onMouseEnter={e => (e.target.style.boxShadow = '0 0 32px #00f5d4cc')}
          onMouseLeave={e => (e.target.style.boxShadow = '0 0 18px #00f5d488')}
        >
          Enter the Ocean
        </button>
        <button
          style={styles.btnSecondary}
          onClick={() => navigate('/login')}
          onMouseEnter={e => (e.target.style.boxShadow = '0 0 18px #00f5d444')}
          onMouseLeave={e => (e.target.style.boxShadow = 'none')}
        >
          Login
        </button>
      </div>
    </div>
  );
}
