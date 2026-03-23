import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function CombatPage() {
  const { islandId } = useParams();
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Courier New', Courier, monospace",
        color: '#e0e0e0',
      }}
    >
      <h1 style={{ color: '#ff4466', fontSize: '2rem', letterSpacing: '0.3em', marginBottom: '1rem' }}>
        COMBAT
      </h1>
      <p style={{ color: '#8899aa', marginBottom: '0.5rem' }}>
        Island: <span style={{ color: '#00f5d4' }}>{islandId}</span>
      </p>
      <p style={{ color: '#445566', fontSize: '0.9rem', marginBottom: '2.5rem', letterSpacing: '0.1em' }}>
        Combat engine loads here — choose your approach.
      </p>
      <div
        style={{
          width: '700px',
          height: '400px',
          border: '1px solid #ff446622',
          background: '#0a0005',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2a0a10',
          fontSize: '0.85rem',
          letterSpacing: '0.15em',
        }}
      >
        [ COMBAT CANVAS PLACEHOLDER ]
      </div>
      <button
        onClick={() => navigate('/world')}
        style={{
          marginTop: '2rem',
          background: 'transparent',
          border: '1px solid #00f5d444',
          color: '#00f5d4',
          padding: '0.5rem 1.5rem',
          fontFamily: "'Courier New', Courier, monospace",
          cursor: 'pointer',
          fontSize: '0.85rem',
          letterSpacing: '0.1em',
        }}
      >
        ← BACK TO MAP
      </button>
    </div>
  );
}
