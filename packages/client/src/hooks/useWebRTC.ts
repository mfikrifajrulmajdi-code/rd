import { useRef, useCallback, useState } from 'react';
import {
    ICE_SERVERS,
    type SignalPayload,
    type SDPPayload,
    type ICEPayload,
    type ConnectionState,
} from '@remote-app/shared';

interface UseWebRTCReturn {
    connect: (
        hostId: string,
        role: 'admin' | 'viewer',
        sendAnswer: (targetId: string, sdp: string) => void,
        sendIceCandidate: (targetId: string, candidate: RTCIceCandidate) => void
    ) => void;
    disconnect: () => void;
    handleOffer: (data: SignalPayload) => void;
    handleAnswer: (data: SignalPayload) => void;
    handleIceCandidate: (data: SignalPayload) => void;
    remoteStream: MediaStream | null;
    dataChannel: RTCDataChannel | null;
    connectionState: ConnectionState;
}

export function useWebRTC(): UseWebRTCReturn {
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const hostIdRef = useRef<string>('');
    const sendAnswerRef = useRef<((targetId: string, sdp: string) => void) | null>(null);
    const sendIceCandidateRef = useRef<((targetId: string, candidate: RTCIceCandidate) => void) | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

    const createPeerConnection = useCallback((role: 'admin' | 'viewer') => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.ontrack = (event) => {
            if (event.streams[0]) {
                setRemoteStream(event.streams[0]);
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && hostIdRef.current && sendIceCandidateRef.current) {
                sendIceCandidateRef.current(hostIdRef.current, event.candidate);
            }
        };

        pc.onconnectionstatechange = () => {
            switch (pc.connectionState) {
                case 'connected':
                    setConnectionState('connected');
                    break;
                case 'disconnected':
                    setConnectionState('reconnecting');
                    break;
                case 'failed':
                    setConnectionState('failed');
                    break;
                case 'closed':
                    setConnectionState('disconnected');
                    break;
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                setConnectionState('connected');
            }
        };

        // For admin role, handle incoming data channel from host
        if (role === 'admin') {
            pc.ondatachannel = (event) => {
                const channel = event.channel;
                channel.onopen = () => {
                    console.log('[WebRTC] DataChannel opened:', channel.label);
                };
                channel.onclose = () => {
                    console.log('[WebRTC] DataChannel closed:', channel.label);
                    setDataChannel(null);
                };
                setDataChannel(channel);
            };
        }

        return pc;
    }, []);

    const connect = useCallback(
        (
            hostId: string,
            role: 'admin' | 'viewer',
            sendAnswer: (targetId: string, sdp: string) => void,
            sendIceCandidate: (targetId: string, candidate: RTCIceCandidate) => void
        ) => {
            hostIdRef.current = hostId;
            sendAnswerRef.current = sendAnswer;
            sendIceCandidateRef.current = sendIceCandidate;
            pendingCandidatesRef.current = [];

            // Clean up existing connection
            if (pcRef.current) {
                pcRef.current.close();
            }

            const pc = createPeerConnection(role);
            pcRef.current = pc;
            setConnectionState('connecting');

            // The host will send an offer once it knows we've joined.
            // We wait for handleOffer to be called.
        },
        [createPeerConnection]
    );

    const handleOffer = useCallback(async (data: SignalPayload) => {
        const pc = pcRef.current;
        if (!pc) return;

        const signal = data.signal as SDPPayload;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription({
                type: signal.type,
                sdp: signal.sdp,
            }));

            // Apply any pending ICE candidates
            for (const candidate of pendingCandidatesRef.current) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingCandidatesRef.current = [];

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (sendAnswerRef.current && hostIdRef.current) {
                sendAnswerRef.current(hostIdRef.current, answer.sdp || '');
            }
        } catch (err) {
            console.error('[WebRTC] Error handling offer:', err);
            setConnectionState('failed');
        }
    }, []);

    const handleAnswer = useCallback(async (data: SignalPayload) => {
        const pc = pcRef.current;
        if (!pc) return;

        const signal = data.signal as SDPPayload;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription({
                type: signal.type,
                sdp: signal.sdp,
            }));
        } catch (err) {
            console.error('[WebRTC] Error handling answer:', err);
        }
    }, []);

    const handleIceCandidate = useCallback(async (data: SignalPayload) => {
        const pc = pcRef.current;
        const signal = data.signal as ICEPayload;

        const candidateInit: RTCIceCandidateInit = {
            candidate: signal.candidate,
            sdpMid: signal.sdpMid,
            sdpMLineIndex: signal.sdpMLineIndex,
        };

        if (!pc || !pc.remoteDescription) {
            // Queue if remote description not set yet
            pendingCandidatesRef.current.push(candidateInit);
            return;
        }

        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (err) {
            console.error('[WebRTC] Error adding ICE candidate:', err);
        }
    }, []);

    const disconnect = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        hostIdRef.current = '';
        sendAnswerRef.current = null;
        sendIceCandidateRef.current = null;
        pendingCandidatesRef.current = [];
        setRemoteStream(null);
        setDataChannel(null);
        setConnectionState('disconnected');
    }, []);

    return {
        connect,
        disconnect,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
        remoteStream,
        dataChannel,
        connectionState,
    };
}
