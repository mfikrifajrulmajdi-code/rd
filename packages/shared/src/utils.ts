// ============================================================
// @remote-app/shared — Utilities
// Pure functions used by desktop, client, and server
// ============================================================

import { SESSION_CODE } from './constants.js';

/**
 * Generate a random session code in format "ABC-DEF-GHI".
 * Uses only non-ambiguous characters (no O/0, I/1/L).
 */
export function generateSessionCode(): string {
    const { SEGMENTS, SEGMENT_LENGTH, SEPARATOR, CHARSET } = SESSION_CODE;
    const segments: string[] = [];

    for (let i = 0; i < SEGMENTS; i++) {
        let segment = '';
        for (let j = 0; j < SEGMENT_LENGTH; j++) {
            const randomIndex = Math.floor(Math.random() * CHARSET.length);
            segment += CHARSET[randomIndex];
        }
        segments.push(segment);
    }

    return segments.join(SEPARATOR);
}

/**
 * Validate that a string matches the session code format (e.g., "ABC-DEF-GHI").
 */
export function isValidSessionCode(code: string): boolean {
    const { SEGMENTS, SEGMENT_LENGTH, SEPARATOR, CHARSET } = SESSION_CODE;
    const pattern = new RegExp(
        `^[${CHARSET}]{${SEGMENT_LENGTH}}(${escapeRegex(SEPARATOR)}[${CHARSET}]{${SEGMENT_LENGTH}}){${SEGMENTS - 1}}$`
    );
    return pattern.test(code.toUpperCase());
}

/**
 * Normalize screen coordinates to a 0.0–1.0 range.
 * Used by the Web Client before sending mouse positions.
 *
 * @param x - Pixel X position within the video element
 * @param y - Pixel Y position within the video element
 * @param width - Width of the video element
 * @param height - Height of the video element
 * @returns Normalized coordinates clamped to [0, 1]
 */
export function normalizeCoords(
    x: number,
    y: number,
    width: number,
    height: number
): { x: number; y: number } {
    return {
        x: clamp(x / width, 0, 1),
        y: clamp(y / height, 0, 1),
    };
}

/**
 * Denormalize 0.0–1.0 coordinates back to screen pixels.
 * Used by the Desktop Host to map input to actual screen positions.
 *
 * @param nx - Normalized X (0.0 - 1.0)
 * @param ny - Normalized Y (0.0 - 1.0)
 * @param screenWidth - Actual screen width in pixels
 * @param screenHeight - Actual screen height in pixels
 * @returns Pixel coordinates
 */
export function denormalizeCoords(
    nx: number,
    ny: number,
    screenWidth: number,
    screenHeight: number
): { x: number; y: number } {
    return {
        x: Math.round(nx * screenWidth),
        y: Math.round(ny * screenHeight),
    };
}

/**
 * Format a session code for display: ensure uppercase and proper separators.
 * Input can be "abcdefghi" or "abc-def-ghi" — output is always "ABC-DEF-GHI".
 */
export function formatSessionCode(input: string): string {
    const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const { SEGMENT_LENGTH, SEPARATOR } = SESSION_CODE;
    const segments: string[] = [];

    for (let i = 0; i < clean.length; i += SEGMENT_LENGTH) {
        segments.push(clean.slice(i, i + SEGMENT_LENGTH));
    }

    return segments.join(SEPARATOR);
}

/**
 * Create a throttle function that limits calls to N per second.
 * Uses requestAnimationFrame-friendly timing.
 *
 * @param fn - Function to throttle
 * @param eventsPerSecond - Maximum calls per second
 */
export function createThrottle<T extends (...args: any[]) => void>(
    fn: T,
    eventsPerSecond: number
): T {
    const intervalMs = 1000 / eventsPerSecond;
    let lastCall = 0;

    return ((...args: any[]) => {
        const now = Date.now();
        if (now - lastCall >= intervalMs) {
            lastCall = now;
            fn(...args);
        }
    }) as T;
}

// === Internal Helpers ===

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
