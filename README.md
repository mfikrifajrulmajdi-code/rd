# Remote Desktop App

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green?logo=node.js)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8-orange?logo=pnpm)](https://pnpm.io)
[![Electron](https://img.shields.io/badge/Electron-latest-blue?logo=electron)](https://www.electronjs.org)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P-red?logo=webrtc)](https://webrtc.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

A **WebRTC-based remote desktop application** that lets you share your Windows desktop to any browser — over LAN or the internet. Built as a TypeScript monorepo with pnpm workspaces.

---

## 🌐 Production

| Service | URL |
|---------|-----|
| **Web Client** | [rd-client-one.vercel.app](https://rd-client-one.vercel.app) |
| **Signaling Server** | [kodokremote.zeabur.app](https://kodokremote.zeabur.app) |

---

## ✨ Features

- 🖥️ **Screen sharing** — Capture and stream your desktop at 720p/30fps via WebRTC
- 🖱️ **Remote input control** — Admin clients can control mouse and keyboard on the host
- 🔗 **Session codes** — Simple `ABC-DEF-GHI` format codes to connect (no accounts needed)
- 👥 **Multi-role** — Supports `host`, `admin` (control), and `viewer` (watch-only) roles
- ⚡ **Low latency** — Peer-to-peer WebRTC connection, server only used for signaling
- 🌐 **Browser client** — No install required for viewers/admins — just open a URL

---

## 📋 Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | ≥ 20 | Required for all packages |
| [pnpm](https://pnpm.io) | ≥ 8 | `npm install -g pnpm` |
| Windows 10/11 | — | Required for Electron desktop host |
| [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) | 2019+ | Required for `@jitsi/robotjs` (input control) |

---

## 🚀 Quick Start

### 1. Clone & Install

```powershell
git clone <repo-url>
cd "remote dekstop"
pnpm install
```

### 2. Build Shared Package

```powershell
pnpm --filter @remote-app/shared build
```

### 3. Run All Services

```powershell
# Clear conflicting env var first (important for Electron)
$env:ELECTRON_RUN_AS_NODE=$null

pnpm dev:all
```

This starts three services concurrently:
- **Server** — Signaling server on `http://localhost:3000`
- **Desktop** — Electron host app (opens automatically)
- **Client** — React web client on `http://localhost:5173`

---

## 📦 Project Structure

```
remote dekstop/
├── packages/
│   ├── shared/          ← @remote-app/shared — Types, constants, utils
│   ├── server/          ← @remote-app/server — Socket.IO signaling server
│   ├── desktop/         ← @remote-app/desktop — Electron host application
│   └── client/          ← @remote-app/client — React web client (Vite)
├── .agent/              ← Agent handoff documentation
├── package.json         ← Root workspace config
├── pnpm-workspace.yaml  ← pnpm workspace definition
└── test-integration.mjs ← Integration test suite
```

---

## 🛠️ Available Scripts

| Script | Description |
|---|---|
| `pnpm dev:all` | Start server + desktop + client simultaneously |
| `pnpm dev:server` | Start signaling server only |
| `pnpm dev:desktop` | Start Electron desktop host only |
| `pnpm dev:client` | Start React web client only |
| `pnpm build` | Build all packages |
| `pnpm build:shared` | Build shared package only |
| `pnpm clean` | Remove all `dist/` and `node_modules/` |

---

## 🎮 How to Use

### As a Host (Desktop)

1. Launch the Electron desktop app (`pnpm dev:desktop`)
2. The app will display a **session code** (e.g., `ABC-DEF-GHI`)
3. Share this code with anyone you want to give access to

### As a Viewer / Admin (Browser)

1. Open the web client at `http://localhost:5173` (or the deployed URL)
2. Enter the session code provided by the host
3. Choose your role:
   - **Admin** — Full mouse and keyboard control
   - **Viewer** — Watch-only mode

---

## ⚠️ Known Limitations

### Input Control (robotjs)

Input control requires rebuilding the native `@jitsi/robotjs` module for your Electron version:

```powershell
cd packages/desktop
npx @electron/rebuild -f -w @jitsi/robotjs
```

> **Requires:** Visual Studio Build Tools 2019+ with "Desktop development with C++" workload.

### Other Limitations

| Limitation | Details |
|---|---|
| **LAN only by default** | The signaling server must be deployed to the cloud for internet access |
| **No authentication** | Session codes only — no password or PIN protection |
| **No TURN server** | WebRTC may fail behind strict NAT/firewalls |
| **Windows host only** | The Electron desktop host only runs on Windows 10/11 |

---

## 🔧 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Signaling server port |
| `VITE_SERVER_URL` | `http://localhost:3000` | Server URL for the web client |

---

## 🧪 Running Tests

```powershell
# Run integration tests (requires server to be running)
node test-integration.mjs
```

---

## 📖 Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and design decisions
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment guide
- [CHANGELOG.md](CHANGELOG.md) — Version history

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
