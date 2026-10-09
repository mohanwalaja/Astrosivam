import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import { createServer } from 'node:http';
import { authRouter } from '../server/routes/auth.js';
import { db } from '../server/db/store.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
const server = createServer(app);

async function startServer(): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test HTTP server did not bind a TCP port.');
  return `http://127.0.0.1:${address.port}/api/auth`;
}

async function post(baseUrl: string, route: string, body: unknown) {
  return fetch(`${baseUrl}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Connection: 'close' },
    body: JSON.stringify(body)
  });
}

async function run() {
  const baseUrl = await startServer();
  try {
    const email = `auth-regression-${Date.now()}@example.test`;
    const password = '  Pass phrase with spaces  ';
    const registration = await post(baseUrl, 'register', {
      name: 'Auth Regression',
      email,
      mobile: '+679 700 0000',
      password,
      country: 'Fiji'
    });
    assert.equal(registration.status, 503, 'Registration must fail closed when no authenticated mail transport is configured.');
    assert.equal(db.findUserByEmail(email), undefined, 'An unverified registration must never become an active local account.');

    // Seed one already-verified account so this integration test can continue
    // checking that login never trims or otherwise changes a user's password.
    db.createUser({
      name: 'Auth Regression',
      email,
      mobile: '+679 700 0000',
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'customer',
      country: 'Fiji',
      authProvider: 'local',
      emailVerifiedAt: new Date().toISOString()
    });

    const login = await post(baseUrl, 'login', { email, password });
    assert.equal(login.status, 200, 'The exact password entered during registration should authenticate.');
    assert.equal((await login.json() as any).success, true);

    const trimmedLogin = await post(baseUrl, 'login', { email, password: password.trim() });
    assert.equal(trimmedLogin.status, 401, 'Trimming a password must not silently change its value.');

    const invalidType = await post(baseUrl, 'login', { email, password: { value: password } });
    assert.equal(invalidType.status, 400, 'Non-string passwords should be rejected as invalid input.');

    const adminEmail = `admin-auth-regression-${Date.now()}@example.test`;
    const adminPassword = 'Admin-Password with spaces-2026!';
    db.provisionAdminAccount({ name: 'Auth Regression Admin', email: adminEmail, password: adminPassword });
    const adminLogin = await post(baseUrl, 'admin-login', { email: adminEmail, password: adminPassword });
    assert.equal(adminLogin.status, 200);
    assert.equal((await adminLogin.json() as any).user.role, 'admin');

    console.log('Authentication password regressions passed.');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
