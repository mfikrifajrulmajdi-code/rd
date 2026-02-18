// ============================================================
// @remote-app/server — Peer Manager
// Tracks all connected peers (host, admin, viewer) by socket ID
// ============================================================

import type { PeerRole } from '@remote-app/shared';

export interface PeerInfo {
    socketId: string;
    role: PeerRole;
    sessionCode: string;
}

const peers = new Map<string, PeerInfo>();

/**
 * Register a new peer.
 */
export function addPeer(socketId: string, info: PeerInfo): void {
    peers.set(socketId, info);
    console.log(`[PeerManager] Added peer ${socketId} as ${info.role} in session ${info.sessionCode}`);
}

/**
 * Remove a peer by socket ID.
 */
export function removePeer(socketId: string): PeerInfo | undefined {
    const peer = peers.get(socketId);
    if (peer) {
        peers.delete(socketId);
        console.log(`[PeerManager] Removed peer ${socketId} (${peer.role}) from session ${peer.sessionCode}`);
    }
    return peer;
}

/**
 * Get peer info by socket ID.
 */
export function getPeer(socketId: string): PeerInfo | undefined {
    return peers.get(socketId);
}

/**
 * Get all peers in a specific session.
 */
export function getPeersBySession(code: string): PeerInfo[] {
    const result: PeerInfo[] = [];
    for (const peer of peers.values()) {
        if (peer.sessionCode === code) {
            result.push(peer);
        }
    }
    return result;
}
