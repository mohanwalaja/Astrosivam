import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Handle calculate-preview in dev
        if (
          (url.startsWith('/api/services/calculate-preview') || url.includes('calculate-preview')) &&
          req.method === 'POST'
        ) {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const { calculateLocalAstrology } = await import('./src/services/localAstrology');
              const result = calculateLocalAstrology(data.serviceType, data.payload);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, nodeType: 'TRUE', result }));
            } catch (err: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, message: err?.message || 'Calculation failed' }));
            }
          });
          return;
        }

        // Prevent dev server from serving raw PHP file sources as static 200 text
        if (url.endsWith('.php') || url.includes('.php?')) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: 'PHP script execution is not active on the dev server.' }));
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react(), tailwindcss(), apiDevMiddleware()],
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
    preview: {
      allowedHosts: true as const,
      proxy: process.env.DEV_PREVIEW_API
        ? { '/api': { target: `http://127.0.0.1:${process.env.DEV_PREVIEW_API_PORT || 8787}`, changeOrigin: true } }
        : undefined,
    },
  };
});
