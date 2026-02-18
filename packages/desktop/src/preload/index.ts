// ============================================================
// Preload — contextBridge to expose safe APIs to renderer
// Includes signaling bridge for WebRTC in renderer process
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';

export interface ConnectionInfo {
    connected: boolean;
    adminCount: number;
    viewerCount: number;
    totalPeers: number;
    sessionCode: string | null;
}

contextBridge.exposeInMainWorld('electronAPI', {
    // === Session UI ===
    onSessionCode: (cb: (code: string) => void) => {
        ipcRenderer.on('session-code', (_event, code) => cb(code));
    },
    onConnectionUpdate: (cb: (info: ConnectionInfo) => void) => {
        ipcRenderer.on('connection-update', (_event, info) => cb(info));
    },
    rendererReady: () => {
        ipcRenderer.send('renderer-ready');
    },
    generateNewCode: () => {
        ipcRenderer.send('generate-new-code');
    },
    stopSharing: () => {
        ipcRenderer.send('stop-sharing');
    },
    setExpiry: (ms: number | null) => {
        ipcRenderer.send('set-expiry', ms);
    },
    setPin: (pin: string | null) => {
        ipcRenderer.send('set-pin', pin);
    },

    // === Screen Capture ===
    getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),

    // === WebRTC Signaling Bridge ===
    getSocketId: () => ipcRenderer.invoke('get-socket-id'),

    // Receive signaling events from main process
    onPeerJoined: (cb: (data: any) => void) => {
        ipcRenderer.on('peer-joined', (_event, data) => cb(data));
    },
    onPeerLeft: (cb: (data: any) => void) => {
        ipcRenderer.on('peer-left', (_event, data) => cb(data));
    },
    onSignalAnswer: (cb: (data: any) => void) => {
        ipcRenderer.on('signal-answer', (_event, data) => cb(data));
    },
    onSignalIceCandidate: (cb: (data: any) => void) => {
        ipcRenderer.on('signal-ice-candidate', (_event, data) => cb(data));
    },
    onSessionExpired: (cb: () => void) => {
        ipcRenderer.on('session-expired', () => cb());
    },

    // Send signaling events to main process
    sendOffer: (data: any) => {
        ipcRenderer.send('signal-offer', data);
    },
    sendAnswer: (data: any) => {
        ipcRenderer.send('signal-answer', data);
    },
    sendIceCandidate: (data: any) => {
        ipcRenderer.send('signal-ice-candidate', data);
    },

    // Forward input from DataChannel to main process (for robotjs)
    handleInput: (msg: any) => {
        ipcRenderer.send('handle-input', msg);
    },
});
