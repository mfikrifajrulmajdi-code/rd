import type { ConnectionState } from '@remote-app/shared';

interface StatusOverlayProps {
    state: ConnectionState;
    message?: string;
    onRetry?: () => void;
    onBack?: () => void;
}

const STATE_CONFIG: Record<string, { label: string; showSpinner: boolean }> = {
    connecting: { label: 'Connecting...', showSpinner: true },
    waiting: { label: 'Waiting for host...', showSpinner: true },
    reconnecting: { label: 'Reconnecting...', showSpinner: true },
    failed: { label: 'Connection failed', showSpinner: false },
};

export default function StatusOverlay({ state, message, onRetry, onBack }: StatusOverlayProps) {
    const config = STATE_CONFIG[state];
    if (!config) return null;

    return (
        <div className="status-overlay">
            <div className="status-overlay__card">
                {config.showSpinner && (
                    <div className="status-overlay__spinner">
                        <svg width="48" height="48" viewBox="0 0 48 48">
                            <circle
                                cx="24" cy="24" r="20"
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="3"
                            />
                            <circle
                                cx="24" cy="24" r="20"
                                fill="none"
                                stroke="var(--accent)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray="80 200"
                                style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }}
                            />
                        </svg>
                    </div>
                )}
                {!config.showSpinner && (
                    <div className="status-overlay__icon status-overlay__icon--error">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                    </div>
                )}
                <h2 className="status-overlay__title">{config.label}</h2>
                {message && <p className="status-overlay__message">{message}</p>}
                {state === 'failed' && (
                    <div className="status-overlay__actions">
                        {onRetry && (
                            <button className="status-overlay__btn status-overlay__btn--retry" onClick={onRetry}>
                                Try Again
                            </button>
                        )}
                        {onBack && (
                            <button className="status-overlay__btn status-overlay__btn--back" onClick={onBack}>
                                Back
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
