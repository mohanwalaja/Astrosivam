import assert from 'node:assert/strict';
import net from 'node:net';
import {
  decodeRespChunk,
  FixedWindowRateLimiter,
  parseRedisUrl,
  RedisFixedWindowRateLimiter,
  createAttemptTracker,
  createRateLimiter
} from '../server/security/rateLimit.js';

const pass = (name: string) => console.log(`  [PASS] ${name}`);

/**
 * Minimal in-process Redis substitute. It implements exactly the commands the
 * shared limiter uses (INCR / PEXPIRE / PTTL / SET PX / DEL / AUTH / SELECT) so
 * the limiter can be exercised over a real socket without a Redis dependency.
 */
async function startFakeRedis(requirePassword?: string): Promise<{
  url: string;
  commands: string[][];
  close: () => Promise<void>;
}> {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const commands: string[][] = [];

  const live = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  };
  const ttlOf = (key: string) => {
    const entry = live(key);
    if (!entry) return -2;
    return entry.expiresAt === 0 ? -1 : Math.max(0, entry.expiresAt - Date.now());
  };

  const server = net.createServer(socket => {
    let buffer = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      const { replies, rest } = decodeRespChunkForCommands(buffer);
      buffer = rest;
      for (const args of replies) {
        commands.push(args);
        const command = (args[0] || '').toUpperCase();
        let response = '+OK\r\n';
        if (command === 'AUTH') {
          response = !requirePassword || args[1] === requirePassword ? '+OK\r\n' : '-ERR invalid password\r\n';
        } else if (command === 'SELECT' || command === 'PING') {
          response = '+OK\r\n';
        } else if (command === 'INCR') {
          const current = live(args[1]);
          const next = current ? String(Number(current.value) + 1) : '1';
          store.set(args[1], { value: next, expiresAt: current?.expiresAt || 0 });
          response = `:${next}\r\n`;
        } else if (command === 'PEXPIRE') {
          const entry = live(args[1]);
          if (entry) entry.expiresAt = Date.now() + Number(args[2]);
          response = `:${entry ? 1 : 0}\r\n`;
        } else if (command === 'PTTL') {
          response = `:${ttlOf(args[1])}\r\n`;
        } else if (command === 'SET') {
          const pxIndex = args.findIndex((arg: string) => String(arg).toUpperCase() === 'PX');
          const expiresAt = pxIndex > 0 ? Date.now() + Number(args[pxIndex + 1]) : 0;
          store.set(args[1], { value: args[2], expiresAt });
          response = '+OK\r\n';
        } else if (command === 'DEL') {
          let removed = 0;
          for (const key of args.slice(1)) {
            if (store.delete(key)) removed += 1;
          }
          response = `:${removed}\r\n`;
        } else if (command === 'QUIT') {
          response = '+OK\r\n';
          socket.end();
        } else {
          response = `-ERR unknown command '${command}'\r\n`;
        }
        socket.write(response);
      }
    });
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address: any = server.address();
  return {
    url: `redis://127.0.0.1:${address.port}/0`,
    commands,
    close: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
}

/** Parses client commands (arrays of bulk strings) — the mirror of the client codec. */
function decodeRespChunkForCommands(buffer: Buffer): { replies: string[][]; rest: Buffer } {
  const replies: string[][] = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0x2a /* '*' */) break;
    const headerEnd = buffer.indexOf('\r\n', offset);
    if (headerEnd === -1) break;
    const count = Number(buffer.toString('utf8', offset + 1, headerEnd));
    let cursor = headerEnd + 2;
    const args: string[] = [];
    let complete = true;
    for (let i = 0; i < count; i += 1) {
      if (buffer[cursor] !== 0x24 /* '$' */) { complete = false; break; }
      const lengthEnd = buffer.indexOf('\r\n', cursor);
      if (lengthEnd === -1) { complete = false; break; }
      const length = Number(buffer.toString('utf8', cursor + 1, lengthEnd));
      if (buffer.length < lengthEnd + 2 + length + 2) { complete = false; break; }
      args.push(buffer.toString('utf8', lengthEnd + 2, lengthEnd + 2 + length));
      cursor = lengthEnd + 2 + length + 2;
    }
    if (!complete) break;
    replies.push(args);
    offset = cursor;
  }
  return { replies, rest: buffer.subarray(offset) };
}

