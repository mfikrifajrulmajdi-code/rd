import { useState, useRef, useCallback, useEffect } from 'react';
import { isValidSessionCode, SESSION_CODE } from '@remote-app/shared';
import './ConnectionForm.css';

interface ConnectionFormProps {
    onConnect: (sessionCode: string, role: 'admin' | 'viewer') => void;
    disabled?: boolean;
}

export default function ConnectionForm({ onConnect, disabled }: ConnectionFormProps) {
    const [segments, setSegments] = useState(['', '', '']);
    const inputRef0 = useRef<HTMLInputElement>(null);
    const inputRef1 = useRef<HTMLInputElement>(null);
    const inputRef2 = useRef<HTMLInputElement>(null);
    const inputRefs = [inputRef0, inputRef1, inputRef2];

    const fullCode = segments.join(SESSION_CODE.SEPARATOR);
    const isValid = isValidSessionCode(fullCode);

    // Auto-focus first input on mount
    useEffect(() => {
        inputRefs[0].current?.focus();
    }, []);

    const updateSegment = useCallback((index: number, value: string) => {
        const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, SESSION_CODE.SEGMENT_LENGTH);
        setSegments(prev => {
            const next = [...prev];
            next[index] = upper;
            return next;
        });

        // Auto-focus next field when current is full
        if (upper.length === SESSION_CODE.SEGMENT_LENGTH && index < SESSION_CODE.SEGMENTS - 1) {
            inputRefs[index + 1].current?.focus();
        }
    }, []);

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData('text').trim().toUpperCase();
        // Check if it matches full code pattern, e.g. "ABC-DEF-GHI" or "ABCDEFGHI"
        const clean = pasted.replace(/[^A-Z0-9]/g, '');

        if (clean.length >= SESSION_CODE.SEGMENTS * SESSION_CODE.SEGMENT_LENGTH) {
            e.preventDefault();
            const newSegments: string[] = [];
            for (let i = 0; i < SESSION_CODE.SEGMENTS; i++) {
                const start = i * SESSION_CODE.SEGMENT_LENGTH;
                newSegments.push(clean.slice(start, start + SESSION_CODE.SEGMENT_LENGTH));
            }
            setSegments(newSegments);
            // Focus last field
            inputRefs[SESSION_CODE.SEGMENTS - 1].current?.focus();
        }
    }, []);

    const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        // On backspace in empty field, move to previous
        if (e.key === 'Backspace' && segments[index] === '' && index > 0) {
            inputRefs[index - 1].current?.focus();
        }
    }, [segments]);

    const handleSubmit = (role: 'admin' | 'viewer') => {
        if (isValid && !disabled) {
            onConnect(fullCode, role);
        }
    };

    return (
        <div className="connection-form-wrapper">
            <div className="connection-form">
                <div className="connection-form__icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                </div>
                <h1 className="connection-form__title">Remote Desktop Viewer</h1>
                <p className="connection-form__subtitle">Enter the session code to connect</p>

                <div className="connection-form__code-inputs">
                    {segments.map((seg, i) => (
                        <div key={i} className="connection-form__segment-group">
                            {i > 0 && <span className="connection-form__separator">—</span>}
                            <input
                                ref={inputRefs[i]}
                                type="text"
                                className="connection-form__input"
                                maxLength={SESSION_CODE.SEGMENT_LENGTH}
                                value={seg}
                                onChange={e => updateSegment(i, e.target.value)}
                                onPaste={handlePaste}
                                onKeyDown={e => handleKeyDown(i, e)}
                                placeholder={'•'.repeat(SESSION_CODE.SEGMENT_LENGTH)}
                                disabled={disabled}
                                spellCheck={false}
                                autoComplete="off"
                            />
                        </div>
                    ))}
                </div>

                <div className="connection-form__buttons">
                    <button
                        className="connection-form__btn connection-form__btn--primary"
                        onClick={() => handleSubmit('admin')}
                        disabled={!isValid || disabled}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5z" />
                            <rect x="3" y="10" width="18" height="12" rx="2" ry="2" />
                        </svg>
                        Connect as Admin
                    </button>
                    <button
                        className="connection-form__btn connection-form__btn--secondary"
                        onClick={() => handleSubmit('viewer')}
                        disabled={!isValid || disabled}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        Connect as Viewer
                    </button>
                </div>
            </div>
        </div>
    );
}
