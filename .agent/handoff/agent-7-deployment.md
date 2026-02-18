# Agent 7 — Production Deployment

## Misi
Deploy aplikasi ke production sehingga bisa diakses dari internet (bukan hanya LAN):
1. **Deploy signaling server** ke Railway (free tier)
2. **Update TURN server** ke Metered.ca personal credentials
3. **Deploy web client** ke Vercel (free tier)
4. **Update Electron** untuk connect ke server production

---

## ⚠️ BACA INI PERTAMA — Fix PATH (Wajib)

```powershell
$env:PATH = "C:\Users\Decimate\AppData\Roaming\npm;C:\Program Files\nodejs;" + $env:PATH
```

---

## Prasyarat — Sebelum Mulai

User harus sudah mendaftar dan mendapatkan credentials dari:

### 1. Railway — Signaling Server
- Daftar di: https://railway.app
- Free tier: tidak butuh kartu kredit
- Setelah daftar, install Railway CLI:
  ```powershell
  npm install -g @railway/cli
  railway login
  ```

### 2. Metered.ca — TURN Server
- Daftar di: https://www.metered.ca
- Free tier: 50 GB bandwidth/bulan
- Setelah daftar, buka dashboard → **TURN Credentials**
- Catat: `apiKey`, `username`, `credential`, dan daftar `urls`

### 3. Vercel — Web Client (Opsional)
- Daftar di: https://vercel.com
- Free tier: unlimited static sites
- Install CLI:
  ```powershell
  npm install -g vercel
  vercel login
  ```

---

## Task 1: Deploy Signaling Server ke Railway

### Step 1 — Pastikan project sudah di GitHub
```powershell
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop"
git status
```
Jika belum ada git repo:
```powershell
git init
git add .
git commit -m "Initial release v1.0.0"
```
Push ke GitHub (buat repo baru di github.com dulu):
```powershell
git remote add origin https://github.com/USERNAME/remote-desktop-app.git
git push -u origin main
```

### Step 2 — Deploy ke Railway via CLI
```powershell
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop\packages\server"
railway login
railway init
# Pilih "Create a new project" → nama: "remote-desktop-server"
railway up
```

### Step 3 — Dapatkan URL server
```powershell
railway open
```
Catat URL yang diberikan Railway, contoh: `https://remote-desktop-server.up.railway.app`

### Step 4 — Verifikasi server running
```powershell
curl https://remote-desktop-server.up.railway.app
```
**Expected**: `{"status":"ok","message":"Remote Desktop Signaling Server"}`

---

## Task 2: Update TURN Server ke Metered.ca

### File yang diubah: `packages/shared/src/constants.ts`

Ganti Open Relay credentials dengan Metered.ca personal credentials:

```typescript
export const ICE_SERVERS: RTCIceServer[] = [
    // STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // Metered.ca TURN servers (ganti dengan credentials dari dashboard)
    {
        urls: 'turn:YOUR_SUBDOMAIN.metered.ca:80',
        username: 'YOUR_USERNAME',
        credential: 'YOUR_CREDENTIAL',
    },
    {
        urls: 'turn:YOUR_SUBDOMAIN.metered.ca:443',
        username: 'YOUR_USERNAME',
        credential: 'YOUR_CREDENTIAL',
    },
    {
        urls: 'turns:YOUR_SUBDOMAIN.metered.ca:443',
        username: 'YOUR_USERNAME',
        credential: 'YOUR_CREDENTIAL',
    },
];
```

> Ganti `YOUR_SUBDOMAIN`, `YOUR_USERNAME`, `YOUR_CREDENTIAL` dengan nilai dari Metered.ca dashboard.

---

## Task 3: Update Server URL di Client dan Desktop

### 3a. Web Client — `packages/client/.env.production`

Buat file baru:
```env
VITE_SERVER_URL=https://remote-desktop-server.up.railway.app
```

### 3b. Verifikasi client menggunakan env var

Cek `packages/client/src/hooks/useSignaling.ts`:
```typescript
// Pastikan DEFAULT_SERVER_URL membaca dari env:
// Di packages/shared/src/constants.ts:
export const DEFAULT_SERVER_URL = 
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL
        ? import.meta.env.VITE_SERVER_URL
        : 'http://localhost:3000';
```

Jika belum, update `packages/shared/src/constants.ts` agar client bisa override via env var.

### 3c. Electron Desktop — Environment Variable

Untuk Electron, server URL dikonfigurasi di `packages/desktop/src/main/signaling.ts`.
Pastikan ada fallback ke production URL:
```typescript
const SERVER_URL = process.env['SERVER_URL'] ?? 'https://remote-desktop-server.up.railway.app';
```

---

## Task 4: Deploy Web Client ke Vercel

### Step 1 — Build client
```powershell
cd "c:\Users\Decimate\Documents\dev\majdi\remote dekstop"
pnpm --filter @remote-app/shared build
pnpm --filter @remote-app/client build
```

### Step 2 — Deploy ke Vercel
```powershell
cd packages/client
vercel --prod
```

Saat ditanya:
- **Set up and deploy?** → Y
- **Which scope?** → pilih akun Anda
- **Link to existing project?** → N
- **Project name?** → `remote-desktop-client`
- **Directory?** → `./`
- **Override build settings?** → N

### Step 3 — Catat URL Vercel
Contoh: `https://remote-desktop-client.vercel.app`

---

## Task 5: Test End-to-End dari Internet

### Checklist
- [ ] Buka `https://remote-desktop-client.vercel.app` dari browser (bukan localhost)
- [ ] Jalankan Electron desktop app di Windows
- [ ] Electron connect ke Railway server (bukan localhost)
- [ ] Masukkan session code di browser
- [ ] Video stream muncul di browser
- [ ] Jika di jaringan berbeda (beda WiFi/hotspot) → test TURN server bekerja

---

## Task 6: Update Dokumentasi

### Update `README.md`
Tambahkan bagian "Production URLs":
```markdown
## 🌐 Production

- **Web Client**: https://remote-desktop-client.vercel.app
- **Signaling Server**: https://remote-desktop-server.up.railway.app
```

### Update `DEPLOYMENT.md`
Isi bagian yang masih placeholder dengan URL aktual.

### Update `CHANGELOG.md`
```markdown
## [Unreleased]

### Added
- Production deployment: signaling server on Railway
- Production deployment: web client on Vercel
- Metered.ca TURN server for NAT traversal
- VITE_SERVER_URL environment variable for web client
```

---

## 📋 Wajib: Update Dokumentasi Setelah Selesai

| Jenis Perubahan | File yang Diupdate |
|-----------------|-------------------|
| Deploy baru | CHANGELOG.md + README.md + DEPLOYMENT.md |
| Perubahan config | CHANGELOG.md |
| Semua perubahan | CHANGELOG.md (minimal) |
