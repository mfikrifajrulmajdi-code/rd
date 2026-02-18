# Agent 5 — Documentation Writer

## Misi
Buat dokumentasi lengkap untuk project remote desktop app:
1. **README.md** — Panduan utama project (install, run, use)
2. **ARCHITECTURE.md** — Dokumentasi teknis arsitektur
3. **DEPLOYMENT.md** — Panduan deploy ke production
4. **CHANGELOG.md** — Riwayat perubahan project

Semua file ditulis ke root project: `c:\Users\Decimate\Documents\dev\majdi\remote dekstop\`

---

## ⚠️ BACA INI PERTAMA — Fix PATH (Wajib)

```powershell
$env:PATH = "C:\Users\Decimate\AppData\Roaming\npm;C:\Program Files\nodejs;" + $env:PATH
```

---

## Skills yang Tersedia

Baca dan gunakan skill berikut sebelum mulai:
- `architecture-decision-records` — untuk ARCHITECTURE.md
- `openapi-spec-generation` — untuk dokumentasi API/Socket events
- `changelog-automation` — untuk CHANGELOG.md

---

## Konteks Project

### Apa ini?
Remote desktop application berbasis WebRTC. User bisa share layar desktop mereka ke browser melalui internet (atau LAN).

### Tech Stack
- **Signaling Server**: Node.js + Socket.IO (port 3000)
- **Desktop Host**: Electron + React (renderer) + WebRTC
- **Web Client**: React + Vite (port 5173+)
- **Shared**: TypeScript types & constants
- **Monorepo**: pnpm workspaces

### Struktur Project
```
remote dekstop/
├── packages/
│   ├── shared/          ← Types, constants, utils (@remote-app/shared)
│   ├── server/          ← Signaling server Socket.IO
│   ├── desktop/         ← Electron host app
│   └── client/          ← React web client (Vite)
├── .agent/handoff/      ← Agent handoff docs
├── package.json         ← Root (pnpm workspaces)
└── pnpm-workspace.yaml
```

### Cara Menjalankan (untuk README)
```powershell
# 1. Install dependencies
pnpm install

# 2. Build shared package
pnpm --filter @remote-app/shared build

# 3. Jalankan semua service
$env:ELECTRON_RUN_AS_NODE=$null
pnpm dev:all
```

### Scripts yang Tersedia
| Script | Fungsi |
|--------|--------|
| `pnpm dev:all` | Jalankan server + desktop + client sekaligus |
| `pnpm dev:server` | Hanya server |
| `pnpm dev:desktop` | Hanya Electron desktop |
| `pnpm dev:client` | Hanya web client |

### Prerequisites untuk User
- Node.js >= 18
- pnpm >= 8 (`npm install -g pnpm`)
- Windows 10/11 (untuk Electron desktop host)
- Visual Studio Build Tools 2019+ (untuk input control via robotjs)

---

## Alur Kerja Aplikasi (untuk ARCHITECTURE.md)

```
Desktop (Electron)                Server (Socket.IO)           Browser (React)
      │                                  │                           │
      │── REGISTER_HOST ────────────────>│                           │
      │<─ REGISTER_HOST_RESPONSE ────────│ (session code: ABC-123)   │
      │                                  │                           │
      │                                  │<── JOIN_SESSION ──────────│
      │                                  │─── PEER_JOINED ──────────>│
      │<── PEER_JOINED ──────────────────│                           │
      │                                  │                           │
      │── OFFER (SDP) ──────────────────>│─── OFFER ────────────────>│
      │<── ANSWER (SDP) ─────────────────│<── ANSWER ────────────────│
      │<──> ICE candidates ─────────────>│<──> ICE candidates ───────│
      │                                  │                           │
      │<════════ WebRTC P2P (video + DataChannel) ═════════════════>│
```

### IPC Communication (Electron)
```
Main Process                    Renderer Process
     │                               │
     │<── renderer-ready ────────────│
     │─── session-code ─────────────>│
     │─── peer-joined ──────────────>│
     │<── signal-offer ──────────────│
     │─── signal-answer ────────────>│
     │<── handle-input ──────────────│ (dari DataChannel admin)
