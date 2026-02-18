import { useEffect, useRef } from 'react';
import { normalizeCoords, createThrottle, INPUT_THROTTLE } from '@remote-app/shared';
import type { InputMessage } from '@remote-app/shared';
import { encode } from '@msgpack/msgpack';

export function useInputCapture(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    dataChannel: RTCDataChannel | null,
    enabled: boolean
) {
    const throttledMouseMoveRef = useRef<((msg: InputMessage) => void) | null>(null);
    const throttledScrollRef = useRef<((msg: InputMessage) => void) | null>(null);

    useEffect(() => {
        if (!enabled || !dataChannel || dataChannel.readyState !== 'open') return;

        const video = videoRef.current;
        if (!video) return;

        const send = (msg: InputMessage) => {
            if (dataChannel.readyState === 'open') {
                dataChannel.send(encode(msg));
            }
        };

        // Create throttled senders
        const throttledMouseMove = createThrottle((msg: InputMessage) => {
            send(msg);
        }, INPUT_THROTTLE.MOUSE_MOVE);
        throttledMouseMoveRef.current = throttledMouseMove;

        const throttledScroll = createThrottle((msg: InputMessage) => {
            send(msg);
        }, INPUT_THROTTLE.MOUSE_SCROLL);
        throttledScrollRef.current = throttledScroll;

        const getCoords = (e: MouseEvent) => {
            const rect = video.getBoundingClientRect();
            return normalizeCoords(
                e.clientX - rect.left,
                e.clientY - rect.top,
                rect.width,
                rect.height
            );
        };

        const getMouseButton = (button: number): 'left' | 'right' | 'middle' => {
            switch (button) {
                case 2: return 'right';
                case 1: return 'middle';
                default: return 'left';
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            const { x, y } = getCoords(e);
            throttledMouseMove({ t: 'mouse-move', x, y, ts: Date.now() });
        };

        const onMouseDown = (e: MouseEvent) => {
            const { x, y } = getCoords(e);
            send({ t: 'mouse-down', x, y, b: getMouseButton(e.button), ts: Date.now() });
        };

        const onMouseUp = (e: MouseEvent) => {
            const { x, y } = getCoords(e);
            send({ t: 'mouse-up', x, y, b: getMouseButton(e.button), ts: Date.now() });
        };

        const onClick = (e: MouseEvent) => {
            const { x, y } = getCoords(e);
            send({ t: 'mouse-click', x, y, b: getMouseButton(e.button), ts: Date.now() });
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const { x, y } = getCoords(e);
            throttledScroll({ t: 'mouse-scroll', x, y, d: e.deltaY, ts: Date.now() });
        };

        const onKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            send({ t: 'key-press', k: e.code, ts: Date.now() });
        };

        const onKeyUp = (e: KeyboardEvent) => {
            e.preventDefault();
            send({ t: 'key-release', k: e.code, ts: Date.now() });
        };

        const onContextMenu = (e: Event) => {
            e.preventDefault();
        };

        // Make video focusable for keyboard events
        video.tabIndex = 0;

        video.addEventListener('mousemove', onMouseMove);
        video.addEventListener('mousedown', onMouseDown);
        video.addEventListener('mouseup', onMouseUp);
        video.addEventListener('click', onClick);
        video.addEventListener('wheel', onWheel, { passive: false });
        video.addEventListener('keydown', onKeyDown);
        video.addEventListener('keyup', onKeyUp);
        video.addEventListener('contextmenu', onContextMenu);

        return () => {
            video.removeEventListener('mousemove', onMouseMove);
            video.removeEventListener('mousedown', onMouseDown);
            video.removeEventListener('mouseup', onMouseUp);
            video.removeEventListener('click', onClick);
            video.removeEventListener('wheel', onWheel);
            video.removeEventListener('keydown', onKeyDown);
            video.removeEventListener('keyup', onKeyUp);
            video.removeEventListener('contextmenu', onContextMenu);
        };
    }, [videoRef, dataChannel, enabled]);
}
