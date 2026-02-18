# Agent 1 — Signaling Server

## Misi
Implementasi lengkap signaling server di `packages/server/`. Server ini menjadi perantara WebSocket untuk menghubungkan Desktop Host dan Web Client sebelum koneksi WebRTC P2P terbentuk.

## Tech Stack
- **Runtime**: Node.js + TypeScript
- **Framework**: Express + Socket.IO
- **Dev**: tsx (watch mode)
- **Shared types**: `@remote-app/shared` (sudah built di `packages/shared/dist/`)

## Konteks Proyek
```
c:\Users\Decimate\Documents\dev\majdi\remote dekstop\
├── packages/
│   ├── shared/     ← SUDAH SELESAI (types, constants, utils)
│   ├── server/     ← KAMU KERJAKAN INI
│   ├── desktop/    ← Agent lain
│   └── client/     ← Agent lain
```

## File yang Perlu Dikerjakan

### `packages/server/src/index.ts` (SUDAH ADA — EXPAND)
File stub sudah ada. Tambahkan semua event handlers.

### `packages/server/src/session-manager.ts` (BUAT BARU)
Kelola session lifecycle:
- `createSession(hostId, expiresInMs)` → return SessionInfo
- `joinSession(code, peerId, role)` → return host info
- `removeSession(code)` → cleanup
- `removePeer(socketId)` → cleanup saat disconnect
- Timer-based expiry jika `expiresAt` bukan null

### `packages/server/src/peer-manager.ts` (BUAT BARU)
Kelola connected peers:
- `addPeer(socketId, peerInfo)` → register
- `removePeer(socketId)` → cleanup
- `getPeer(socketId)` → lookup
- `getPeersBySession(code)` → list semua peer dalam session

## Alur yang Harus Diimplementasi

### 1. Host Register
```
Host → 'register-host' { peerId, expiresInMs }
Server:
  1. Generate session code (import { generateSessionCode } from '@remote-app/shared')
  2. Simpan session di Map
  3. Emit 'register-host-response' { sessionCode, hostId }
```

### 2. Admin/Viewer Join
```
Client → 'join-session' { sessionCode, role: 'admin' | 'viewer' }
Server:
  1. Validasi session code (import { isValidSessionCode } from '@remote-app/shared')
  2. Cek session exists & not expired
  3. Jika role='admin', cek belum ada admin lain
  4. Simpan peer info
  5. Emit 'join-session-response' ke client { hostId, peerId, viewers }
  6. Emit 'peer-joined' ke host { peerId, role }
```

### 3. WebRTC Signaling Relay
```
Peer A → 'offer' { targetId, senderId, signal }
Server: Forward ke targetId socket

Peer B → 'answer' { targetId, senderId, signal }
Server: Forward ke targetId socket

Any → 'ice-candidate' { targetId, senderId, signal }
Server: Forward ke targetId socket
```

### 4. Disconnect Cleanup
```
Socket disconnect:
  1. Get peer info
  2. If host → notify all connected peers via 'peer-left', remove session
  3. If admin/viewer → notify host via 'peer-left', remove from session
```

### 5. Session Expiry
```
setTimeout for each session with expiresAt:
  1. Emit 'session-expired' to all peers in session
  2. Disconnect all peers
  3. Remove session
```

## Types yang Tersedia (import dari @remote-app/shared)

```typescript
import {
  // Types
  RegisterHostPayload, RegisterHostResponse,
  JoinSessionPayload, JoinSessionResponse,
  SignalPayload, PeerJoinedPayload, PeerLeftPayload,
  ErrorPayload, SessionInfo, PeerRole,
  // Constants
  SOCKET_EVENTS, ERROR_CODES, SESSION_EXPIRY,
  // Utils
  generateSessionCode, isValidSessionCode,
} from '@remote-app/shared';
```

## CORS Config
```typescript
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
```

## Cara Run
```bash
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop"
pnpm --filter @remote-app/server dev
```

