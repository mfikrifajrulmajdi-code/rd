// ============================================================
// WebRTC Bridge — runs in renderer process (has browser APIs)
// Handles screen capture and peer connections
// ============================================================

import { decode } from '@msgpack/msgpack';
import {
    ICE_SERVERS,
    DATA_CHANNELS,
    DEFAULT_VIDEO_CONFIG,
    type InputMessage,
    type PeerRole,
} from '@remote-app/shared';

interface PeerEntry {
    peerId: string;
    role: PeerRole;
    pc: RTCPeerConnection;
    dc?: RTCDataChannel;
}

const peers = new Map<string, PeerEntry>();
let screenStream: MediaStream | null = null;

/**
 * Initialize screen capture in the renderer process.
 * Uses desktopCapturer source IDs obtained from main process via IPC.
 */
export async function initScreenCapture(): Promise<MediaStream | null> {
    try {
        const sources = await window.electronAPI.getScreenSources();
        if (!sources || sources.length === 0) {
            console.error('No screen sources available');
            return null;
        }

        const primarySource = sources[0];

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                // @ts-ignore — Electron-specific constraint
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: primarySource.id,
                    maxWidth: DEFAULT_VIDEO_CONFIG.width,
                    maxHeight: DEFAULT_VIDEO_CONFIG.height,
                    maxFrameRate: DEFAULT_VIDEO_CONFIG.frameRate,
                },
            },
        });

        screenStream = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            const settings = videoTrack.getSettings();
            console.log(
                `Screen capture started: ${settings.width ?? DEFAULT_VIDEO_CONFIG.width}x${settings.height ?? DEFAULT_VIDEO_CONFIG.height}@${settings.frameRate ?? DEFAULT_VIDEO_CONFIG.frameRate}fps`
            );
        }

        return stream;
    } catch (err) {
        console.error('Failed to start screen capture:', err);
        return null;
    }
}

/**
 * Create a new peer connection for a remote peer.
 */
export async function handlePeerJoined(
    peerId: string,
    role: PeerRole
): Promise<void> {
    if (!screenStream) {
        console.error('No screen stream available for peer connection');
        return;
    }

    const socketId = await window.electronAPI.getSocketId();
    if (!socketId) {
        console.error('No socket ID available');
        return;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add video tracks
    screenStream.getTracks().forEach((track) => {
        pc.addTrack(track, screenStream!);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            window.electronAPI.sendIceCandidate({
                targetId: peerId,
                senderId: socketId,
                signal: {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                },
            });
        }
    };

    pc.onconnectionstatechange = () => {
        console.log(`Peer ${peerId} connection state: ${pc.connectionState}`);
    };

    const entry: PeerEntry = { peerId, role, pc };

    // Create DataChannel for admin (input control)
    if (role === 'admin') {
        const dc = pc.createDataChannel(DATA_CHANNELS.INPUT);
        dc.binaryType = 'arraybuffer';
        dc.onmessage = (event) => {
            try {
                const msg = decode(new Uint8Array(event.data as ArrayBuffer)) as InputMessage;
                // Forward input to main process for robotjs execution
                window.electronAPI.handleInput(msg);
            } catch (err) {
                console.error('Failed to decode input message:', err);
            }
        };
        dc.onopen = () => console.log(`DataChannel open for admin ${peerId}`);
        dc.onclose = () => console.log(`DataChannel closed for admin ${peerId}`);
        entry.dc = dc;
    }

    peers.set(peerId, entry);

    // Create and send SDP offer
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        window.electronAPI.sendOffer({
            targetId: peerId,
            senderId: socketId,
            signal: {
                type: 'offer',
                sdp: offer.sdp!,
            },
        });

        console.log(`Sent SDP offer to ${peerId}`);
    } catch (err) {
        console.error(`Failed to create offer for ${peerId}:`, err);
    }
}

/**
 * Handle SDP answer from a remote peer.
 */
export async function handleSignalAnswer(
    senderId: string,
    signal: { type: string; sdp: string }
): Promise<void> {
    const entry = peers.get(senderId);
    if (entry) {
        await entry.pc.setRemoteDescription(
            new RTCSessionDescription({ type: signal.type as RTCSdpType, sdp: signal.sdp })
        );
        console.log(`Set remote description (answer) from ${senderId}`);
    }
}

/**
 * Handle ICE candidate from a remote peer.
 */
export async function handleSignalIceCandidate(
    senderId: string,
    signal: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
): Promise<void> {
    const entry = peers.get(senderId);
    if (entry) {
        await entry.pc.addIceCandidate(
            new RTCIceCandidate({
                candidate: signal.candidate,
                sdpMid: signal.sdpMid,
                sdpMLineIndex: signal.sdpMLineIndex,
            })
        );
    }
}

/**
 * Handle peer disconnect — close and remove peer connection.
 */
export function handlePeerLeft(peerId: string): void {
    const entry = peers.get(peerId);
    if (entry) {
        entry.dc?.close();
        entry.pc.close();
        peers.delete(peerId);
    }
}

/**
 * Cleanup all peer connections.
 */
export function cleanupAllPeers(): void {
    peers.forEach((entry) => {
        entry.dc?.close();
        entry.pc.close();
    });
    peers.clear();
}

/**
 * Stop screen capture.
 */
export function stopCapture(): void {
    screenStream?.getTracks().forEach((track) => track.stop());
    screenStream = null;
}
