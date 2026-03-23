import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api.js';

const S = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Courier New', Courier, monospace",
  },
  card: {
    background: '#0f0f1a',
    border: '1px solid #00f5d422',
    padding: '2.5rem 3rem',
    width: '360px',
  },
  title: {
    color: '#00f5d4',
    fontSize: '1.6rem',
    fontWeight: '700',
    letterSpacing: '0.2em',
    marginBottom: '2rem',
    textAlign: 'center',
  },
  label: { color: '#8899aa', fontSize: '0.8rem', letterSpacing: '0.1em', display: 'block', marginBottom: '0.35rem' },
  input: {
    width: '100%',
    background: '#16161f',
    border: '1px solid #00f5d433',
    color: '#e0e0e0',
    padding: '0.65rem 0.9rem',
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '0.95rem',
    marginBottom: '1.2rem',
    outline: 'none',
  },
  btn: {
    width: '100%',
    background: '#00f5d4',
    color: '#0a0a0f',
    border: 'none',
    padding: '0.8rem',
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: '700',
    fontSize: '1rem',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  error: { color: '#ff4466', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' },
  link: { color: '#00f5d4', display: 'block', textAlign: 'center', marginTop: '1.2rem', fontSize: '0.85rem' },
};

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('handle', res.data.handle);
      navigate('/world');
    } catch (err) {
      setError(err.response?.data || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h2 style={S.title}>LOGIN</h2>
        {error && <p style={S.error}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <label style={S.label}>EMAIL</label>
          <input style={S.input} type="email" name="email" value={form.email} onChange={handleChange} required />
          <label style={S.label}>PASSWORD</label>
          <input style={S.input} type="password" name="password" value={form.password} onChange={handleChange} required />
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? 'SAILING IN...' : 'ENTER'}
          </button>
        </form>
        <Link to="/register" style={S.link}>No account? Register here</Link>
      </div>
    </div>
  );
}
