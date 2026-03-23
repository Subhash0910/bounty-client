import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import WorldMapPage from './pages/WorldMapPage.jsx';
import CombatPage from './pages/CombatPage.jsx';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/world"
        element={
          <ProtectedRoute>
            <WorldMapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/combat/:islandId"
        element={
          <ProtectedRoute>
            <CombatPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