async function run() {
  console.log('--- SHARED (REDIS-BACKED) RATE LIMITING ---');

  // 1. Connection string + protocol primitives.
  assert.deepEqual(parseRedisUrl('redis://user:pass@example.test:6380/3'), {
    host: 'example.test', port: 6380, username: 'user', password: 'pass', database: 3, tls: false
  });
  assert.deepEqual(parseRedisUrl('rediss://cache.internal')?.tls, true);
  assert.equal(parseRedisUrl('http://example.test'), null);
  assert.equal(parseRedisUrl('not a url'), null);

  const decoded = decodeRespChunk(Buffer.from('+OK\r\n:42\r\n$3\r\nabc\r\n*2\r\n$1\r\na\r\n:7\r\n'));
  assert.equal(decoded.replies[0], 'OK');
  assert.equal(decoded.replies[1], 42);
  assert.equal(decoded.replies[2], 'abc');
  assert.deepEqual(decoded.replies[3], ['a', 7]);
  assert.equal(decoded.rest.length, 0);
  const partial = decodeRespChunk(Buffer.from('$5\r\nabc'));
  assert.equal(partial.replies.length, 0);
  assert.equal(partial.rest.toString(), '$5\r\nabc');
  pass('Redis URL parsing and RESP framing are handled without an external client');

  // 2. Two limiter instances (two app processes) share one counter.
  const fake = await startFakeRedis();
  try {
    const processA = new RedisFixedWindowRateLimiter({ url: fake.url, namespace: 'test:shared' });
    const processB = new RedisFixedWindowRateLimiter({ url: fake.url, namespace: 'test:shared' });

    assert.equal((await processA.consume('login:1.2.3.4', 3, 60_000)).allowed, true);
    assert.equal((await processB.consume('login:1.2.3.4', 3, 60_000)).allowed, true);
    assert.equal((await processA.consume('login:1.2.3.4', 3, 60_000)).allowed, true);
    const blocked = await processB.consume('login:1.2.3.4', 3, 60_000);
    assert.equal(blocked.allowed, false, 'the fourth request is rejected by the OTHER instance');
    assert.ok((blocked.retryAfterSeconds || 0) > 0);
    assert.ok(fake.commands.some(command => command[0].toUpperCase() === 'PEXPIRE'), 'the window is given a TTL');
    pass('Two API instances share one limiter counter through Redis');

    // A different key is unaffected, and an expired window resets the counter.
    assert.equal((await processB.consume('login:5.6.7.8', 3, 60_000)).allowed, true);
    assert.equal((await processB.consume('short-window', 1, 40)).allowed, true);
    assert.equal((await processB.consume('short-window', 1, 40)).allowed, false);
    await new Promise(resolve => setTimeout(resolve, 90));
    assert.equal((await processB.consume('short-window', 1, 40)).allowed, true, 'the shared window really expires');
    pass('Shared limits are per key and reset when the window expires');

    // 3. Login lockout: local tracker blocks one process, shared trackers block all.
    const localTracker = createAttemptTracker({ namespace: 'test:local-lockout', maxFailures: 3, failureWindowMs: 60_000, blockMs: 60_000 });
    assert.equal((await localTracker.check('acct')).allowed, true);
    await localTracker.recordFailure('acct');
    await localTracker.recordFailure('acct');
    const almostLocked = await localTracker.check('acct');
    assert.equal(almostLocked.allowed, true, 'the key is still usable below the threshold');
    await localTracker.recordFailure('acct');
    const locked = await localTracker.check('acct');
    assert.equal(locked.allowed, false, 'the key is locked after the configured number of failures');
    assert.ok((locked.remainingSeconds || 0) > 0);
    await localTracker.recordSuccess('acct');
    assert.equal((await localTracker.check('acct')).allowed, true, 'a successful login clears the lockout');
    pass('The login lockout blocks a key after repeated failures and clears on success');

    const previousRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = fake.url;
    try {
      const trackerA = createAttemptTracker({ namespace: 'test:shared-lockout', maxFailures: 3, failureWindowMs: 60_000, blockMs: 60_000 });
      const trackerB = createAttemptTracker({ namespace: 'test:shared-lockout', maxFailures: 3, failureWindowMs: 60_000, blockMs: 60_000 });
      await trackerA.recordFailure('shared-acct');
      await trackerB.recordFailure('shared-acct');
      await trackerA.recordFailure('shared-acct');
      const sharedLock = await trackerB.check('shared-acct');
      assert.equal(sharedLock.allowed, false, 'failures recorded by one instance lock the key on every instance');
      assert.ok((sharedLock.remainingSeconds || 0) > 0);
      await trackerB.recordSuccess('shared-acct');
      assert.equal((await trackerA.check('shared-acct')).allowed, true, 'a success on any instance clears the shared lockout');
      if ('close' in (trackerA as any)) (trackerA as any).close();
      if ('close' in (trackerB as any)) (trackerB as any).close();
      pass('Login lockouts are shared across instances when Redis is configured');
    } finally {
      if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previousRedisUrl;
    }

    // 4. Redis failure falls back to the in-process limiter instead of blocking traffic.
    const broken = await startFakeRedis();
    const brokenUrl = broken.url;
    await broken.close();
    const fallbackLimiter = new RedisFixedWindowRateLimiter({ url: brokenUrl, namespace: 'test:fallback', commandTimeoutMs: 300 });
    const first = await fallbackLimiter.consume('contact:9.9.9.9', 2, 60_000);
    const second = await fallbackLimiter.consume('contact:9.9.9.9', 2, 60_000);
    const third = await fallbackLimiter.consume('contact:9.9.9.9', 2, 60_000);
    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false, 'the in-process fallback still enforces the limit');
    pass('An unreachable Redis degrades to the in-process limiter instead of failing open completely');

    // 5. Configuration factory.
    const previousUrl = process.env.REDIS_URL;
    const previousBackend = process.env.RATE_LIMIT_BACKEND;
    try {
      process.env.REDIS_URL = fake.url;
      delete process.env.RATE_LIMIT_BACKEND;
      const sharedFactory = createRateLimiter({ namespace: 'test:factory' });
      assert.ok(sharedFactory instanceof RedisFixedWindowRateLimiter);
      (sharedFactory as RedisFixedWindowRateLimiter).close();
      process.env.RATE_LIMIT_BACKEND = 'memory';
      assert.ok(createRateLimiter({ namespace: 'test:factory' }) instanceof FixedWindowRateLimiter);
      delete process.env.REDIS_URL;
      assert.ok(createRateLimiter({ namespace: 'test:factory' }) instanceof FixedWindowRateLimiter);
    } finally {
      if (previousUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previousUrl;
      if (previousBackend === undefined) delete process.env.RATE_LIMIT_BACKEND;
      else process.env.RATE_LIMIT_BACKEND = previousBackend;
    }
    pass('REDIS_URL opts into the shared limiter; RATE_LIMIT_BACKEND=memory keeps it in-process');

    // Release the shared connections so the process can exit cleanly.
    processA.close();
    processB.close();
    fallbackLimiter.close();
  } finally {
    await fake.close();
  }
}

run().then(() => {
  console.log('\nShared rate limiting passed.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
