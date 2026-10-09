import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Dev-only: when DEV_PREVIEW_API is set, route /api to the Node stand-in
      // (scripts/dev-preview-api.ts) so report previews work without PHP.
      proxy: process.env.DEV_PREVIEW_API
        ? { '/api': { target: `http://127.0.0.1:${process.env.DEV_PREVIEW_API_PORT || 8787}`, changeOrigin: true } }
        : undefined,
    },
  };
});