```

### Socket Events (untuk openapi-spec-generation skill)
| Event | Arah | Payload |
|-------|------|---------|
| `register-host` | Client→Server | `{ expiresInMs? }` |
| `register-host-response` | Server→Client | `{ sessionCode, hostId }` |
| `join-session` | Client→Server | `{ sessionCode, role }` |
| `join-session-response` | Server→Client | `{ hostId, peerId, role }` |
| `peer-joined` | Server→Host | `{ peerId, role }` |
| `peer-left` | Server→Client | `{ peerId }` |
| `offer` | Relay | `{ targetId, senderId, signal }` |
| `answer` | Relay | `{ targetId, senderId, signal }` |
| `ice-candidate` | Relay | `{ targetId, senderId, signal }` |
| `session-expired` | Server→All | `{}` |
| `error` | Server→Client | `{ code, message }` |

---

## Known Limitations (untuk README & DEPLOYMENT)

1. **Input control (robotjs)** — Butuh rebuild native module:
   ```powershell
   cd packages/desktop
   npx @electron/rebuild -f -w @jitsi/robotjs
   # Requires: Visual Studio Build Tools
   ```

2. **LAN only** — Server harus deploy ke cloud untuk akses internet

3. **No authentication** — Session code saja, tidak ada password/PIN

4. **No TURN server** — WebRTC bisa gagal di NAT ketat

---

## Deployment Options (untuk DEPLOYMENT.md)

### Server ke Railway (gratis tier)
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login & deploy
railway login
cd packages/server
railway init
railway up
```

### Server ke Render (gratis tier)
- Build command: `pnpm --filter @remote-app/server build`
- Start command: `node packages/server/dist/index.js`
- Port: `3000`

### Electron Build (installer .exe)
```powershell
cd packages/desktop
pnpm build
# Output: dist/*.exe
```

### TURN Server (Coturn)
```bash
# Ubuntu/Debian
apt install coturn
# Config: /etc/turnserver.conf
```

---

## Checklist Dokumen

Setelah selesai, pastikan semua file ada:

| File | Status |
|------|--------|
| `README.md` | [ ] |
| `ARCHITECTURE.md` | [ ] |
| `DEPLOYMENT.md` | [ ] |
| `CHANGELOG.md` | [ ] |

---

## Format & Style Guide

- Bahasa: **Inggris** (standar open source)
- Format: **GitHub Flavored Markdown**
- README harus ada: badges, quick start, screenshot placeholder
- ARCHITECTURE harus ada: diagram ASCII atau Mermaid
- DEPLOYMENT harus ada: step-by-step dengan code blocks
- CHANGELOG format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## ?? Wajib: Update Dokumentasi Setelah Selesai

Setiap agent yang membuat perubahan pada kode **wajib** mengupdate dokumentasi project.

### 1. CHANGELOG.md (Selalu Update)
Tambahkan entri di bagian `[Unreleased]` di `CHANGELOG.md` (root project):

```markdown
## [Unreleased]

### Added
- [Deskripsi fitur baru yang kamu tambahkan]

### Fixed
- [Deskripsi bug yang kamu perbaiki]

### Changed
- [Deskripsi perubahan yang kamu buat]
```

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

### 2. README.md (Update jika ada fitur baru)
Jika kamu menambahkan fitur baru yang perlu diketahui user:
- Tambahkan ke bagian **Features** atau **Usage**
- Update **Prerequisites** jika ada dependency baru

### 3. ARCHITECTURE.md (Update jika ada perubahan arsitektur)
Jika kamu mengubah cara komponen berkomunikasi, menambah/hapus IPC event, atau mengubah alur signaling:
- Update diagram yang relevan
- Update tabel Socket Events / IPC Events

### 4. DEPLOYMENT.md (Update jika ada perubahan konfigurasi)
Jika kamu menambah environment variable baru atau mengubah cara deploy:
- Update bagian Environment Variables
- Update langkah-langkah deployment

### Aturan Singkat
| Jenis Perubahan | File yang Diupdate |
|-----------------|-------------------|
| Bug fix | CHANGELOG.md |
| Fitur baru | CHANGELOG.md + README.md |
| Perubahan arsitektur | CHANGELOG.md + ARCHITECTURE.md |
| Perubahan deployment | CHANGELOG.md + DEPLOYMENT.md |
| Semua perubahan | CHANGELOG.md (minimal) |

> ?? Jika `CHANGELOG.md` belum ada (Agent 5 belum selesai), buat file baru dengan format di atas.
