// ============================================================
// Input Handler — executes mouse/keyboard input via @jitsi/robotjs
// Graceful fallback: if robotjs native module is unavailable,
// input control is disabled but the app continues to run.
// ============================================================

import { screen } from 'electron';
import { InputMessage, denormalizeCoords } from '@remote-app/shared';

// Attempt to load robotjs — may fail if native .node binary not built
let robot: typeof import('@jitsi/robotjs') | null = null;
let robotAvailable = false;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    robot = require('@jitsi/robotjs');
    robotAvailable = true;
    console.log('[InputHandler] @jitsi/robotjs loaded successfully — input control enabled');
} catch (err) {
    console.warn('[InputHandler] @jitsi/robotjs not available — input control disabled');
    console.warn('[InputHandler] To enable: npx @electron/rebuild -f -w @jitsi/robotjs');
}

// ── Key Code Mapping ──────────────────────────────────────────────────────────
// Browser KeyboardEvent.code → robotjs key name
// See: https://github.com/jitsi/robotjs#keyboardkey
const KEY_MAP: Record<string, string> = {
    // Letters
    KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e',
    KeyF: 'f', KeyG: 'g', KeyH: 'h', KeyI: 'i', KeyJ: 'j',
    KeyK: 'k', KeyL: 'l', KeyM: 'm', KeyN: 'n', KeyO: 'o',
    KeyP: 'p', KeyQ: 'q', KeyR: 'r', KeyS: 's', KeyT: 't',
    KeyU: 'u', KeyV: 'v', KeyW: 'w', KeyX: 'x', KeyY: 'y',
    KeyZ: 'z',

    // Digits (top row)
    Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
    Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',

    // Numpad
    Numpad0: 'numpad_0', Numpad1: 'numpad_1', Numpad2: 'numpad_2',
    Numpad3: 'numpad_3', Numpad4: 'numpad_4', Numpad5: 'numpad_5',
    Numpad6: 'numpad_6', Numpad7: 'numpad_7', Numpad8: 'numpad_8',
    Numpad9: 'numpad_9',
    NumpadAdd: 'num_lock', NumpadSubtract: 'subtract',
    NumpadMultiply: 'multiply', NumpadDivide: 'divide',
    NumpadDecimal: 'decimal', NumpadEnter: 'enter',

    // Function keys
    F1: 'f1', F2: 'f2', F3: 'f3', F4: 'f4', F5: 'f5', F6: 'f6',
    F7: 'f7', F8: 'f8', F9: 'f9', F10: 'f10', F11: 'f11', F12: 'f12',

    // Navigation
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Home: 'home', End: 'end', PageUp: 'pageup', PageDown: 'pagedown',
    Insert: 'insert', Delete: 'delete',

    // Editing
    Backspace: 'backspace', Enter: 'enter', Tab: 'tab',
    Space: 'space', Escape: 'escape',

    // Modifiers
    ShiftLeft: 'shift', ShiftRight: 'shift',
    ControlLeft: 'control', ControlRight: 'control',
    AltLeft: 'alt', AltRight: 'alt',
    MetaLeft: 'command', MetaRight: 'command',
    CapsLock: 'caps_lock', NumLock: 'num_lock', ScrollLock: 'scroll_lock',

    // Punctuation / symbols
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Semicolon: ';', Quote: "'", Backquote: '`',
    Comma: ',', Period: '.', Slash: '/',

    // Media / special
    PrintScreen: 'printscreen', Pause: 'pause',
};

/**
 * Map a browser KeyboardEvent.code to a robotjs key name.
 * Returns null if the key is not supported.
 */
function mapKey(code: string): string | null {
    return KEY_MAP[code] ?? null;
}

/**
 * Handle an input message from a remote admin.
 * Denormalizes coordinates and dispatches to robotjs.
 * No-op if robotjs is not available.
 *
 * @param msg - The input message received via DataChannel
 */
export function handleInput(msg: InputMessage): void {
    if (!robotAvailable || !robot) {
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().size;

    try {
        switch (msg.t) {
            case 'mouse-move': {
                if (msg.x != null && msg.y != null) {
                    const { x, y } = denormalizeCoords(msg.x, msg.y, width, height);
                    robot.moveMouse(x, y);
                }
                break;
            }

            case 'mouse-click': {
                const button = msg.b === 'right' ? 'right' : msg.b === 'middle' ? 'middle' : 'left';
                robot.mouseClick(button);
                break;
            }

            case 'mouse-down': {
                const button = msg.b === 'right' ? 'right' : msg.b === 'middle' ? 'middle' : 'left';
                robot.mouseToggle('down', button);
                break;
            }

            case 'mouse-up': {
                const button = msg.b === 'right' ? 'right' : msg.b === 'middle' ? 'middle' : 'left';
                robot.mouseToggle('up', button);
                break;
            }

            case 'mouse-scroll': {
                if (msg.d != null) {
                    robot.scrollMouse(0, msg.d > 0 ? -3 : 3);
                }
                break;
            }

            case 'key-press': {
                if (msg.k) {
                    const key = mapKey(msg.k);
                    if (key) {
                        robot.keyTap(key);
                    } else {
                        console.warn(`[InputHandler] Unsupported key code: ${msg.k}`);
                    }
                }
                break;
            }

            case 'key-release': {
                if (msg.k) {
                    const key = mapKey(msg.k);
                    if (key) {
                        robot.keyToggle(key, 'up');
                    } else {
                        console.warn(`[InputHandler] Unsupported key code: ${msg.k}`);
                    }
                }
                break;
            }

            default:
                console.warn(`[InputHandler] Unknown input type: ${(msg as any).t}`);
        }
    } catch (err) {
        // Catch any robotjs errors (e.g. invalid key) so Electron doesn't crash
        console.warn(`[InputHandler] Error executing input (${msg.t}):`, err);
    }
}

/**
 * Returns whether input control is available (robotjs loaded successfully).
 */
export function isInputAvailable(): boolean {
    return robotAvailable;
}
