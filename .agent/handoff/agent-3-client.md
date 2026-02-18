# Agent 3 — Web Client (React)

## Misi
Bangun aplikasi web React yang berfungsi sebagai "pengendali remote" — menampilkan video streaming dari Desktop Host, dan mengirim input mouse/keyboard ke Host via WebRTC DataChannel.

## Tech Stack
- **Framework**: React 18 + Vite 5
- **WebSocket**: socket.io-client
- **Data encoding**: @msgpack/msgpack
- **Shared types**: `@remote-app/shared`
- **Styling**: Vanilla CSS (minimalis ala Chrome Remote Desktop)

## Konteks Proyek
```
c:\Users\Decimate\Documents\dev\majdi\remote dekstop\
├── packages/
│   ├── shared/     ← SUDAH SELESAI (types, constants, utils)
│   ├── server/     ← Agent lain (localhost:3000)
│   ├── desktop/    ← Agent lain
│   └── client/     ← KAMU KERJAKAN INI
```

## Struktur File yang Harus Dibuat

```
packages/client/
├── src/
│   ├── main.tsx                 ← React entry point
│   ├── App.tsx                  ← Root component, state management
│   ├── App.css                  ← Global styles
│   │
│   ├── components/
│   │   ├── ConnectionForm.tsx   ← Input session code + connect buttons
│   │   ├── ConnectionForm.css
│   │   ├── VideoPlayer.tsx      ← Remote screen display + input capture
│   │   ├── VideoPlayer.css
│   │   ├── Toolbar.tsx          ← Top bar (disconnect, fullscreen)
│   │   ├── Toolbar.css
│   │   └── StatusOverlay.tsx    ← "Connecting...", "Reconnecting..."
│   │
│   └── hooks/
│       ├── useSignaling.ts      ← Socket.IO connection & events
│       ├── useWebRTC.ts         ← RTCPeerConnection (viewer side)
│       └── useInputCapture.ts   ← Mouse/keyboard event → DataChannel
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── package.json                 ← SUDAH ADA
```

## Komponen yang Harus Diimplementasi

### 1. `App.tsx` — Root State Machine
```typescript
// States: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
// Render:
//   disconnected → <ConnectionForm />
//   connecting   → <StatusOverlay message="Connecting..." />
//   connected    → <Toolbar /> + <VideoPlayer />
//   reconnecting → <VideoPlayer /> + <StatusOverlay message="Reconnecting..." />
```

### 2. `ConnectionForm.tsx` — Session Code Input
UI:
```
┌─────────────────────────────────────┐
│                                     │
│       Remote Desktop Viewer         │
│                                     │
│    Enter session code:              │
│    ┌─────┐ ─ ┌─────┐ ─ ┌─────┐    │
│    │     │   │     │   │     │    │
│    └─────┘   └─────┘   └─────┘    │
│                                     │
│    [Connect as Admin]               │
│    [Connect as Viewer]              │
│                                     │
└─────────────────────────────────────┘
```

Behavior:
- 3 input fields, 3 karakter masing-masing
- Auto-uppercase
- Auto-focus ke field berikutnya saat 3 karakter terisi
- Paste support: detect full code "ABC-DEF-GHI" dan split
- Validasi via `isValidSessionCode()` dari `@remote-app/shared`

### 3. `useSignaling.ts` — Socket.IO Hook
```typescript
import { io } from 'socket.io-client';
import { SOCKET_EVENTS, DEFAULT_SERVER_URL } from '@remote-app/shared';

export function useSignaling(serverUrl = DEFAULT_SERVER_URL) {
  // Return: { socket, joinSession, sendOffer, sendAnswer, sendIceCandidate }
  
  // joinSession(code, role):
  //   emit SOCKET_EVENTS.JOIN_SESSION
  //   listen SOCKET_EVENTS.JOIN_SESSION_RESPONSE → return hostId
  
  // Relay handlers:
  //   on 'offer' → callback
  //   on 'answer' → callback
  //   on 'ice-candidate' → callback
  //   on 'peer-left' → callback (host disconnected)
  //   on 'session-expired' → callback
}
```

