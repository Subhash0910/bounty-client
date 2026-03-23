import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function WorldMapPage() {
  const handle = localStorage.getItem('handle') || 'Drifter';
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('handle');
    navigate('/');
  };

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
      <h1 style={{ color: '#00f5d4', fontSize: '2rem', letterSpacing: '0.3em', marginBottom: '1rem' }}>
        WORLD MAP
      </h1>
      <p style={{ color: '#8899aa', marginBottom: '0.5rem' }}>Welcome back, <span style={{ color: '#00f5d4' }}>{handle}</span></p>
      <p style={{ color: '#445566', fontSize: '0.9rem', marginBottom: '2.5rem', letterSpacing: '0.1em' }}>
        Phaser scene loads here — islands incoming.
      </p>
      <div
        id="phaser-container"
        style={{
          width: '900px',
          height: '500px',
          border: '1px solid #00f5d422',
          background: '#06060e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1a3a3a',
          fontSize: '0.85rem',
          letterSpacing: '0.15em',
        }}
      >
        [ PHASER CANVAS PLACEHOLDER ]
      </div>
      <button
        onClick={handleLogout}
        style={{
          marginTop: '2rem',
          background: 'transparent',
          border: '1px solid #ff446644',
          color: '#ff4466',
          padding: '0.5rem 1.5rem',
          fontFamily: "'Courier New', Courier, monospace",
          cursor: 'pointer',
          fontSize: '0.85rem',
          letterSpacing: '0.1em',
        }}
      >
        LOGOUT
      </button>
    </div>
  );
}
