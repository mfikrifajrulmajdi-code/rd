# Deployment Guide — Remote Desktop App

This guide covers deploying the Remote Desktop App to production: the signaling server to the cloud, the Electron desktop host as a distributable installer, and optional TURN server setup for NAT traversal.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [1. Deploy Signaling Server](#1-deploy-signaling-server)
  - [Option A: Railway (Recommended)](#option-a-railway-recommended)
  - [Option B: Render](#option-b-render)
  - [Option C: Self-Hosted (VPS)](#option-c-self-hosted-vps)
- [2. Deploy Web Client](#2-deploy-web-client)
- [3. Build Electron Desktop Installer](#3-build-electron-desktop-installer)
- [4. TURN Server Setup (Optional)](#4-turn-server-setup-optional)
- [5. Environment Variables Reference](#5-environment-variables-reference)
- [6. Post-Deployment Checklist](#6-post-deployment-checklist)

---

## Overview

```
Production Setup
─────────────────────────────────────────────────────────────────
  [Desktop Host]          [Signaling Server]        [Browser]
  Electron .exe    ──►    Railway / Render    ◄──   Any browser
  (Windows only)          (Node.js + Socket.IO)     (Vite build
                                                     on Vercel)
                    ↕ WebRTC P2P (direct, after signaling) ↕
  [Desktop Host]  ◄──────────────────────────────►  [Browser]
─────────────────────────────────────────────────────────────────
```

The signaling server is the only component that needs to be publicly accessible. Once WebRTC negotiation is complete, all media flows peer-to-peer.

---

## Prerequisites

- Node.js ≥ 20 installed locally
- pnpm ≥ 8 installed locally (`npm install -g pnpm`)
- All packages built: `pnpm install && pnpm --filter @remote-app/shared build`

---

## 1. Deploy Signaling Server

### Option A: Railway (Recommended)

Railway offers a free tier with 500 hours/month — sufficient for personal/small-team use.

#### Step 1 — Install Railway CLI

```bash
npm install -g @railway/cli
```

#### Step 2 — Login

```bash
railway login
```

#### Step 3 — Initialize Project

```bash
cd packages/server
railway init
```

When prompted, choose **"Create a new project"** and give it a name (e.g., `remote-desktop-server`).

#### Step 4 — Deploy

```bash
railway up
```

#### Step 5 — Get Your URL

```bash
railway open
```

Copy the generated URL (e.g., `https://remote-desktop-server.up.railway.app`). You'll need this for the web client and Electron app.

#### Step 6 — Set Environment Variables (Optional)

```bash
railway variables set PORT=3000
```

> **Note:** Railway automatically assigns a `PORT` environment variable. The server reads `process.env.PORT` by default.

---

### Option B: Render

Render offers a free tier with automatic sleep after 15 minutes of inactivity.

1. Go to [render.com](https://render.com) and create a new **Web Service**
2. Connect your GitHub repository
3. Configure the service:

| Setting | Value |
|---|---|
| **Build Command** | `pnpm install && pnpm --filter @remote-app/shared build && pnpm --filter @remote-app/server build` |
| **Start Command** | `node packages/server/dist/index.js` |
| **Port** | `3000` |
| **Environment** | `Node` |

4. Click **Deploy**
5. Copy the generated URL from the Render dashboard

---

### Option C: Self-Hosted (VPS)

For a VPS (Ubuntu/Debian):

#### Step 1 — Install Node.js & pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm
```

#### Step 2 — Clone & Build

```bash
git clone <repo-url> /opt/remote-desktop
cd /opt/remote-desktop
pnpm install
pnpm --filter @remote-app/shared build
pnpm --filter @remote-app/server build
```

#### Step 3 — Run with PM2

```bash
npm install -g pm2
pm2 start packages/server/dist/index.js --name remote-desktop-server
pm2 save
pm2 startup
```

#### Step 4 — Configure Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

> **Important:** Socket.IO requires WebSocket upgrade headers (`Upgrade` and `Connection`). Without them, long-polling fallback will be used, which is less efficient.

#### Step 5 — Enable HTTPS (Recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 2. Deploy Web Client

The React web client is a static Vite build — deploy it to any static hosting provider.

### Step 1 — Set Server URL

Create `packages/client/.env.production`:

```env
VITE_SERVER_URL=https://your-server-url.railway.app
```

### Step 2 — Build

```powershell
pnpm --filter @remote-app/client build
# Output: packages/client/dist/
```

### Step 3 — Deploy to Vercel (Recommended)

```bash
npm install -g vercel
cd packages/client
vercel --prod
```

Or drag-and-drop the `packages/client/dist/` folder to [vercel.com](https://vercel.com).

### Alternative: Netlify

```bash
npm install -g netlify-cli
cd packages/client
netlify deploy --prod --dir dist
```

---

## 3. Build Electron Desktop Installer

The Electron app is the desktop host that shares the screen. It must be built on Windows.

### Prerequisites

- Windows 10/11
- Visual Studio Build Tools 2019+ with **"Desktop development with C++"** workload
- Node.js ≥ 20

### Step 1 — Rebuild Native Modules

```powershell
cd packages/desktop
npx @electron/rebuild -f -w @jitsi/robotjs
```

> This step is required every time you update Electron or switch machines.

### Step 2 — Configure Server URL

Edit `packages/desktop/src/main/signaling.ts` (or the relevant config file) to point to your deployed server:

```typescript
const SERVER_URL = process.env.SERVER_URL ?? 'https://your-server-url.railway.app';
```

Or set it via environment variable before building:

```powershell
$env:SERVER_URL = "https://your-server-url.railway.app"
```

### Step 3 — Build

```powershell
cd packages/desktop
pnpm build
```

Output: `packages/desktop/dist/*.exe` (NSIS installer)

### Step 4 — Distribute

Share the generated `.exe` installer with end users. They can install and run it on any Windows 10/11 machine.

---

## 4. TURN Server Setup (Optional)

WebRTC peer-to-peer connections may fail when both peers are behind strict NAT (e.g., corporate firewalls, symmetric NAT). A TURN server relays media in these cases.

> **When do you need this?** If users report that the video stream never connects (ICE negotiation fails), a TURN server is likely needed.

### Install Coturn (Ubuntu/Debian)

```bash
sudo apt install coturn
```

### Configure Coturn

Edit `/etc/turnserver.conf`:

```conf
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=YOUR_PUBLIC_IP
realm=your-domain.com
server-name=your-domain.com
lt-cred-mech
user=remote-app:your-secret-password
log-file=/var/log/turnserver.log
```

### Start Coturn

```bash
sudo systemctl enable coturn
sudo systemctl start coturn
```

### Add TURN Server to App

In `packages/shared/src/constants.ts`, add your TURN server to `ICE_SERVERS`:

```typescript
export const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add your TURN server:
    {
        urls: 'turn:your-domain.com:3478',
        username: 'remote-app',
        credential: 'your-secret-password',
    },
];
```

Then rebuild and redeploy.

---

## 5. Environment Variables Reference

### Server (`packages/server`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP/WebSocket listening port |
| `NODE_ENV` | `development` | Set to `production` for production |

### Web Client (`packages/client`)

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:3000` | Signaling server URL |

### Desktop (`packages/desktop`)

| Variable | Default | Description |
|---|---|---|
| `SERVER_URL` | `http://localhost:3000` | Signaling server URL |
| `ELECTRON_RUN_AS_NODE` | — | Must be **unset** when running Electron |

---

## 6. Post-Deployment Checklist

After deploying, verify the following:

- [ ] **Server health check**: `GET https://your-server-url/` returns `{ "status": "ok" }`
- [ ] **WebSocket connection**: Open browser DevTools → Network → WS tab; confirm Socket.IO handshake succeeds
- [ ] **Session creation**: Launch Electron app; confirm session code appears in UI
- [ ] **Browser join**: Open web client, enter session code; confirm "Connected" state
- [ ] **Video stream**: Confirm desktop video appears in browser
- [ ] **Input control**: Test mouse movement and keyboard input (admin role)
- [ ] **Session expiry**: Wait 10 minutes; confirm both sides disconnect gracefully
- [ ] **HTTPS**: Confirm web client is served over HTTPS (required for WebRTC in production)

> **Important:** Browsers require HTTPS for `getUserMedia` and WebRTC APIs in production. Ensure your web client is served over HTTPS, not plain HTTP.