### 4. `useWebRTC.ts` — WebRTC Hook (Viewer Side)
```typescript
import { ICE_SERVERS, DATA_CHANNELS } from '@remote-app/shared';

export function useWebRTC() {
  // Return: { connect, disconnect, remoteStream, dataChannel, connectionState }
  
  // connect(hostId, socket, role):
  //   1. Create RTCPeerConnection({ iceServers: ICE_SERVERS })
  //   2. pc.ontrack = (event) => setRemoteStream(event.streams[0])
  //   3. If role === 'admin':
  //      pc.ondatachannel = (event) => setDataChannel(event.channel)
  //   4. Create SDP offer → send via signaling
  //   5. Handle answer → setRemoteDescription
  //   6. Exchange ICE candidates
}
```

### 5. `useInputCapture.ts` — Input Capture + Send
```typescript
import { normalizeCoords, createThrottle, INPUT_THROTTLE } from '@remote-app/shared';
import { encode } from '@msgpack/msgpack';

export function useInputCapture(
  videoRef: RefObject<HTMLVideoElement>,
  dataChannel: RTCDataChannel | null,
  enabled: boolean  // false for viewer role
) {
  // Attach ke video element:
  // onMouseMove → throttle(30/sec) → normalizeCoords → encode → dc.send()
  // onClick     → normalizeCoords → encode → dc.send()
  // onKeyDown   → encode key → dc.send()
  // onKeyUp     → encode key → dc.send()
  // onWheel     → throttle(20/sec) → encode delta → dc.send()
  // onContextMenu → preventDefault (disable right-click menu)
  
  // Message format (short keys for bandwidth):
  // { t: 'mouse-move', x: 0.5, y: 0.3, ts: Date.now() }
}
```

### 6. `VideoPlayer.tsx` — Remote Screen Display
```typescript
// <video ref={videoRef} autoPlay playsInline muted />
// - Fill container (object-fit: contain)
// - Support fullscreen (document.fullscreenEnabled)
// - Cursor: crosshair saat admin, default saat viewer
// - Event listeners via useInputCapture hook
```

### 7. `Toolbar.tsx` — Control Bar
```
┌──────────────────────────────────────┐
│ ◀ Disconnect │ ⛶ Fullscreen │ ℹ Info │
└──────────────────────────────────────┘
```
- Auto-hide after 3 seconds, show on mouse move at top
- Info: session code, connection quality, role

## Alur Lengkap

```
1. User opens web app → ConnectionForm displayed
2. User enters session code → clicks "Connect as Admin/Viewer"
3. useSignaling: connect to server, emit 'join-session'
4. Receive 'join-session-response' with hostId
5. useWebRTC: create RTCPeerConnection
6. Wait for SDP offer from host (host is the one who adds the stream)
   OR create offer and send to host (depends on implementation)
7. Exchange ICE candidates
8. pc.ontrack → receive video stream → set to <video> element
9. If admin: DataChannel opens → useInputCapture starts capturing
10. User interacts → mouse/keyboard sent via DataChannel
```

> **PENTING**: Koordinasi offer/answer:
> - Host membuat offer (karena host yang punya stream)
> - Client menerima offer → create answer → kirim balik
> - ATAU Client membuat offer, host responds. Pilih satu pola dan konsisten.
> - **Rekomendasi**: HOST membuat offer saat peer-joined event diterima.

## CSS Design (Chrome Remote Desktop Style)

Warna dan prinsip:
```css
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-card: #0f3460;
  --accent: #e94560;
  --text-primary: #ffffff;
  --text-secondary: #a0a0b0;
  --border-radius: 12px;
  --font-family: 'Inter', -apple-system, sans-serif;
}
```
- Dark theme
- Centered connection form
- Full-screen video area saat connected
- Smooth transitions antar state

## Cara Run
```bash
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop"
pnpm --filter @remote-app/shared build   # pastikan shared sudah build
pnpm --filter @remote-app/client dev
```

