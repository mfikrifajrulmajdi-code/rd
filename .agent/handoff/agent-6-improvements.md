# Agent 6 — Code Improvements (No External Services Required)

## Misi
Implementasi 3 peningkatan kode yang bisa dikerjakan **tanpa mendaftar layanan apapun**:
1. **TURN Server (Open Relay)** — tambah fallback TURN server gratis ke ICE config
2. **Session PIN/Password** — tambah lapisan keamanan opsional pada session
3. **Auto-reconnect** — client otomatis reconnect jika koneksi terputus

---

## ⚠️ BACA INI PERTAMA — Fix PATH (Wajib)

```powershell
$env:PATH = "C:\Users\Decimate\AppData\Roaming\npm;C:\Program Files\nodejs;" + $env:PATH
```

---

## Task 1: TURN Server (Open Relay) — Prioritas Tinggi 🔴

### File yang diubah: `packages/shared/src/constants.ts`

Tambahkan Open Relay TURN servers ke `ICE_SERVERS`:

```typescript
export const ICE_SERVERS: RTCIceServer[] = [
    // STUN servers (existing)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // Open Relay TURN servers (free, no registration required)
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];
```

> Setelah user mendaftar ke Metered.ca, credentials ini akan diganti dengan yang personal (Agent 7).

### Verifikasi
Jalankan semua service dan connect dari browser. Buka DevTools → `chrome://webrtc-internals` → pastikan ada TURN candidates di ICE negotiation.

---

## Task 2: Session PIN/Password — Prioritas Sedang 🟡

Tambah PIN opsional saat host membuat session. Viewer/admin harus memasukkan PIN yang benar untuk join.

### 2a. Update `packages/shared/src/types.ts`

Tambahkan `pin` ke payload types:

```typescript
export interface RegisterHostPayload {
    expiresInMs?: number | null;
    pin?: string | null;  // ← tambahkan ini
}

export interface JoinSessionPayload {
    sessionCode: string;
    role: 'admin' | 'viewer';
    pin?: string | null;  // ← tambahkan ini
}
```

### 2b. Update `packages/shared/src/constants.ts`

Tambahkan error code baru:

```typescript
export const ERROR_CODES = {
    // ... existing codes ...
    INVALID_PIN: 'INVALID_PIN',
    PIN_REQUIRED: 'PIN_REQUIRED',
} as const;
```

### 2c. Update `packages/server/src/session-manager.ts`

Simpan PIN saat session dibuat, validasi saat join:

```typescript
interface Session {
    // ... existing fields ...
    pin: string | null;  // ← tambahkan ini
}

// Saat createSession:
createSession(hostSocketId: string, expiresInMs?: number | null, pin?: string | null): Session {
    // ... existing code ...
    const session: Session = {
        // ... existing fields ...
        pin: pin ?? null,
    };
}

// Saat joinSession — validasi PIN:
joinSession(sessionCode: string, peerSocketId: string, role: PeerRole, pin?: string | null) {
    const session = this.getSession(sessionCode);
    if (!session) throw new Error(ERROR_CODES.SESSION_NOT_FOUND);
    
    // PIN validation
    if (session.pin !== null) {
        if (!pin) throw new Error(ERROR_CODES.PIN_REQUIRED);
        if (pin !== session.pin) throw new Error(ERROR_CODES.INVALID_PIN);
    }
    // ... rest of existing code ...
}
```

### 2d. Update `packages/server/src/index.ts`

Pass PIN dari payload ke `createSession` dan `joinSession`.

### 2e. Update `packages/desktop/src/renderer/App.tsx`

Tambah input PIN opsional di UI Electron:
- Checkbox "Require PIN"
- Input field untuk PIN (4-6 digit)
- Kirim via IPC ke main process

### 2f. Update `packages/client/src/components/ConnectionForm.tsx`

Tambah input PIN opsional:
- Input field "Session PIN (if required)"
- Kirim PIN saat join session

### Verifikasi
1. Host buat session dengan PIN `1234`
2. Client coba join tanpa PIN → harus dapat error `PIN_REQUIRED`
3. Client join dengan PIN salah → harus dapat error `INVALID_PIN`
4. Client join dengan PIN benar → berhasil connect

---

## Task 3: Auto-reconnect — Prioritas Sedang 🟡

Jika koneksi WebRTC atau Socket.IO terputus, client otomatis mencoba reconnect.

### 3a. Update `packages/client/src/hooks/useSignaling.ts`

Socket.IO sudah punya `reconnection: true` — pastikan handler reconnect ada:

```typescript
socket.on('reconnect', (attemptNumber) => {
    console.log(`[Signaling] Reconnected after ${attemptNumber} attempts`);
    setIsConnected(true);
    // Re-join session after reconnect
    callbacksRef.current.onReconnected?.();
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`[Signaling] Reconnect attempt ${attemptNumber}...`);
    callbacksRef.current.onReconnecting?.();
});

socket.on('reconnect_failed', () => {
    console.error('[Signaling] Reconnect failed after all attempts');
    callbacksRef.current.onReconnectFailed?.();
});
```

Tambahkan callbacks baru ke `SignalingCallbacks` interface:
```typescript
export interface SignalingCallbacks {
    // ... existing callbacks ...
    onReconnected?: () => void;
    onReconnecting?: () => void;
    onReconnectFailed?: () => void;
}
```

### 3b. Update `packages/client/src/App.tsx`

Handle reconnect state:

```typescript
signaling.setCallbacks({
    // ... existing callbacks ...
    onReconnecting: () => {
        setAppState('reconnecting');
    },
    onReconnected: async () => {
        // Re-join session with same code and role
        try {
            const response = await signaling.joinSession(sessionCode, role);
            hostIdRef.current = response.hostId;
            // Re-establish WebRTC
            webrtc.connect(response.hostId, role, signaling.sendAnswer, signaling.sendIceCandidate);
        } catch (err) {
            setAppState('failed');
            setErrorMessage('Reconnection failed — session may have expired');
        }
    },
    onReconnectFailed: () => {
        setAppState('failed');
        setErrorMessage('Connection lost — could not reconnect');
    },
});
```

### 3c. Update `packages/client/src/components/StatusOverlay.tsx`

Pastikan state `reconnecting` menampilkan pesan yang informatif:
```tsx
{state === 'reconnecting' && (
    <div className="status-overlay">
        <Spinner />
        <p>Connection lost — reconnecting...</p>
    </div>
)}
```

### Verifikasi
1. Connect ke session
2. Matikan server sementara (Ctrl+C)
3. Nyalakan server kembali
4. Client harus otomatis reconnect dan join ulang session

---

## Urutan Pengerjaan yang Disarankan

1. **Task 1 (TURN)** — paling cepat, hanya edit 1 file
2. **Task 2 (PIN)** — lebih kompleks, butuh update 6 file
3. **Task 3 (Auto-reconnect)** — medium complexity, 3 file

---

## Setelah Selesai — Update Dokumentasi

Wajib update:
- `CHANGELOG.md` — tambahkan semua perubahan di `[Unreleased]`
- `README.md` — tambahkan PIN feature ke bagian "How to Use"
- `ARCHITECTURE.md` — update Socket Events table jika ada event baru

---

## 📋 Wajib: Update Dokumentasi Setelah Selesai

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

### Aturan Singkat
| Jenis Perubahan | File yang Diupdate |
|-----------------|-------------------|
| Bug fix | CHANGELOG.md |
| Fitur baru | CHANGELOG.md + README.md |
| Perubahan arsitektur | CHANGELOG.md + ARCHITECTURE.md |
| Semua perubahan | CHANGELOG.md (minimal) |
