# Agent 2 — Desktop Host (Electron)

## Misi
Bangun aplikasi Electron yang berfungsi sebagai "komputer target" — merekam layarnya sendiri, menerima koneksi dari admin/viewer, streaming video via WebRTC, dan menerima input mouse/keyboard dari admin.

## Tech Stack
- **Framework**: Electron 28 + electron-vite
- **UI**: React 18 (renderer process)
- **Input Control**: @jitsi/robotjs
- **WebSocket**: socket.io-client
- **Data encoding**: @msgpack/msgpack
- **Shared types**: `@remote-app/shared`

## Konteks Proyek
```
c:\Users\Decimate\Documents\dev\majdi\remote dekstop\
├── packages/
│   ├── shared/     ← SUDAH SELESAI (types, constants, utils)
│   ├── server/     ← Agent lain (localhost:3000)
│   ├── desktop/    ← KAMU KERJAKAN INI
│   └── client/     ← Agent lain
```

## Struktur File yang Harus Dibuat

```
packages/desktop/
├── src/
│   ├── main/                    ← Electron Main Process
│   │   ├── index.ts             ← App entry, create window, IPC
│   │   ├── capture.ts           ← Screen capture via desktopCapturer
│   │   ├── input-handler.ts     ← @jitsi/robotjs wrapper
│   │   ├── signaling.ts         ← Socket.IO client connection
│   │   └── webrtc-host.ts       ← RTCPeerConnection (host side)
│   │
│   ├── preload/
│   │   └── index.ts             ← contextBridge: expose safe APIs
│   │
│   └── renderer/                ← React UI
│       ├── index.html
│       ├── main.tsx             ← React entry
│       ├── App.tsx              ← Main component
│       └── App.css
│
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
└── package.json                 ← SUDAH ADA
```

## Komponen yang Harus Diimplementasi

### 1. `capture.ts` — Screen Capture
```typescript
import { desktopCapturer } from 'electron';

// Ambil primary display stream
export async function getScreenStream(): Promise<MediaStream> {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  const primarySource = sources[0]; // Primary display
  
  // Gunakan getUserMedia dengan chromeMediaSourceId
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      // @ts-ignore — Electron-specific constraint
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: primarySource.id,
        maxWidth: 1280,   // dari DEFAULT_VIDEO_CONFIG
        maxHeight: 720,
        maxFrameRate: 30,
      }
    }
  });
  return stream;
}
```

### 2. `input-handler.ts` — Mouse & Keyboard via robotjs
```typescript
import robot from '@jitsi/robotjs';
import { InputMessage } from '@remote-app/shared';
import { denormalizeCoords } from '@remote-app/shared';
import { screen } from 'electron';

export function handleInput(msg: InputMessage): void {
  const { width, height } = screen.getPrimaryDisplay().size;
  
  switch (msg.t) {
    case 'mouse-move': {
      const { x, y } = denormalizeCoords(msg.x!, msg.y!, width, height);
      robot.moveMouse(x, y);
      break;
    }
    case 'mouse-click': {
      robot.mouseClick(msg.b === 'right' ? 'right' : 'left');
      break;
    }
    case 'mouse-scroll': {
      robot.scrollMouse(0, msg.d! > 0 ? -3 : 3);
      break;
    }
    case 'key-press': {
      robot.keyTap(msg.k!);
      break;
    }
    // ... key-release, mouse-down, mouse-up
  }
}
```

### 3. `signaling.ts` — Socket.IO Client
```typescript
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, DEFAULT_SERVER_URL } from '@remote-app/shared';

export function connectToServer(serverUrl = DEFAULT_SERVER_URL): Socket {
  const socket = io(serverUrl);
  
  socket.on('connect', () => console.log('Connected to signaling server'));
  socket.on('disconnect', () => console.log('Disconnected'));
  
  return socket;
}

export function registerAsHost(socket: Socket, expiresInMs: number | null) {
  socket.emit(SOCKET_EVENTS.REGISTER_HOST, {
    peerId: socket.id,
    expiresInMs
  });
}
```

### 4. `webrtc-host.ts` — WebRTC Logic (Host Side)
```typescript
import { ICE_SERVERS, DATA_CHANNELS } from '@remote-app/shared';
import { decode } from '@msgpack/msgpack';

// Per viewer/admin: create a new RTCPeerConnection
export function createPeerConnection(
  stream: MediaStream,
  role: 'admin' | 'viewer',
  onInput: (msg: InputMessage) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  
  // Add video track
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  
  // Only create DataChannel for admin (not viewer)
  if (role === 'admin') {
    const dc = pc.createDataChannel(DATA_CHANNELS.INPUT);
    dc.binaryType = 'arraybuffer';
    dc.onmessage = (event) => {
      const msg = decode(event.data as ArrayBuffer) as InputMessage;
      onInput(msg);
    };
  }
  
  return pc;
}
```

