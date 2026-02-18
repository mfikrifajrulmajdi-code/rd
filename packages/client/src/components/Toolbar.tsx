import { useState, useEffect, useCallback, useRef } from 'react';
import './Toolbar.css';

interface ToolbarProps {
    sessionCode: string;
    role: 'admin' | 'viewer';
    connectionQuality?: string;
    onDisconnect: () => void;
}

export default function Toolbar({ sessionCode, role, connectionQuality, onDisconnect }: ToolbarProps) {
    const [visible, setVisible] = useState(true);
    const [showInfo, setShowInfo] = useState(false);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const scheduleHide = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(() => {
            setVisible(false);
        }, 3000);
    }, []);

    // Auto-hide after 3 seconds
    useEffect(() => {
        scheduleHide();
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, [scheduleHide]);

    // Show toolbar on mouse move near top of screen
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (e.clientY < 60) {
                setVisible(true);
                scheduleHide();
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        return () => window.removeEventListener('mousemove', onMouseMove);
    }, [scheduleHide]);

    const handleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen().catch(() => { });
        }
    };

    const handleMouseEnter = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        setVisible(true);
    };

    const handleMouseLeave = () => {
        scheduleHide();
    };

    return (
        <div
            className={`toolbar ${visible ? 'toolbar--visible' : 'toolbar--hidden'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="toolbar__content">
                <button className="toolbar__btn toolbar__btn--disconnect" onClick={onDisconnect}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Disconnect
                </button>

                <div className="toolbar__center">
                    <span className="toolbar__session-code">{sessionCode}</span>
                    <span className={`toolbar__role toolbar__role--${role}`}>
                        {role === 'admin' ? '🛡️ Admin' : '👁️ Viewer'}
                    </span>
                </div>

                <div className="toolbar__actions">
                    <button
                        className="toolbar__btn toolbar__btn--icon"
                        onClick={() => setShowInfo(!showInfo)}
                        title="Connection Info"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                    </button>
                    <button
                        className="toolbar__btn toolbar__btn--icon"
                        onClick={handleFullscreen}
                        title="Toggle Fullscreen"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                    </button>
                </div>
            </div>

            {showInfo && (
                <div className="toolbar__info-panel">
                    <div className="toolbar__info-row">
                        <span>Session</span>
                        <span>{sessionCode}</span>
                    </div>
                    <div className="toolbar__info-row">
                        <span>Role</span>
                        <span>{role}</span>
                    </div>
                    <div className="toolbar__info-row">
                        <span>Quality</span>
                        <span>{connectionQuality || 'Good'}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
