# 🏴 BOUNTY — Frontend

> **The browser game client for BOUNTY** — a real-time pirate bounty game where you sail, fight, and conquer islands.
> Built with React, Vite, and Phaser 3.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![Phaser](https://img.shields.io/badge/Phaser-3.80-8C1CE8?style=flat-square)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel)

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + React Router v6 |
| Build Tool | Vite 5 |
| Game Engine | Phaser 3.80 |
| HTTP Client | Axios (JWT interceptor auto-attached) |
| Auth | JWT stored in `localStorage`, `ProtectedRoute` wrapper |
| Styling | Inline styles, dark `#0a0a0f` theme, neon teal `#00f5d4` |
| Deploy | Vercel (via GitHub Actions) |

---

## 🚀 Local Setup

```bash
# 1. Clone
git clone https://github.com/Subhash0910/bounty-client.git
cd bounty-client

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Set VITE_API_URL to your backend URL:
# VITE_API_URL=http://localhost:8080

# 4. Start dev server
npm run dev
# → http://localhost:3000
```

> Make sure [bounty-server](https://github.com/Subhash0910/bounty-server) is running first (`docker compose up --build`).

---

## 🎨 Pages & Routes

| Route | Page | Auth |
|---|---|---|
| `/` | `LandingPage` | ❌ Open |
| `/login` | `LoginPage` | ❌ Open |
| `/register` | `RegisterPage` | ❌ Open |
| `/world` | `WorldMapPage` (Phaser ocean map) | ✅ JWT |
| `/combat/:islandId` | `CombatPage` (Phaser turn-based combat) | ✅ JWT |

---

## 🗺️ Game Screens

### World Map
- Full-screen Phaser 3 canvas with animated ocean waves
- 10 islands rendered as color-coded circles (DRIFTER / MERCHANT / WARLORD / VOID)
- Hover tooltip: island name, difficulty stars, bounty reward, owner
- Click → React overlay panel with **Set Sail** button

### Combat
- Two animated ships (player vs enemy) on a dark ocean arena
- Smooth health bar tweens on damage
- Scrolling combat log (last 3 actions)
- Three approaches: **⚔️ ATTACK** / **👁️ INTIMIDATE** / **🤝 NEGOTIATE**
- Victory: gold particle burst + **Wanted Poster** card with share button
- Defeat: red flash + Try Again / Back to Ocean

---

## 📦 Project Structure

```
src/
├── main.jsx                  # React root, BrowserRouter
├── App.jsx                   # Routes + ProtectedRoute
├── services/
│   └── api.js                  # Axios instance + JWT interceptor
├── scenes/
│   ├── WorldMapScene.js        # Phaser 3 — ocean map, islands, tooltips
│   └── CombatScene.js          # Phaser 3 — ships, health bars, FX
├── pages/
│   ├── LandingPage.jsx
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── WorldMapPage.jsx        # Mounts Phaser + island overlay panel
│   └── CombatPage.jsx          # Mounts Phaser + action buttons + overlays
└── components/
    └── WantedPoster.jsx        # Victory poster with Web Share API
```

---

## 🔗 Backend

API server lives in **[bounty-server](https://github.com/Subhash0910/bounty-server)** — Spring Boot + PostgreSQL + Redis.

---

## 🚀 Production Deploy (Vercel)

Set the following secrets in your GitHub repository settings:

| Secret | Value |
|---|---|
| `VERCEL_TOKEN` | Your Vercel personal access token |
| `VERCEL_ORG_ID` | From `vercel whoami` or Vercel dashboard |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |
| `VITE_API_URL` | Your production backend URL |

Every push to `main` triggers an automatic Vercel production deploy.
