import { useState, useCallback, useEffect, useRef } from 'react';
import type { ConnectionState, SignalPayload, PeerLeftPayload, ErrorPayload } from '@remote-app/shared';
import { useSignaling } from './hooks/useSignaling';
import { useWebRTC } from './hooks/useWebRTC';
import ConnectionForm from './components/ConnectionForm';
import VideoPlayer from './components/VideoPlayer';
import Toolbar from './components/Toolbar';
import StatusOverlay from './components/StatusOverlay';

type AppState = 'disconnected' | 'connecting' | 'waiting' | 'connected' | 'reconnecting' | 'failed';

export default function App() {
    const [appState, setAppState] = useState<AppState>('disconnected');
    const [sessionCode, setSessionCode] = useState('');
    const [role, setRole] = useState<'admin' | 'viewer'>('admin');
    const [errorMessage, setErrorMessage] = useState('');
    const hostIdRef = useRef<string>('');

    const signaling = useSignaling();
    const webrtc = useWebRTC();

    // Set up signaling callbacks
    useEffect(() => {
        signaling.setCallbacks({
            onOffer: (data: SignalPayload) => {
                webrtc.handleOffer(data);
            },
            onAnswer: (data: SignalPayload) => {
                webrtc.handleAnswer(data);
            },
            onIceCandidate: (data: SignalPayload) => {
                webrtc.handleIceCandidate(data);
            },
            onPeerLeft: (_data: PeerLeftPayload) => {
                // Host disconnected
                webrtc.disconnect();
                setAppState('failed');
                setErrorMessage('Host disconnected');
            },
            onSessionExpired: () => {
                webrtc.disconnect();
                setAppState('failed');
                setErrorMessage('Session expired');
            },
            onError: (data: ErrorPayload) => {
                setAppState('failed');
                setErrorMessage(data.message || 'An error occurred');
            },
        });
    }, [signaling, webrtc]);

    // Sync WebRTC connection state
    useEffect(() => {
        if (webrtc.connectionState === 'connected') {
            setAppState('connected');
        } else if (webrtc.connectionState === 'reconnecting') {
            setAppState('reconnecting');
        } else if (webrtc.connectionState === 'failed' && appState === 'connected') {
            setAppState('failed');
            setErrorMessage('Connection lost');
        }
    }, [webrtc.connectionState]);

    const handleConnect = useCallback(async (code: string, selectedRole: 'admin' | 'viewer') => {
        setSessionCode(code);
        setRole(selectedRole);
        setErrorMessage('');
        setAppState('connecting');

        try {
            // Connect to signaling server — returns the socket instance
            const socket = signaling.connect();

            // Wait for socket connection using event listener directly on the socket
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);

                // If already connected, resolve immediately
                if (socket?.connected) {
                    clearTimeout(timeout);
                    resolve();
                    return;
                }

                socket?.once('connect', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                socket?.once('connect_error', (err) => {
                    clearTimeout(timeout);
                    reject(new Error(`Cannot connect to server: ${err.message}`));
                });
            });

            // Join the session
            const response = await signaling.joinSession(code, selectedRole);
            hostIdRef.current = response.hostId;
            setAppState('waiting');

            // Connect WebRTC
            webrtc.connect(
                response.hostId,
                selectedRole,
                signaling.sendAnswer,
                signaling.sendIceCandidate
            );
        } catch (err) {
            console.error('[App] Connection error:', err);
            setAppState('failed');
            setErrorMessage(err instanceof Error ? err.message : 'Connection failed');
        }
    }, [signaling, webrtc]);

    const handleDisconnect = useCallback(() => {
        webrtc.disconnect();
        signaling.disconnect();
        hostIdRef.current = '';
        setAppState('disconnected');
        setSessionCode('');
        setErrorMessage('');
    }, [webrtc, signaling]);

    const handleRetry = useCallback(() => {
        if (sessionCode) {
            handleConnect(sessionCode, role);
        }
    }, [sessionCode, role, handleConnect]);

    const handleBack = useCallback(() => {
        handleDisconnect();
    }, [handleDisconnect]);

    return (
        <div className="app">
            {appState === 'disconnected' && (
                <ConnectionForm onConnect={handleConnect} />
            )}

            {(appState === 'connecting' || appState === 'waiting') && (
                <StatusOverlay
                    state={appState as ConnectionState}
                    onBack={handleBack}
                />
            )}

            {(appState === 'connected' || appState === 'reconnecting') && (
                <>
                    <Toolbar
                        sessionCode={sessionCode}
                        role={role}
                        onDisconnect={handleDisconnect}
                    />
                    <div className="app__video-container">
                        <VideoPlayer
                            stream={webrtc.remoteStream}
                            dataChannel={webrtc.dataChannel}
                            role={role}
                        />
                    </div>
                    {appState === 'reconnecting' && (
                        <StatusOverlay state="reconnecting" />
                    )}
                </>
            )}

            {appState === 'failed' && (
                <StatusOverlay
                    state="failed"
                    message={errorMessage}
                    onRetry={handleRetry}
                    onBack={handleBack}
                />
            )}
        </div>
    );
}