### 5. `App.tsx` — React UI (Renderer)
UI Minimalis:
- Session code besar: `ABC-DEF-GHI` (font besar, bisa di-copy)
- Status: "Menunggu koneksi..." / "Terhubung (1 admin, 2 viewer)"
- Tombol: "Generate Code Baru" | "Stop Sharing"
- Toggle: Session Expiry (10 menit / Selamanya)
- Komunikasi main↔renderer via `contextBridge` + IPC

### 6. `preload/index.ts` — Context Bridge
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onSessionCode: (cb: (code: string) => void) => 
    ipcRenderer.on('session-code', (_, code) => cb(code)),
  onConnectionUpdate: (cb: (info: any) => void) => 
    ipcRenderer.on('connection-update', (_, info) => cb(info)),
  generateNewCode: () => ipcRenderer.send('generate-new-code'),
  stopSharing: () => ipcRenderer.send('stop-sharing'),
  setExpiry: (ms: number | null) => ipcRenderer.send('set-expiry', ms),
});
```

## Alur Lengkap

```
1. App starts → connect to signaling server
2. Register as host → receive session code
3. Display code in UI
4. Wait for 'peer-joined' event from server
5. On peer joined:
   a. Create RTCPeerConnection
   b. Add screen capture tracks
   c. Create DataChannel (if admin)
   d. Create SDP offer → send via signaling
6. Receive SDP answer → setRemoteDescription
7. Exchange ICE candidates
8. WebRTC connected → streaming begins
9. Receive input via DataChannel → execute via robotjs
```

## electron-vite Config
```typescript
// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
  },
});
```

## Cara Run
```bash
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop"
pnpm --filter @remote-app/shared build   # pastikan shared sudah build
pnpm --filter @remote-app/desktop dev
```

## Output yang Diharapkan
- Window Electron muncul dengan session code
- Log: "Connected to signaling server"
- Log: "Screen capture started: 1280x720@30fps"
- Saat admin/viewer connect: "Peer connected: <id> as <role>"

## Checklist
- [ ] Setup electron-vite project structure
- [ ] Implement screen capture (`capture.ts`)
- [ ] Implement input handler (`input-handler.ts`)
- [ ] Implement signaling client (`signaling.ts`)
- [ ] Implement WebRTC host logic (`webrtc-host.ts`)
- [ ] Implement preload contextBridge
- [ ] Implement React UI (`App.tsx`)
- [ ] IPC communication main↔renderer
- [ ] Support multiple viewers (Map of peer connections)
- [ ] Jalankan semua test verifikasi di bawah

## Verifikasi — Wajib Dijalankan Setelah Selesai

### Test 1: Build Check
```bash
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop"
pnpm --filter @remote-app/shared build
pnpm --filter @remote-app/desktop build
```
**Expected**: Build berhasil tanpa error TypeScript.

### Test 2: App Launches
```bash
pnpm --filter @remote-app/desktop dev
```
**Expected**:
- Window Electron muncul (tidak crash)
- UI menampilkan session code format `ABC-DEF-GHI`
- Terminal log: `"Connected to signaling server"` (jika server running)
  ATAU `"Failed to connect to signaling server"` (jika server tidak running — ini OK)

### Test 3: Screen Capture Test
Saat app running, buka DevTools (Ctrl+Shift+I di Electron window).
Cek console log untuk:
```
Screen capture started: 1280x720@30fps
```
**Expected**: Tidak ada error terkait `desktopCapturer`.

### Test 4: robotjs Input Test (Manual)
Tambahkan sementara di `main/index.ts`:
```typescript
import robot from '@jitsi/robotjs';
// Test: gerakkan mouse ke posisi 100,100 saat app start
setTimeout(() => {
  robot.moveMouse(100, 100);
  console.log('✅ robotjs moveMouse works');
}, 3000);
```
**Expected**: Mouse bergerak ke sudut kiri atas setelah 3 detik. Hapus test code setelah verify.

### Test 5: UI Interaction
Di Electron window:
1. Session code terlihat jelas dan bisa di-copy (klik → clipboard)
2. Tombol "Generate Code Baru" → code berubah
3. Toggle expiry works
4. Tombol "Stop Sharing" → status berubah

### Test 6: End-to-End (Butuh Server Running)
Prasyarat: Agent 1 sudah selesai, server running di `localhost:3000`
1. Start desktop app
2. Catat session code dari UI
3. Buka browser console, jalankan:
```javascript
const socket = io("http://localhost:3000");
socket.on("connect", () => {
  socket.emit("join-session", { sessionCode: "KODE-DARI-DESKTOP", role: "viewer" });
});
socket.on("join-session-response", (data) => console.log("Joined!", data));
```
**Expected**: Desktop app log menampilkan "Peer connected as viewer"


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
