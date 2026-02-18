// ============================================================
// @remote-app/shared — Constants
// Event names, ICE servers, and default configs
// ============================================================

/**
 * Socket.IO event names — used by both server and clients.
 * Always reference these constants instead of string literals.
 */
export const SOCKET_EVENTS = {
    // Host registration
    REGISTER_HOST: 'register-host',
    REGISTER_HOST_RESPONSE: 'register-host-response',

    // Session join (admin/viewer)
    JOIN_SESSION: 'join-session',
    JOIN_SESSION_RESPONSE: 'join-session-response',

    // WebRTC signaling
    OFFER: 'offer',
    ANSWER: 'answer',
    ICE_CANDIDATE: 'ice-candidate',

    // Peer lifecycle
    PEER_JOINED: 'peer-joined',
    PEER_LEFT: 'peer-left',

    // Session management
    SESSION_EXPIRED: 'session-expired',

    // Error
    ERROR: 'error',
} as const;

/**
 * WebRTC DataChannel names
 */
export const DATA_CHANNELS = {
    INPUT: 'input',
} as const;

/**
 * ICE servers for WebRTC NAT traversal.
 * Includes Google STUN servers and Open Relay TURN servers (free, no registration required).
 * Replace Open Relay credentials with personal Metered.ca credentials for production.
 */
export const ICE_SERVERS: RTCIceServer[] = [
    // STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },

    // Open Relay TURN servers (free fallback for symmetric NAT)
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

/**
 * Default video constraints — optimized for low-latency.
 * 720p @ 30fps as baseline; adaptive quality may adjust at runtime.
 */
export const DEFAULT_VIDEO_CONFIG = {
    width: 1280,
    height: 720,
    frameRate: 30,
} as const;

/**
 * Input throttle settings (events per second)
 */
export const INPUT_THROTTLE = {
    MOUSE_MOVE: 30,   // 30 events/sec — smooth enough
    MOUSE_SCROLL: 20, // 20 events/sec
} as const;

/**
 * Session code config
 */
export const SESSION_CODE = {
    /** Number of segments: ABC-DEF-GHI = 3 */
    SEGMENTS: 3,
    /** Characters per segment */
    SEGMENT_LENGTH: 3,
    /** Separator between segments */
    SEPARATOR: '-',
    /** Allowed characters (no ambiguous chars like O/0, I/1) */
    CHARSET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
} as const;

/**
 * Default session expiry (milliseconds)
 */
export const SESSION_EXPIRY = {
    DEFAULT_MS: 10 * 60 * 1000, // 10 minutes
    NEVER: null,
} as const;

/**
 * Default signaling server URL
 */
export const DEFAULT_SERVER_URL = 'http://localhost:3000';

/**
 * Error codes
 */
export const ERROR_CODES = {
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    SESSION_FULL: 'SESSION_FULL',
    INVALID_CODE: 'INVALID_CODE',
    PEER_NOT_FOUND: 'PEER_NOT_FOUND',
    HOST_ALREADY_EXISTS: 'HOST_ALREADY_EXISTS',
    ADMIN_ALREADY_EXISTS: 'ADMIN_ALREADY_EXISTS',
    // PIN authentication
    PIN_REQUIRED: 'PIN_REQUIRED',
    INVALID_PIN: 'INVALID_PIN',
} as const;
