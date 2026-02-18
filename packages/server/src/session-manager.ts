// ============================================================
// @remote-app/server — Session Manager
// Manages session lifecycle: create, join, remove, expiry
// ============================================================

import type { SessionInfo, PeerRole } from '@remote-app/shared';
import { generateSessionCode, isValidSessionCode, ERROR_CODES } from '@remote-app/shared';

// Active sessions keyed by session code
const sessions = new Map<string, SessionInfo>();

// Expiry timers keyed by session code
const expiryTimers = new Map<string, NodeJS.Timeout>();

// Session PINs stored server-side (not exposed to clients)
const sessionPins = new Map<string, string | null>();

/**
 * Callback invoked when a session expires.
 * Set via setOnSessionExpired() from index.ts.
 */
let _onSessionExpired: ((session: SessionInfo) => void) | null = null;

export function setOnSessionExpired(cb: (session: SessionInfo) => void): void {
    _onSessionExpired = cb;
}

/**
 * Create a new session for a host.
 * Generates a unique session code and starts an expiry timer if applicable.
 * @param pin - Optional PIN to protect the session. null = no PIN required.
 */
export function createSession(hostId: string, expiresInMs: number | null, pin?: string | null): SessionInfo {
    // Generate a unique code (retry if collision — effectively impossible)
    let code = generateSessionCode();
    while (sessions.has(code)) {
        code = generateSessionCode();
    }

    const now = Date.now();
    const session: SessionInfo = {
        code,
        hostId,
        createdAt: now,
        expiresAt: expiresInMs != null ? now + expiresInMs : null,
        adminId: null,
        viewerIds: [],
    };

    sessions.set(code, session);
    sessionPins.set(code, pin ?? null);
    const pinStatus = pin ? 'PIN protected' : 'no PIN';
    console.log(`[SessionManager] Session created: ${code} (host: ${hostId}, expires: ${expiresInMs ?? 'never'}, ${pinStatus})`);

    // Start expiry timer if applicable
    if (expiresInMs != null) {
        const timer = setTimeout(() => {
            console.log(`[SessionManager] Session expired: ${code}`);
            const expiredSession = sessions.get(code);
            if (expiredSession && _onSessionExpired) {
                _onSessionExpired(expiredSession);
            }
            removeSession(code);
        }, expiresInMs);

        expiryTimers.set(code, timer);
    }

    return session;
}

/**
 * Join an existing session as admin or viewer.
 * Returns the session info on success, or an error code string on failure.
 * @param pin - PIN provided by the joining peer. Required if session has a PIN.
 */
export function joinSession(
    code: string,
    peerId: string,
    role: 'admin' | 'viewer',
    pin?: string | null
): SessionInfo | string {
    // Validate code format
    if (!isValidSessionCode(code)) {
        return ERROR_CODES.INVALID_CODE;
    }

    const session = sessions.get(code);
    if (!session) {
        return ERROR_CODES.SESSION_NOT_FOUND;
    }

    // Check if expired
    if (session.expiresAt !== null && Date.now() > session.expiresAt) {
        return ERROR_CODES.SESSION_EXPIRED;
    }

    // PIN validation
    const sessionPin = sessionPins.get(code);
    if (sessionPin !== null && sessionPin !== undefined) {
        if (!pin) {
            return ERROR_CODES.PIN_REQUIRED;
        }
        if (pin !== sessionPin) {
            return ERROR_CODES.INVALID_PIN;
        }
    }

    // Check admin slot
    if (role === 'admin' && session.adminId !== null) {
        return ERROR_CODES.ADMIN_ALREADY_EXISTS;
    }

    // Add peer to session
    if (role === 'admin') {
        session.adminId = peerId;
        console.log(`[SessionManager] Admin ${peerId} joined session ${code}`);
    } else {
        session.viewerIds.push(peerId);
        console.log(`[SessionManager] Viewer ${peerId} joined session ${code}`);
    }

    return session;
}

/**
 * Remove a session and clear its expiry timer.
 */
export function removeSession(code: string): void {
    // Clear expiry timer
    const timer = expiryTimers.get(code);
    if (timer) {
        clearTimeout(timer);
        expiryTimers.delete(code);
    }

    sessions.delete(code);
    sessionPins.delete(code);
    console.log(`[SessionManager] Session removed: ${code}`);
}

/**
 * Remove a peer from their session.
 * If the peer is the host, the entire session is removed.
 * Returns the session code if found, undefined otherwise.
 */
export function removePeerFromSession(socketId: string): { session: SessionInfo; wasHost: boolean } | undefined {
    for (const session of sessions.values()) {
        // Check if this peer is the host
        if (session.hostId === socketId) {
            return { session: { ...session }, wasHost: true };
        }

        // Check if admin
        if (session.adminId === socketId) {
            session.adminId = null;
            return { session, wasHost: false };
        }

        // Check if viewer
        const viewerIndex = session.viewerIds.indexOf(socketId);
        if (viewerIndex !== -1) {
            session.viewerIds.splice(viewerIndex, 1);
            return { session, wasHost: false };
        }
    }

    return undefined;
}

/**
 * Get a session by code.
 */
export function getSession(code: string): SessionInfo | undefined {
    return sessions.get(code);
}
