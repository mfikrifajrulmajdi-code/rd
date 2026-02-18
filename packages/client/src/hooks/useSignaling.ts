import { useRef, useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    SOCKET_EVENTS,
    DEFAULT_SERVER_URL,
    type JoinSessionPayload,
    type JoinSessionResponse,
    type SignalPayload,
    type ErrorPayload,
    type PeerJoinedPayload,
    type PeerLeftPayload,
    type ServerToClientEvents,
    type ClientToServerEvents,
} from '@remote-app/shared';

export interface SignalingCallbacks {
    onOffer?: (data: SignalPayload) => void;
    onAnswer?: (data: SignalPayload) => void;
    onIceCandidate?: (data: SignalPayload) => void;
    onPeerLeft?: (data: PeerLeftPayload) => void;
    onSessionExpired?: () => void;
    onError?: (data: ErrorPayload) => void;
    // Auto-reconnect callbacks
    onReconnecting?: () => void;
    onReconnected?: () => void;
    onReconnectFailed?: () => void;
}

export function useSignaling(serverUrl: string = DEFAULT_SERVER_URL) {
    const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
    const callbacksRef = useRef<SignalingCallbacks>({});
    const [isConnected, setIsConnected] = useState(false);

    const setCallbacks = useCallback((cbs: SignalingCallbacks) => {
        callbacksRef.current = cbs;
    }, []);

    const connect = useCallback(() => {
        if (socketRef.current?.connected) return socketRef.current;

        const socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,
        });

        socket.on('connect', () => {
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        // Signal relay handlers
        socket.on(SOCKET_EVENTS.OFFER, (data: SignalPayload) => {
            callbacksRef.current.onOffer?.(data);
        });

        socket.on(SOCKET_EVENTS.ANSWER, (data: SignalPayload) => {
            callbacksRef.current.onAnswer?.(data);
        });

        socket.on(SOCKET_EVENTS.ICE_CANDIDATE, (data: SignalPayload) => {
            callbacksRef.current.onIceCandidate?.(data);
        });

        socket.on(SOCKET_EVENTS.PEER_LEFT, (data: PeerLeftPayload) => {
            callbacksRef.current.onPeerLeft?.(data);
        });

        socket.on(SOCKET_EVENTS.SESSION_EXPIRED, () => {
            callbacksRef.current.onSessionExpired?.();
        });

        socket.on(SOCKET_EVENTS.ERROR, (data: ErrorPayload) => {
            callbacksRef.current.onError?.(data);
        });

        // Reconnect event handlers (Socket.IO built-in)
        socket.on('reconnect', (attemptNumber: number) => {
            console.log(`[Signaling] Reconnected after ${attemptNumber} attempt(s)`);
            setIsConnected(true);
            callbacksRef.current.onReconnected?.();
        });

        socket.on('reconnect_attempt', (attemptNumber: number) => {
            console.log(`[Signaling] Reconnect attempt ${attemptNumber}...`);
            callbacksRef.current.onReconnecting?.();
        });

        socket.on('reconnect_failed', () => {
            console.error('[Signaling] Reconnect failed after all attempts');
            callbacksRef.current.onReconnectFailed?.();
        });

        socketRef.current = socket;
        return socket;
    }, [serverUrl]);


    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        }
    }, []);

    const joinSession = useCallback(
        (sessionCode: string, role: 'admin' | 'viewer', pin?: string): Promise<JoinSessionResponse> => {
            return new Promise((resolve, reject) => {
                const socket = socketRef.current;
                if (!socket?.connected) {
                    reject(new Error('Socket not connected'));
                    return;
                }

                const timeout = setTimeout(() => {
                    socket.off(SOCKET_EVENTS.JOIN_SESSION_RESPONSE);
                    socket.off(SOCKET_EVENTS.ERROR);
                    reject(new Error('Join session timeout'));
                }, 10000);

                // Listen for the response
                socket.once(SOCKET_EVENTS.JOIN_SESSION_RESPONSE, (data: JoinSessionResponse) => {
                    clearTimeout(timeout);
                    socket.off(SOCKET_EVENTS.ERROR);
                    resolve(data);
                });

                socket.once(SOCKET_EVENTS.ERROR, (data: ErrorPayload) => {
                    clearTimeout(timeout);
                    socket.off(SOCKET_EVENTS.JOIN_SESSION_RESPONSE);
                    reject(new Error(data.message || data.code));
                });

                const payload: JoinSessionPayload = { sessionCode, role, pin: pin ?? null };
                socket.emit(SOCKET_EVENTS.JOIN_SESSION, payload);
            });
        },
        []
    );

    const sendOffer = useCallback((targetId: string, sdp: string) => {
        socketRef.current?.emit(SOCKET_EVENTS.OFFER, {
            targetId,
            senderId: socketRef.current.id || '',
            signal: { type: 'offer' as const, sdp },
        });
    }, []);

    const sendAnswer = useCallback((targetId: string, sdp: string) => {
        socketRef.current?.emit(SOCKET_EVENTS.ANSWER, {
            targetId,
            senderId: socketRef.current.id || '',
            signal: { type: 'answer' as const, sdp },
        });
    }, []);

    const sendIceCandidate = useCallback(
        (targetId: string, candidate: RTCIceCandidate) => {
            socketRef.current?.emit(SOCKET_EVENTS.ICE_CANDIDATE, {
                targetId,
                senderId: socketRef.current.id || '',
                signal: {
                    candidate: candidate.candidate,
                    sdpMid: candidate.sdpMid,
                    sdpMLineIndex: candidate.sdpMLineIndex,
                },
            });
        },
        []
    );

    const getSocketId = useCallback(() => {
        return socketRef.current?.id || null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        socket: socketRef,
        isConnected,
        connect,
        disconnect,
        joinSession,
        sendOffer,
        sendAnswer,
        sendIceCandidate,
        setCallbacks,
        getSocketId,
    };
}
