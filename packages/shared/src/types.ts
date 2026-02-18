// ============================================================
// @remote-app/shared — Types
// All interfaces shared across server, desktop, and client
// ============================================================

// === Peer Roles ===
export type PeerRole = 'host' | 'admin' | 'viewer';

// === Socket.IO Event Payloads ===

export interface RegisterPayload {
    peerId: string;
    role: PeerRole;
    sessionCode: string;
}

export interface RegisterHostPayload {
    peerId: string;
    /** null = no expiry */
    expiresInMs: number | null;
    /** Optional PIN to protect the session. null = no PIN required */
    pin?: string | null;
}

export interface RegisterHostResponse {
    sessionCode: string;
    hostId: string;
}

export interface JoinSessionPayload {
    sessionCode: string;
    role: 'admin' | 'viewer';
    /** PIN required if the session was created with one */
    pin?: string | null;
}

export interface JoinSessionResponse {
    hostId: string;
    peerId: string;
    viewers: string[];
}

export interface SignalPayload {
    targetId: string;
    senderId: string;
    signal: SDPPayload | ICEPayload;
}

export interface SDPPayload {
    type: 'offer' | 'answer';
    sdp: string;
}

export interface ICEPayload {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
}

export interface PeerJoinedPayload {
    peerId: string;
    role: PeerRole;
}

export interface PeerLeftPayload {
    peerId: string;
}

export interface ErrorPayload {
    code: string;
    message: string;
}

// === Session ===

export interface SessionInfo {
    /** Format: "ABC-DEF-GHI" */
    code: string;
    hostId: string;
    createdAt: number;
    /** null = no expiry */
    expiresAt: number | null;
    adminId: string | null;
    viewerIds: string[];
}

// === DataChannel Messages ===

export type InputMessageType =
    | 'mouse-move'
    | 'mouse-click'
    | 'mouse-down'
    | 'mouse-up'
    | 'mouse-scroll'
    | 'key-press'
    | 'key-release';

export type MouseButton = 'left' | 'right' | 'middle';

export interface InputMessage {
    /** Message type */
    t: InputMessageType;
    /** Normalized X coordinate (0.0 - 1.0) */
    x?: number;
    /** Normalized Y coordinate (0.0 - 1.0) */
    y?: number;
    /** Mouse button */
    b?: MouseButton;
    /** Scroll delta */
    d?: number;
    /** Key code */
    k?: string;
    /** Timestamp */
    ts: number;
}

// === Connection State ===

export type ConnectionState =
    | 'disconnected'
    | 'connecting'
    | 'waiting'
    | 'connected'
    | 'reconnecting'
    | 'failed';

export interface PeerConnection {
    peerId: string;
    role: PeerRole;
    state: ConnectionState;
}

// === Video Config ===

export interface VideoConfig {
    width: number;
    height: number;
    frameRate: number;
}

// === Socket.IO Event Map (for type-safe events) ===

export interface ServerToClientEvents {
    [key: string]: (...args: any[]) => void;
    'register-host-response': (data: RegisterHostResponse) => void;
    'join-session-response': (data: JoinSessionResponse) => void;
    'offer': (data: SignalPayload) => void;
    'answer': (data: SignalPayload) => void;
    'ice-candidate': (data: SignalPayload) => void;
    'peer-joined': (data: PeerJoinedPayload) => void;
    'peer-left': (data: PeerLeftPayload) => void;
    'session-expired': () => void;
    'error': (data: ErrorPayload) => void;
}

export interface ClientToServerEvents {
    [key: string]: (...args: any[]) => void;
    'register-host': (data: RegisterHostPayload) => void;
    'join-session': (data: JoinSessionPayload) => void;
    'offer': (data: SignalPayload) => void;
    'answer': (data: SignalPayload) => void;
    'ice-candidate': (data: SignalPayload) => void;
}
