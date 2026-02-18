// ============================================================
// Electron Main Process — App entry point
// Handles signaling (Socket.IO), input (robotjs), and IPC bridge
// WebRTC + capture run in the renderer (browser APIs)
// ============================================================

import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path from 'node:path';
import {
    SOCKET_EVENTS,
    SESSION_EXPIRY,
    type RegisterHostResponse,
    type PeerJoinedPayload,
    type PeerLeftPayload,
    type SignalPayload,
    type InputMessage,
} from '@remote-app/shared';
import { connectToServer, registerAsHost, type TypedSocket } from './signaling';
import { getScreenSources } from './capture';
import { handleInput } from './input-handler';

// === State ===
let mainWindow: BrowserWindow | null = null;
let socket: TypedSocket | null = null;
let sessionCode: string | null = null;
let expiryMs: number | null = SESSION_EXPIRY.DEFAULT_MS;
let sessionPin: string | null = null;
const peers = new Map<string, { peerId: string; role: string }>();

// === Window Creation ===
function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 480,
        height: 600,
        minWidth: 400,
        minHeight: 500,
        title: 'Remote Desktop Host',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Allow screen capture in renderer
    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
        mainWindow!.webContents.send('get-screen-source');
        // The renderer will use getUserMedia with the source ID directly
        callback({ video: mainWindow!.webContents });
    });

    // Load renderer
    if (process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// === Send status update to renderer ===
function sendConnectionUpdate(): void {
    if (!mainWindow) return;

    const adminCount = Array.from(peers.values()).filter((p) => p.role === 'admin').length;
    const viewerCount = Array.from(peers.values()).filter((p) => p.role === 'viewer').length;

    mainWindow.webContents.send('connection-update', {
        connected: socket?.connected ?? false,
        adminCount,
        viewerCount,
        totalPeers: peers.size,
        sessionCode,
    });
}

// === Connect and set up signaling ===
async function startSignaling(): Promise<void> {
    socket = connectToServer();

    // Handle host registration response
    socket.on(SOCKET_EVENTS.REGISTER_HOST_RESPONSE, (data: RegisterHostResponse) => {
        sessionCode = data.sessionCode;
        console.log(`Session code: ${sessionCode}`);
        mainWindow?.webContents.send('session-code', sessionCode);
        sendConnectionUpdate();
    });

    // Handle new peer joining — forward to renderer for WebRTC
    socket.on(SOCKET_EVENTS.PEER_JOINED, (data: PeerJoinedPayload) => {
        console.log(`Peer connected: ${data.peerId} as ${data.role}`);
        peers.set(data.peerId, { peerId: data.peerId, role: data.role });
        mainWindow?.webContents.send('peer-joined', data);
        sendConnectionUpdate();
    });

    // Handle peer leaving
    socket.on(SOCKET_EVENTS.PEER_LEFT, (data: PeerLeftPayload) => {
        console.log(`Peer disconnected: ${data.peerId}`);
        peers.delete(data.peerId);
        mainWindow?.webContents.send('peer-left', data);
        sendConnectionUpdate();
    });

    // Forward SDP answer from remote peer to renderer
    socket.on(SOCKET_EVENTS.ANSWER, (data: SignalPayload) => {
        mainWindow?.webContents.send('signal-answer', data);
    });

    // Forward ICE candidates from remote peer to renderer
    socket.on(SOCKET_EVENTS.ICE_CANDIDATE, (data: SignalPayload) => {
        mainWindow?.webContents.send('signal-ice-candidate', data);
    });

    // Handle session expired
    socket.on(SOCKET_EVENTS.SESSION_EXPIRED, () => {
        console.log('Session expired');
        sessionCode = null;
        peers.clear();
        mainWindow?.webContents.send('session-code', '');
        mainWindow?.webContents.send('session-expired');
        sendConnectionUpdate();
    });

    // Handle error
    socket.on(SOCKET_EVENTS.ERROR, (data) => {
        console.error(`Server error: [${data.code}] ${data.message}`);
    });

    // Register as host once connected
    socket.on('connect', () => {
        registerAsHost(socket!, expiryMs, sessionPin);
        sendConnectionUpdate();
    });
}

// === IPC Handlers ===
function setupIPC(): void {
    // Renderer signals it's ready — resend current session code to fix race condition
    // (session-code IPC may fire before renderer registers its listener)
    ipcMain.on('renderer-ready', () => {
        if (sessionCode) {
            mainWindow?.webContents.send('session-code', sessionCode);
        }
        sendConnectionUpdate();
    });

    // Generate a new session code
    ipcMain.on('generate-new-code', () => {
        peers.clear();
        if (socket?.connected) {
            registerAsHost(socket, expiryMs, sessionPin);
        } else {
            // Socket was disconnected (e.g. after Stop Sharing) — reconnect first
            socket = connectToServer();
            socket.on(SOCKET_EVENTS.REGISTER_HOST_RESPONSE, (data: RegisterHostResponse) => {
                sessionCode = data.sessionCode;
                console.log(`Session code: ${sessionCode}`);
                mainWindow?.webContents.send('session-code', sessionCode);
                sendConnectionUpdate();
            });
            socket.on('connect', () => {
                registerAsHost(socket!, expiryMs, sessionPin);
                sendConnectionUpdate();
            });
        }
    });

    // Set session PIN (null = no PIN required)
    ipcMain.on('set-pin', (_event, pin: string | null) => {
        sessionPin = pin && pin.trim().length > 0 ? pin.trim() : null;
        console.log(`Session PIN set to: ${sessionPin ? '****' : 'none'}`);
    });

    // Stop sharing
    ipcMain.on('stop-sharing', () => {
        peers.clear();
        sessionCode = null;
        mainWindow?.webContents.send('session-code', '');
        sendConnectionUpdate();
        if (socket?.connected) {
            socket.disconnect();
        }
    });

    // Set session expiry
    ipcMain.on('set-expiry', (_event, ms: number | null) => {
        expiryMs = ms;
        console.log(`Session expiry set to: ${ms ? `${ms / 1000}s` : 'never'}`);
    });

    // Get screen sources for the renderer
    ipcMain.handle('get-screen-sources', async () => {
        return getScreenSources();
    });

    // Forward SDP offer from renderer to signaling server
    ipcMain.on('signal-offer', (_event, data: SignalPayload) => {
        socket?.emit(SOCKET_EVENTS.OFFER, data);
    });

    // Forward SDP answer from renderer to signaling server
    ipcMain.on('signal-answer', (_event, data: SignalPayload) => {
        socket?.emit(SOCKET_EVENTS.ANSWER, data);
    });

    // Forward ICE candidate from renderer to signaling server
    ipcMain.on('signal-ice-candidate', (_event, data: SignalPayload) => {
        socket?.emit(SOCKET_EVENTS.ICE_CANDIDATE, data);
    });

    // Get socket ID for renderer
    ipcMain.handle('get-socket-id', () => {
        return socket?.id ?? null;
    });

    // Handle input from DataChannel (forwarded from renderer)
    ipcMain.on('handle-input', (_event, msg: InputMessage) => {
        handleInput(msg);
    });
}

// === App Lifecycle ===
app.whenReady().then(async () => {
    createWindow();
    setupIPC();
    await startSignaling();
});

app.on('window-all-closed', () => {
    socket?.disconnect();
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
