/**
 * Dev-only stand-in for `/api/services/calculate-preview` (Birth Jathagam).
 *
 * The production API is PHP (api/services.php). In sandboxes without PHP the
 * website's "View sample report" / "Preview" buttons have nothing to call, so
 * this tiny Node server answers the ONE preview endpoint with the TypeScript
 * engine (the same engine the browser report builder uses). Run with
 *
 *   DEV_PREVIEW_API=1 npm run dev          # vite proxies /api → :8787
 *   npx tsx scripts/dev-preview-api.ts     # this server
 *
 * Never deploy this; it is not part of the build.
 */
import { createServer } from 'node:http';
import { calculatePrecisionHoroscope } from '../src/lib/astrology/astronomy';

const PORT = Number(process.env.DEV_PREVIEW_API_PORT || 8787);

function readJson(req: import('node:http').IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  const send = (status: number, payload: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  };
  if (req.method !== 'POST' || !/calculate-preview/.test(req.url || '')) {
    return send(404, { success: false, message: 'Dev preview API: only POST calculate-preview is served here.' });
  }
  try {
    const { serviceType, payload = {} } = await readJson(req);
    if (serviceType !== 'BIRTH_JATHAGAM') {
      return send(400, { success: false, message: `Dev preview API serves BIRTH_JATHAGAM only (got ${serviceType}). Use the PHP API for other services.` });
    }
    const result = calculatePrecisionHoroscope(
      String(payload.name || payload.devoteeName || 'User'),
      String(payload.dob || ''),
      String(payload.tob || ''),
      String(payload.birthPlace || ''),
      Number(payload.latitude),
      Number(payload.longitude),
      Number(payload.timezoneOffsetHours ?? 5.5),
      String(payload.country || ''),
      String(payload.gender || 'M')
    );
    return send(200, { success: true, result: { ...result, timeZoneId: payload.timeZoneId || result.timeZoneId } });
  } catch (error: any) {
    return send(400, { success: false, message: error?.message || 'Preview failed.' });
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`[dev-preview-api] listening on http://0.0.0.0:${PORT} (BIRTH_JATHAGAM calculate-preview only)`);
});