## Output yang Diharapkan
- Browser terbuka di `localhost:5173`
- Connection form muncul dengan 3 input fields
- Setelah connect: video stream muncul, toolbar di atas
- Mouse/keyboard events dikirim saat role=admin

## Checklist
- [ ] Setup Vite + React project structure
- [ ] Implement `ConnectionForm.tsx` (3-field code input, paste support)
- [ ] Implement `useSignaling.ts` (Socket.IO connection)
- [ ] Implement `useWebRTC.ts` (RTCPeerConnection viewer side)
- [ ] Implement `useInputCapture.ts` (mouse/keyboard → DataChannel)
- [ ] Implement `VideoPlayer.tsx` (video display + fullscreen)
- [ ] Implement `Toolbar.tsx` (disconnect, fullscreen, auto-hide)
- [ ] Implement `StatusOverlay.tsx` (connecting/reconnecting states)
- [ ] Implement `App.tsx` (state machine routing)
- [ ] CSS styling (dark theme, Chrome RD inspired)
- [ ] Jalankan semua test verifikasi di bawah

## Verifikasi — Wajib Dijalankan Setelah Selesai

### Test 1: Build Check
```bash
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop"
pnpm --filter @remote-app/shared build
pnpm --filter @remote-app/client build
```
**Expected**: Build berhasil tanpa error TypeScript.

### Test 2: Dev Server Start
```bash
pnpm --filter @remote-app/client dev
```
**Expected**: Vite dev server start di `localhost:5173` (atau port lain).

### Test 3: UI Visual Check (via Browser)
Buka `http://localhost:5173` di browser. Verifikasi:
1. ✅ Dark theme ditampilkan (background gelap, teks putih)
2. ✅ Title "Remote Desktop Viewer" terlihat
3. ✅ 3 input fields untuk session code muncul
4. ✅ 2 tombol: "Connect as Admin" dan "Connect as Viewer"
5. ✅ Layout centered, desain modern (bukan default HTML)

### Test 4: Connection Form Behavior
Di browser:
1. Ketik "ABC" di field pertama → focus otomatis pindah ke field kedua ✅
2. Ketik "DEF" di field kedua → focus pindah ke field ketiga ✅
3. Ketik "GHI" di field ketiga → tombol Connect aktif ✅
4. Hapus 1 karakter → tombol Connect disabled ✅
5. Paste "XYZ-ABC-DEF" di field pertama → semua field terisi otomatis ✅
6. Ketik lowercase "abc" → otomatis jadi uppercase "ABC" ✅

### Test 5: Connect Error State (Tanpa Server)
1. Isi session code lengkap
2. Klik "Connect as Admin"
3. **Expected**: Status berubah ke "Connecting..." → lalu "Connection failed" (karena server tidak running)
4. Pastikan TIDAK crash, hanya tampilkan error message

### Test 6: Connect with Server (Butuh Server Running)
Prasyarat: Agent 1 sudah selesai, server running di `localhost:3000`
1. Buka web client
2. Masukkan session code yang valid (dari desktop host atau manual test)
3. Klik "Connect as Admin"
4. **Expected**: Status berubah ke "Connecting..." → "Waiting for host..."
5. Cek browser console: tidak ada unhandled errors

### Test 7: Toolbar dan Fullscreen
Saat dalam state "connected" (bisa di-mock dengan state override):
1. Toolbar muncul di atas ✅
2. Toolbar auto-hide setelah 3 detik ✅
3. Gerakkan mouse ke atas → toolbar muncul kembali ✅
4. Klik "Fullscreen" → browser masuk fullscreen mode ✅
5. Klik "Disconnect" → kembali ke connection form ✅

### Test 8: Responsive Design
Resize browser window ke berbagai ukuran:
1. Desktop (1920x1080) → layout OK ✅
2. Tablet (768x1024) → layout OK ✅
3. Mobile (375x667) → layout OK ✅ (connection form tetap usable)

### Test 9: No Console Errors
Buka browser DevTools (F12) → Console tab.
**Expected**: Tidak ada error merah (warning kuning OK).


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
