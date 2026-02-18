// ============================================================
// @remote-app/server — Entry Point
// Socket.IO signaling server for remote desktop
// ============================================================

import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import {
    SOCKET_EVENTS,
    ERROR_CODES,
    type RegisterHostPayload,
    type RegisterHostResponse,
    type JoinSessionPayload,
    type JoinSessionResponse,
    type SignalPayload,
    type PeerJoinedPayload,
    type PeerLeftPayload,
    type ErrorPayload,
    type SessionInfo,
} from '@remote-app/shared';
import {
    createSession,
    joinSession,
    removeSession,
    removePeerFromSession,
    setOnSessionExpired,
} from './session-manager.js';
import {
    addPeer,
    removePeer,
    getPeer,
    getPeersBySession,
} from './peer-manager.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const PORT = process.env.PORT || 3000;

// --- HTTP Health Check ---
app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'Remote Desktop Signaling Server' });
});

// --- Session Expiry Handler ---
setOnSessionExpired((session: SessionInfo) => {
    console.log(`[Server] Session expired: ${session.code}`);

    // Notify all peers in the session
    const peers = getPeersBySession(session.code);
    for (const peer of peers) {
        const peerSocket = io.sockets.sockets.get(peer.socketId);
        if (peerSocket) {
            peerSocket.emit(SOCKET_EVENTS.SESSION_EXPIRED);
            peerSocket.disconnect(true);
        }
        removePeer(peer.socketId);
    }

    // Also disconnect the host
    const hostSocket = io.sockets.sockets.get(session.hostId);
    if (hostSocket) {
        hostSocket.emit(SOCKET_EVENTS.SESSION_EXPIRED);
        hostSocket.disconnect(true);
    }
    removePeer(session.hostId);
});

// --- Socket.IO Connection Handler ---
io.on('connection', (socket) => {
    console.log(`[Server] Peer connected: ${socket.id}`);

    // === Host Registration ===
    socket.on(SOCKET_EVENTS.REGISTER_HOST, (data: RegisterHostPayload) => {
        console.log(`[Server] register-host from ${socket.id}`, data);

        const session = createSession(socket.id, data.expiresInMs);

        // Register the host peer
        addPeer(socket.id, {
            socketId: socket.id,
            role: 'host',
            sessionCode: session.code,
        });

        const response: RegisterHostResponse = {
            sessionCode: session.code,
            hostId: socket.id,
        };

        socket.emit(SOCKET_EVENTS.REGISTER_HOST_RESPONSE, response);
        console.log(`[Server] Session created: ${session.code} → host ${socket.id}`);
    });

    // === Join Session (Admin / Viewer) ===
    socket.on(SOCKET_EVENTS.JOIN_SESSION, (data: JoinSessionPayload) => {
        console.log(`[Server] join-session from ${socket.id}`, data);

        const result = joinSession(data.sessionCode, socket.id, data.role);

        // If result is a string, it's an error code
        if (typeof result === 'string') {
            const error: ErrorPayload = {
                code: result,
                message: `Failed to join session: ${result}`,
            };
            socket.emit(SOCKET_EVENTS.ERROR, error);
            console.log(`[Server] Join failed for ${socket.id}: ${result}`);
            return;
        }

        // Register the peer
        addPeer(socket.id, {
            socketId: socket.id,
            role: data.role,
            sessionCode: result.code,
        });

        // Send response to the joining client
        const response: JoinSessionResponse = {
            hostId: result.hostId,
            peerId: socket.id,
            viewers: result.viewerIds,
        };
        socket.emit(SOCKET_EVENTS.JOIN_SESSION_RESPONSE, response);

        // Notify the host that a new peer joined
        const hostSocket = io.sockets.sockets.get(result.hostId);
        if (hostSocket) {
            const peerJoined: PeerJoinedPayload = {
                peerId: socket.id,
                role: data.role,
            };
            hostSocket.emit(SOCKET_EVENTS.PEER_JOINED, peerJoined);
        }

        console.log(`[Server] ${data.role} ${socket.id} joined session ${result.code}`);
    });

    // === WebRTC Signaling Relay ===

    socket.on(SOCKET_EVENTS.OFFER, (data: SignalPayload) => {
        console.log(`[Server] Relaying offer from ${data.senderId} to ${data.targetId}`);
        const targetSocket = io.sockets.sockets.get(data.targetId);
        if (targetSocket) {
            targetSocket.emit(SOCKET_EVENTS.OFFER, data);
        }
    });

    socket.on(SOCKET_EVENTS.ANSWER, (data: SignalPayload) => {
        console.log(`[Server] Relaying answer from ${data.senderId} to ${data.targetId}`);
        const targetSocket = io.sockets.sockets.get(data.targetId);
        if (targetSocket) {
            targetSocket.emit(SOCKET_EVENTS.ANSWER, data);
        }
    });

    socket.on(SOCKET_EVENTS.ICE_CANDIDATE, (data: SignalPayload) => {
        console.log(`[Server] Relaying ICE candidate from ${data.senderId} to ${data.targetId}`);
        const targetSocket = io.sockets.sockets.get(data.targetId);
        if (targetSocket) {
            targetSocket.emit(SOCKET_EVENTS.ICE_CANDIDATE, data);
        }
    });

    // === Disconnect Cleanup ===
    socket.on('disconnect', () => {
        console.log(`[Server] Peer disconnected: ${socket.id}`);

        const peerInfo = getPeer(socket.id);
        if (!peerInfo) {
            return;
        }

        const sessionResult = removePeerFromSession(socket.id);
        removePeer(socket.id);

        if (!sessionResult) {
            return;
        }

        if (sessionResult.wasHost) {
            // Host disconnected — notify all peers and remove session
            console.log(`[Server] Host ${socket.id} left, removing session ${sessionResult.session.code}`);
            const sessionPeers = getPeersBySession(sessionResult.session.code);
            for (const peer of sessionPeers) {
                const peerSocket = io.sockets.sockets.get(peer.socketId);
                if (peerSocket) {
                    const peerLeft: PeerLeftPayload = { peerId: socket.id };
                    peerSocket.emit(SOCKET_EVENTS.PEER_LEFT, peerLeft);
                }
                removePeer(peer.socketId);
            }
            removeSession(sessionResult.session.code);
        } else {
            // Admin/Viewer disconnected — notify host
            console.log(`[Server] ${peerInfo.role} ${socket.id} left session ${peerInfo.sessionCode}`);
            const hostSocket = io.sockets.sockets.get(sessionResult.session.hostId);
            if (hostSocket) {
                const peerLeft: PeerLeftPayload = { peerId: socket.id };
                hostSocket.emit(SOCKET_EVENTS.PEER_LEFT, peerLeft);
            }
        }
    });
});

// --- Start Server ---
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
