import { useRef, useEffect } from 'react';
import { useInputCapture } from '../hooks/useInputCapture';
import './VideoPlayer.css';

interface VideoPlayerProps {
    stream: MediaStream | null;
    dataChannel: RTCDataChannel | null;
    role: 'admin' | 'viewer';
}

export default function VideoPlayer({ stream, dataChannel, role }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Attach the stream to the video element
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream) return;

        video.srcObject = stream;
    }, [stream]);

    // Hook up input capture for admin role
    useInputCapture(videoRef, dataChannel, role === 'admin');

    return (
        <div className={`video-player ${role === 'admin' ? 'video-player--admin' : ''}`}>
            <video
                ref={videoRef}
                className="video-player__video"
                autoPlay
                playsInline
                muted
            />
            {!stream && (
                <div className="video-player__placeholder">
                    <div className="video-player__loader" />
                    <p>Waiting for video stream...</p>
                </div>
            )}
        </div>
    );
}
