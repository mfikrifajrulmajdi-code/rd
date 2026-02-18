import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    main: {
        plugins: [
            externalizeDepsPlugin({
                exclude: ['@remote-app/shared'],
            }),
        ],
    },
    preload: {
        plugins: [
            externalizeDepsPlugin({
                exclude: ['@remote-app/shared'],
            }),
        ],
    },
    renderer: {
        plugins: [react()],
    },
});
