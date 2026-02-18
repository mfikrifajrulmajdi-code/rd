import { useState, useEffect, useCallback, useRef } from 'react';
import {
    initScreenCapture,
    handlePeerJoined,
    handlePeerLeft,
    handleSignalAnswer,
    handleSignalIceCandidate,
    cleanupAllPeers,
    stopCapture,
} from './webrtc-bridge';

interface ConnectionInfo {
    connected: boolean;
    adminCount: number;
    viewerCount: number;
    totalPeers: number;
    sessionCode: string | null;
}

declare global {
    interface Window {
        electronAPI: {
            onSessionCode: (cb: (code: string) => void) => void;
            onConnectionUpdate: (cb: (info: ConnectionInfo) => void) => void;
            rendererReady: () => void;
            generateNewCode: () => void;
            stopSharing: () => void;
            setExpiry: (ms: number | null) => void;
            getScreenSources: () => Promise<any[]>;
            getSocketId: () => Promise<string | null>;
            onPeerJoined: (cb: (data: any) => void) => void;
            onPeerLeft: (cb: (data: any) => void) => void;
            onSignalAnswer: (cb: (data: any) => void) => void;
            onSignalIceCandidate: (cb: (data: any) => void) => void;
            onSessionExpired: (cb: () => void) => void;
            sendOffer: (data: any) => void;
            sendAnswer: (data: any) => void;
            sendIceCandidate: (data: any) => void;
            handleInput: (msg: any) => void;
        };
    }
}

const EXPIRY_10_MIN = 10 * 60 * 1000;

