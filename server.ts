import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { authRouter, requireAdmin } from './server/routes/auth.js';
import { servicesRouter } from './server/routes/services.js';
import { adminRouter } from './server/routes/admin.js';
import { paymentWebhookRouter } from './server/routes/paymentWebhooks.js';
import { isOriginAllowed, parseAllowedOrigins, describeOriginPolicy } from './server/security/corsOrigins.js';

dotenv.config();

async function startServer() {
  const app = express();
  const configuredPort = Number(process.env.PORT || 3000);
  const PORT = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535
    ? configuredPort
    : 3000;

  // Security Hardening
  app.disable('x-powered-by');

  // Security Headers Middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), interest-cohort=()');
    next();
  });

  // CORS: restricted to the site's own origins (plus localhost/preview hosts in
  // development). A blanket `cors()` sends Access-Control-Allow-Origin: * which
  // lets any website on the internet call the API with the user's token.
  // The decision itself lives in server/security/corsOrigins.ts so it can be
  // unit-tested; see the note there on why wildcard suffixes such as
  // `*.run.app` are development-only.
  const isDev = process.env.NODE_ENV !== 'production';
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const originPolicyWarning = describeOriginPolicy(allowedOrigins, isDev, process.env.ALLOWED_ORIGINS);
  if (originPolicyWarning) console.warn(originPolicyWarning);

  app.use(cors({
    origin(origin, callback) {
      return callback(null, isOriginAllowed(origin, { allowedOrigins, isDev }));
    },
    credentials: true
  }));
  // Keep ordinary/public API requests small. Preview PDF uploads are the only
  // large JSON payloads; authenticate those paths before parsing their bodies.
  // A 40 MB PDF expands to about 54 MB as base64, so allow a little overhead.
  // Provider webhooks need the EXACT bytes the gateway signed (Razorpay signs
  // the raw body), so they are mounted with a raw parser before express.json.
  app.use('/api/payment/webhook', express.raw({ type: '*/*', limit: '1mb' }), paymentWebhookRouter);

  const BODY_LIMIT = process.env.API_BODY_LIMIT || '8mb';
  const STAGED_DOC_BODY_LIMIT = process.env.STAGED_DOC_BODY_LIMIT || '56mb';
  const parseStagedDocJson = express.json({ limit: STAGED_DOC_BODY_LIMIT });
  app.post('/api/admin/family-orders/:groupId/stage-doc', requireAdmin, parseStagedDocJson);
  app.post('/api/admin/orders/:id/stage-doc', requireAdmin, parseStagedDocJson);
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

  // Direct dist.zip download endpoints (always serves the latest build)
  const serveZip = (_req: express.Request, res: express.Response) => {
    const candidates = [
      path.resolve(process.cwd(), 'dist.zip'),
      path.resolve(process.cwd(), 'public/dist.zip'),
      path.resolve(process.cwd(), 'dist/dist.zip')
    ];
    for (const zipPath of candidates) {
      if (fs.existsSync(zipPath)) {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="dist.zip"');
        return res.sendFile(zipPath);
      }
    }
    return res.status(404).send('dist.zip not found. Please build the project.');
  };
  app.get('/dist.zip', serveZip);
  app.get('/api/dist.zip', serveZip);
  app.get('/download/dist.zip', serveZip);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ASTRO SIVAM API',
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/login.php', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.query.action === 'admin-login') {
      req.url = '/admin-login';
    } else {
      req.url = '/login';
    }
    return (authRouter as any)(req, res, next);
  });

  app.use('/api/auth', authRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/admin', adminRouter);

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // The Node server entry and source maps are build/debug artifacts, never
    // browser assets. Keep them private even when dist/ also holds the SPA.
    app.use((req, res, next) => {
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(req.path);
      } catch {
        res.status(400).end();
        return;
      }
      const extension = path.extname(decodedPath).toLowerCase();
      if (extension === '.map' || extension === '.cjs') {
        res.status(404).end();
        return;
      }
      next();
    });
    app.use(express.static(distPath));
    // Express 5 / path-to-regexp v8 requires wildcard parameters to be named
    // (`*splat`); the old bare `'*'` pattern throws at startup.
    app.get('/*splat', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ ASTRO SIVAM server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
