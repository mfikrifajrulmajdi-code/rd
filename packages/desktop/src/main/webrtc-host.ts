// ============================================================
// WebRTC Host — type definitions and helper constants
// Actual WebRTC peer connections run in the renderer process
// (RTCPeerConnection is a browser API, not available in Node)
// ============================================================

import type { PeerRole } from '@remote-app/shared';

export interface PeerEntry {
    peerId: string;
    role: PeerRole;
}

// Re-export shared WebRTC constants for convenience
export { ICE_SERVERS, DATA_CHANNELS } from '@remote-app/shared';
