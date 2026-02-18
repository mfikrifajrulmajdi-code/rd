// ============================================================
// Screen Capture — gets available sources via desktopCapturer (main process)
// Actual MediaStream acquisition happens in the renderer process
// ============================================================

import { desktopCapturer } from 'electron';

export interface ScreenSource {
    id: string;
    name: string;
    thumbnailDataUrl: string;
}

/**
 * Get available screen sources from the main process.
 * Returns source IDs that the renderer can use with getUserMedia.
 */
export async function getScreenSources(): Promise<ScreenSource[]> {
    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 320, height: 180 },
    });

    return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnailDataUrl: source.thumbnail.toDataURL(),
    }));
}