## Output yang Diharapkan
- Server berjalan di `localhost:3000`
- `GET /` → `{ status: 'ok', message: '...' }`
- Log setiap event: connect, register, join, signal relay, disconnect
- Session expiry timer bekerja

## Checklist
- [ ] Implement `session-manager.ts`
- [ ] Implement `peer-manager.ts`
- [ ] Implement semua SOCKET_EVENTS handlers di `index.ts`
- [ ] Session expiry timer
- [ ] Error handling (session not found, expired, admin already exists)
- [ ] Console logging untuk setiap event
- [ ] Jalankan semua test verifikasi di bawah

## Verifikasi — Wajib Dijalankan Setelah Selesai

### Test 1: Build Check
```bash
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop"
pnpm --filter @remote-app/server build
```
**Expected**: Build berhasil tanpa error TypeScript.

### Test 2: Server Start
```bash
pnpm --filter @remote-app/server dev
```
**Expected**: Output `Server running on port 3000` di terminal.

### Test 3: HTTP Health Check
Buka terminal baru, jalankan:
```bash
curl http://localhost:3000
```
**Expected**: Response JSON `{ "status": "ok", "message": "Remote Desktop Signaling Server" }`

### Test 4: Socket.IO Connection Test
Buat file `packages/server/test-client.mjs` (file test sementara):
```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);

  // Test 1: Register as host
  socket.emit("register-host", { peerId: socket.id, expiresInMs: null });
});

socket.on("register-host-response", (data) => {
  console.log("✅ Session created:", data.sessionCode);

  // Test 2: Simulate join from another socket
  const viewer = io("http://localhost:3000");
  viewer.on("connect", () => {
    console.log("✅ Viewer connected:", viewer.id);
    viewer.emit("join-session", { sessionCode: data.sessionCode, role: "viewer" });
  });

  viewer.on("join-session-response", (res) => {
    console.log("✅ Viewer joined session. Host ID:", res.hostId);
    
    // Test 3: Send offer (relay test)
    viewer.emit("offer", {
      targetId: res.hostId,
      senderId: viewer.id,
      signal: { type: "offer", sdp: "test-sdp" }
    });
  });

  viewer.on("error", (err) => {
    console.log("❌ Viewer error:", err);
  });
});

// Host should receive the offer relay
socket.on("offer", (data) => {
  console.log("✅ Host received offer from:", data.senderId);
  console.log("\n🎉 ALL TESTS PASSED!");
  process.exit(0);
});

socket.on("peer-joined", (data) => {
  console.log("✅ Host notified: peer joined as", data.role);
});

socket.on("error", (err) => {
  console.log("❌ Error:", err);
});

// Timeout
setTimeout(() => {
  console.log("❌ TIMEOUT — Tests did not complete in 5s");
  process.exit(1);
}, 5000);
```

Jalankan (pastikan server sedang running di terminal lain):
```bash
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop"
node packages/server/test-client.mjs
```

**Expected output (semua hijau ✅)**:
```
✅ Connected: <socket-id>
✅ Session created: ABC-DEF-GHI
✅ Viewer connected: <socket-id>
✅ Host notified: peer joined as viewer
✅ Viewer joined session. Host ID: <host-socket-id>
✅ Host received offer from: <viewer-socket-id>

🎉 ALL TESTS PASSED!
```

### Test 5: Error Handling
Modifikasi test-client.mjs: coba join session dengan code yang salah.
```javascript
socket.emit("join-session", { sessionCode: "XXX-XXX-XXX", role: "admin" });
```
**Expected**: Menerima event `error` dengan code `SESSION_NOT_FOUND`

### Test 6: Session Expiry (jika expiresInMs diset)
Register host with `expiresInMs: 5000` (5 detik). Tunggu 6 detik.
**Expected**: Semua peer menerima event `session-expired`, session dihapus.

### Setelah Semua Test Berhasil
Hapus file test:
```bash
del packages\server\test-client.mjs
```

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
