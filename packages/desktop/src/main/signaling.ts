// ============================================================
// Signaling Client — Socket.IO connection to signaling server
// ============================================================

import { io, Socket } from 'socket.io-client';
import {
    SOCKET_EVENTS,
    DEFAULT_SERVER_URL,
    type ServerToClientEvents,
    type ClientToServerEvents,
} from '@remote-app/shared';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Connect to the signaling server via Socket.IO.
 *
 * @param serverUrl - URL of the signaling server (default: localhost:3000)
 * @returns Connected Socket instance
 */
export function connectToServer(
    serverUrl: string = DEFAULT_SERVER_URL
): TypedSocket {
    const socket: TypedSocket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log(`Connected to signaling server: ${serverUrl} (id: ${socket.id})`);
    });

    socket.on('disconnect', (reason) => {
        console.log(`Disconnected from signaling server: ${reason}`);
    });

    socket.on('connect_error', (err) => {
        console.error(`Failed to connect to signaling server: ${err.message}`);
    });

    return socket;
}

/**
 * Register this client as a host on the signaling server.
 * The server responds with a session code via 'register-host-response' event.
 *
 * @param socket - Connected Socket instance
 * @param expiresInMs - Session expiry in ms, or null for no expiry
 */
export function registerAsHost(
    socket: TypedSocket,
    expiresInMs: number | null
): void {
    socket.emit(SOCKET_EVENTS.REGISTER_HOST, {
        peerId: socket.id!,
        expiresInMs,
    });
}