function App() {
    const [sessionCode, setSessionCode] = useState<string>('---');
    const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
        connected: false,
        adminCount: 0,
        viewerCount: 0,
        totalPeers: 0,
        sessionCode: null,
    });
    const [hasExpiry, setHasExpiry] = useState(true);
    const [copied, setCopied] = useState(false);
    const [isSharing, setIsSharing] = useState(true);
    const [captureReady, setCaptureReady] = useState(false);
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        // Initialize screen capture
        initScreenCapture().then((stream) => {
            if (stream) {
                setCaptureReady(true);
            }
        });

        // Session UI events
        window.electronAPI.onSessionCode((code) => {
            setSessionCode(code || '---');
            if (code) setIsSharing(true);
        });

        window.electronAPI.onConnectionUpdate((info) => {
            setConnectionInfo(info);
        });

        // Signal main process that renderer is ready — triggers resend of session code
        // This fixes the race condition where session-code IPC fires before listener is registered
        window.electronAPI.rendererReady();

        // WebRTC signaling events
        window.electronAPI.onPeerJoined((data) => {
            handlePeerJoined(data.peerId, data.role);
        });

        window.electronAPI.onPeerLeft((data) => {
            handlePeerLeft(data.peerId);
        });

        window.electronAPI.onSignalAnswer((data) => {
            handleSignalAnswer(data.senderId, data.signal);
        });

        window.electronAPI.onSignalIceCandidate((data) => {
            handleSignalIceCandidate(data.senderId, data.signal);
        });

        window.electronAPI.onSessionExpired(() => {
            cleanupAllPeers();
        });
    }, []);

    const handleCopyCode = useCallback(() => {
        if (sessionCode && sessionCode !== '---') {
            navigator.clipboard.writeText(sessionCode).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        }
    }, [sessionCode]);

    const handleGenerateNewCode = useCallback(() => {
        cleanupAllPeers();
        window.electronAPI.generateNewCode();
    }, []);

    const handleStopSharing = useCallback(() => {
        cleanupAllPeers();
        stopCapture();
        window.electronAPI.stopSharing();
        setIsSharing(false);
        setSessionCode('---');
        setCaptureReady(false);
    }, []);

    const handleStartSharing = useCallback(() => {
        initScreenCapture().then((stream) => {
            if (stream) {
                setCaptureReady(true);
                setIsSharing(true);
                window.electronAPI.generateNewCode();
            }
        });
    }, []);

    const handleToggleExpiry = useCallback(() => {
        const newHasExpiry = !hasExpiry;
        setHasExpiry(newHasExpiry);
        window.electronAPI.setExpiry(newHasExpiry ? EXPIRY_10_MIN : null);
    }, [hasExpiry]);

    const getStatusText = () => {
        if (!isSharing) return 'Sharing dihentikan';
        if (!connectionInfo.connected) return 'Menghubungkan ke server...';
        if (!captureReady) return 'Menyiapkan screen capture...';
        if (connectionInfo.totalPeers === 0) return 'Menunggu koneksi...';

        const parts: string[] = [];
        if (connectionInfo.adminCount > 0) {
            parts.push(`${connectionInfo.adminCount} admin`);
        }
        if (connectionInfo.viewerCount > 0) {
            parts.push(`${connectionInfo.viewerCount} viewer`);
        }
        return `Terhubung (${parts.join(', ')})`;
    };

    const getStatusClass = () => {
        if (!isSharing) return 'status-stopped';
        if (!connectionInfo.connected || !captureReady) return 'status-connecting';
        if (connectionInfo.totalPeers === 0) return 'status-waiting';
        return 'status-connected';
    };

    return (
        <div className="app">
            <div className="app-header">
                <div className="logo">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <rect width="32" height="32" rx="8" fill="url(#grad)" />
                        <path d="M8 12h16v10a2 2 0 01-2 2H10a2 2 0 01-2-2V12z" fill="rgba(255,255,255,0.2)" />
                        <rect x="8" y="8" width="16" height="14" rx="2" stroke="white" strokeWidth="1.5" fill="none" />
                        <line x1="12" y1="24" x2="20" y2="24" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="16" y1="22" x2="16" y2="24" stroke="white" strokeWidth="1.5" />
                        <defs>
                            <linearGradient id="grad" x1="0" y1="0" x2="32" y2="32">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <h1>Remote Desktop</h1>
                </div>
                <span className={`status-badge ${getStatusClass()}`}>
                    <span className="status-dot" />
                    {getStatusText()}
                </span>
            </div>

            <div className="card session-card">
                <label className="card-label">Session Code</label>
                <div className="session-code-wrapper" onClick={handleCopyCode} title="Klik untuk copy">
                    <span className="session-code">{sessionCode}</span>
                    <span className={`copy-hint ${copied ? 'copied' : ''}`}>
                        {copied ? '✓ Copied!' : 'Klik untuk copy'}
                    </span>
                </div>
            </div>

            <div className="card stats-card">
                <div className="stat">
                    <span className="stat-value">{connectionInfo.adminCount}</span>
                    <span className="stat-label">Admin</span>
                </div>
                <div className="stat-divider" />
                <div className="stat">
                    <span className="stat-value">{connectionInfo.viewerCount}</span>
                    <span className="stat-label">Viewer</span>
                </div>
                <div className="stat-divider" />
                <div className="stat">
                    <span className="stat-value">{connectionInfo.totalPeers}</span>
                    <span className="stat-label">Total</span>
                </div>
            </div>

            <div className="card settings-card">
                <div className="setting-row">
                    <div className="setting-info">
                        <span className="setting-label">Session Expiry</span>
                        <span className="setting-description">
                            {hasExpiry ? '10 menit' : 'Selamanya'}
                        </span>
                    </div>
                    <button
                        className={`toggle ${hasExpiry ? 'toggle-on' : 'toggle-off'}`}
                        onClick={handleToggleExpiry}
                        aria-label="Toggle session expiry"
                    >
                        <span className="toggle-thumb" />
                    </button>
                </div>
            </div>

            <div className="actions">
                <button className="btn btn-primary" onClick={handleGenerateNewCode} disabled={!isSharing}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M13.65 2.35a1.5 1.5 0 00-2.12 0L3 10.88V13h2.12l8.53-8.53a1.5 1.5 0 000-2.12z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Generate Code Baru
                </button>
                <button
                    className={`btn ${isSharing ? 'btn-danger' : 'btn-success'}`}
                    onClick={isSharing ? handleStopSharing : handleStartSharing}
                >
                    {isSharing ? (
                        <>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                            Stop Sharing
                        </>
                    ) : (
                        <>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <polygon points="5,3 13,8 5,13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                            </svg>
                            Start Sharing
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default App;
