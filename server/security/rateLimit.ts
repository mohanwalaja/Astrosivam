export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * A limiter usable by every route. The contract is async so a deployment can
 * swap the in-process counter for a shared store (Redis) without touching the
 * call sites.
 */
export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number, now?: number): Promise<RateLimitResult>;
}

interface RateRecord {
  count: number;
  resetAt: number;
}

/**
 * Small fixed-window limiter for a single process. It bounds both request
 * volume and retained keys. Multi-instance deployments should use
 * `createRateLimiter()` with REDIS_URL set, or enforce the limit at the edge.
 */
export class FixedWindowRateLimiter implements RateLimiter {
  private readonly records = new Map<string, RateRecord>();

  constructor(private readonly maxKeys = 10_000) {}

  async consume(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
    return this.consumeSync(key, limit, windowMs, now);
  }

  /** Synchronous core, also used as the fallback when a shared store is down. */
  consumeSync(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
    const safeKey = String(key || '').slice(0, 128);
    if (!safeKey || !Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000) || 1) };
    }

    const existing = this.records.get(safeKey);
    if (existing && existing.resetAt > now) {
      if (existing.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
      }
      existing.count += 1;
      return { allowed: true };
    }

    if (existing) this.records.delete(safeKey);
    if (this.records.size >= this.maxKeys) {
      for (const [storedKey, record] of this.records) {
        if (record.resetAt <= now) this.records.delete(storedKey);
      }
      if (this.records.size >= this.maxKeys) {
        return { allowed: false, retryAfterSeconds: 60 };
      }
    }

    this.records.set(safeKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// Minimal RESP (Redis protocol) client — no external dependency.
//
// Only the handful of commands a fixed-window limiter needs are supported, over
// a single serialized connection with lazy reconnect. Keeping this in-tree means
// enabling a shared limiter is a configuration change, not a dependency change.
// ---------------------------------------------------------------------------

export interface RedisConnectionOptions {
  url: string;
  commandTimeoutMs?: number;
  connectTimeoutMs?: number;
  onError?: (error: Error) => void;
}

export function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
  username?: string;
  database?: number;
  tls: boolean;
} | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') return null;
    const database = parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : undefined;
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? Number(parsed.port) : 6379,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      database: Number.isInteger(database) ? database : undefined,
      tls: parsed.protocol === 'rediss:'
    };
  } catch {
    return null;
  }
}

type RespValue = string | number | null | RespValue[] | Error;

/** RESP nil ($-1 / *-1) — distinct from `null`, which means "incomplete frame". */
const NIL_SENTINEL = Symbol('resp-nil');

/**
 * Splits a RESP stream into complete replies. Exported for unit testing.
 *
 * Parsing is transactional: an incomplete reply leaves the cursor untouched so
 * the same bytes are re-parsed once the rest of the frame arrives.
 */
export function decodeRespChunk(buffer: Buffer): { replies: RespValue[]; rest: Buffer } {
  const replies: RespValue[] = [];
  let bufferOffset = 0;
  let cursor = 0;
  const NIL: typeof NIL_SENTINEL = NIL_SENTINEL;
  type ParseResult = RespValue | typeof NIL_SENTINEL | null;

  const readLine = (): string | null => {
    const end = buffer.indexOf('\r\n', cursor);
    if (end === -1) return null;
    const line = buffer.toString('utf8', cursor, end);
    cursor = end + 2;
    return line;
  };

  // Depth-first parse; returns null (and rewinds) when more bytes are needed.
  const parseValue = (): ParseResult => {
    const start = cursor;
    const rewind = () => {
      cursor = start;
      return null;
    };
    if (cursor >= buffer.length) return rewind();
    const type = String.fromCharCode(buffer[cursor]);
    const line = readLine();
    if (line === null) return rewind();
    const body = line.slice(1);
    switch (type) {
      case '+':
        return body;
      case '-':
        return new Error(body);
      case ':':
        return Number(body);
      case '$': {
        const length = Number(body);
        if (length === -1) return NIL;
        if (!Number.isFinite(length) || length < 0) return rewind();
        if (buffer.length < cursor + length + 2) return rewind();
        const value = buffer.toString('utf8', cursor, cursor + length);
        cursor += length + 2;
        return value;
      }
      case '*': {
        const count = Number(body);
        if (count === -1) return NIL;
        if (!Number.isFinite(count) || count < 0) return rewind();
        const items: RespValue[] = [];
        for (let i = 0; i < count; i += 1) {
          const item = parseValue();
          if (item === null) return rewind();
          items.push(item === NIL ? null : item);
        }
        return items;
      }
      default:
        return rewind();
    }
  };

  while (cursor < buffer.length) {
    const value = parseValue();
    if (value === null) break;
    replies.push(value === NIL ? null : value);
    bufferOffset = cursor;
  }

  return { replies, rest: buffer.subarray(bufferOffset) };
}

function encodeCommand(args: string[]): Buffer {
  const parts = [`*${args.length}\r\n`];
  for (const arg of args) {
    const text = String(arg);
    parts.push(`$${Buffer.byteLength(text)}\r\n${text}\r\n`);
  }
  return Buffer.from(parts.join(''), 'utf8');
}

export class RedisConnection {
  private socket: import('node:net').Socket | null = null;
  private buffer = Buffer.alloc(0);
  private pending: Array<{ resolve: (value: RespValue) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }> = [];
  private connecting: Promise<void> | null = null;
  private ready = false;
  private closed = false;
  /** Set while closing on purpose so an expected teardown is not reported as an outage. */
  private closing = false;

  constructor(private readonly options: RedisConnectionOptions) {}

  private notifyError(error: Error) {
    this.options.onError?.(error);
  }

  async connect(): Promise<void> {
    if (this.ready) return;
    if (this.connecting) return this.connecting;
    // A previous failure/teardown closed the socket; this call opens a fresh one.
    this.closed = false;
    this.closing = false;
    this.connecting = (async () => {
      const target = parseRedisUrl(this.options.url);
      if (!target) throw new Error('REDIS_URL is not a valid redis:// or rediss:// URL.');
      const net = await import('node:net');
      const tls = await import('node:tls');
      const connectTimeout = this.options.connectTimeoutMs ?? 3_000;

      await new Promise<void>((resolve, reject) => {
        const onConnectError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const socket = target.tls
          ? tls.connect({ host: target.host, port: target.port, servername: target.host }, () => { cleanup(); resolve(); })
          : net.connect({ host: target.host, port: target.port }, () => { cleanup(); resolve(); });
        const timer = setTimeout(() => onConnectError(new Error('Redis connection timed out.')), connectTimeout);
        function cleanup() {
          clearTimeout(timer);
          socket.off('error', onConnectError);
        }
        socket.once('error', onConnectError);
        this.socket = socket as import('node:net').Socket;
      });

      const socket = this.socket!;
      socket.setNoDelay(true);
      socket.on('data', chunk => this.onData(chunk));
      socket.on('error', error => this.failAll(error instanceof Error ? error : new Error(String(error))));
      socket.on('close', () => {
        this.ready = false;
        this.connecting = null;
        // Always settle in-flight commands: awaiting forever would stall the
        // request that is being rate-limited.
        this.failAll(new Error('Redis connection closed.'));
      });

      if (target.password) {
        const authArgs = target.username ? ['AUTH', target.username, target.password] : ['AUTH', target.password];
        const authReply = await this.send(authArgs);
        if (authReply instanceof Error) throw authReply;
      }
      if (target.database !== undefined && target.database > 0) {
        const selectReply = await this.send(['SELECT', String(target.database)]);
        if (selectReply instanceof Error) throw selectReply;
      }
      this.ready = true;
    })().catch(error => {
      this.connecting = null;
      throw error;
    });
    return this.connecting;
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const { replies, rest } = decodeRespChunk(this.buffer);
    this.buffer = rest;
    for (const reply of replies) {
      const entry = this.pending.shift();
      if (!entry) break;
      clearTimeout(entry.timer);
      entry.resolve(reply);
    }
  }

  private failAll(error: Error) {
    const pending = this.pending;
    this.pending = [];
    for (const entry of pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    try { this.socket?.destroy(); } catch { /* ignore */ }
    this.socket = null;
    this.ready = false;
    if (!this.closing) this.notifyError(error);
  }

  send(args: string[]): Promise<RespValue> {
    return new Promise<RespValue>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Redis connection is not established.'));
        return;
      }
      const timeout = this.options.commandTimeoutMs ?? 2_000;
      const timer = setTimeout(() => {
        this.pending = this.pending.filter(entry => entry.timer !== timer);
        reject(new Error('Redis command timed out.'));
      }, timeout);
      this.pending.push({ resolve, reject, timer });
      try {
        this.socket.write(encodeCommand(args));
      } catch (error: any) {
        clearTimeout(timer);
        this.pending = this.pending.filter(entry => entry.timer !== timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  close() {
    this.closed = true;
    // Keep `closing` set until the next connect(): the socket 'close' event is
    // delivered asynchronously and must not be reported as a Redis outage.
    this.closing = true;
    try { this.socket?.end(); } catch { /* ignore */ }
    this.socket = null;
    this.ready = false;
  }
}

export interface RedisRateLimiterOptions {
  url: string;
  /** Prefix so several apps can share one Redis database safely. */
  namespace?: string;
  commandTimeoutMs?: number;
  /**
   * When the shared store is unreachable, fall back to the in-process limiter
   * (fail-open, keeps the site available) instead of rejecting requests.
   */
  failOpen?: boolean;
}

/**
 * Fixed-window limiter backed by Redis (INCR + PEXPIRE), so every instance of
 * the API enforces the SAME counter. Falls back to the in-process limiter (and
 * reports the failure once a minute) when Redis cannot be reached.
 */
export class RedisFixedWindowRateLimiter implements RateLimiter {
  private readonly fallback = new FixedWindowRateLimiter();
  private readonly connection: RedisConnection;
  private lastErrorAt = 0;

  constructor(private readonly options: RedisRateLimiterOptions) {
    this.connection = new RedisConnection({
      url: options.url,
      commandTimeoutMs: options.commandTimeoutMs,
      onError: error => {
        const now = Date.now();
        if (now - this.lastErrorAt > 60_000) {
          this.lastErrorAt = now;
          console.warn(`[RateLimit] Shared Redis limiter unavailable (${error.message}); using in-process fallback.`);
        }
      }
    });
  }

  /** Release the shared connection (used by tests and graceful shutdown). */
  close(): void {
    this.connection.close();
  }

  async consume(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
    const safeKey = String(key || '').slice(0, 128);
    if (!safeKey || !Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000) || 1) };
    }

    try {
      await this.connection.connect();
      const redisKey = `${this.options.namespace || 'astrosivam:rl'}:${safeKey}`;
      const countReply = await this.connection.send(['INCR', redisKey]);
      if (countReply instanceof Error) throw countReply;
      const count = Number(countReply);
      if (!Number.isFinite(count)) throw new Error('Redis returned a non-numeric counter.');
      if (count === 1) {
        await this.connection.send(['PEXPIRE', redisKey, String(Math.ceil(windowMs))]);
      }
      if (count > limit) {
        const ttlReply = await this.connection.send(['PTTL', redisKey]);
        const ttl = Number(ttlReply);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs) / 1000)) };
      }
      return { allowed: true };
    } catch (error: any) {
      this.connection.close();
      if (this.options.failOpen === false) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)) };
      }
      return this.fallback.consumeSync(safeKey, limit, windowMs, now);
    }
  }
}

// ---------------------------------------------------------------------------
// Attempt tracking (login lockout): count failures per key and block the key
// for a cooldown once the threshold is reached. Shared when Redis is available.
// ---------------------------------------------------------------------------

export interface AttemptDecision {
  allowed: boolean;
  remainingSeconds?: number;
}

export interface AttemptTracker {
  check(key: string): Promise<AttemptDecision>;
  recordFailure(key: string): Promise<void>;
  recordSuccess(key: string): Promise<void>;
}

export interface AttemptTrackerOptions {
  namespace: string;
  maxFailures?: number;
  /** How long a failure counts towards the threshold. */
  failureWindowMs?: number;
  /** How long the key stays blocked after too many failures. */
  blockMs?: number;
  /** Bound on locally retained keys (in-process fallback). */
  maxKeys?: number;
}

interface LocalAttemptRecord {
  failures: number;
  blockedUntil: number;
  updatedAt: number;
}

/** In-process attempt tracker — also the fallback when Redis is unreachable. */
class LocalAttemptTracker implements AttemptTracker {
  private readonly records = new Map<string, LocalAttemptRecord>();

  constructor(
    private readonly maxFailures: number,
    private readonly failureWindowMs: number,
    private readonly blockMs: number,
    private readonly maxKeys: number
  ) {}

  private prune(now: number) {
    for (const [key, record] of this.records) {
      const expired = record.updatedAt + this.failureWindowMs <= now;
      const blockExpired = record.blockedUntil !== 0 && record.blockedUntil <= now;
      if (expired || blockExpired) this.records.delete(key);
    }
  }

  async check(key: string): Promise<AttemptDecision> {
    const now = Date.now();
    const record = this.records.get(key);
    if (!record) return { allowed: true };
    if (record.blockedUntil > now) {
      return { allowed: false, remainingSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
    }
    if (record.updatedAt + this.failureWindowMs <= now || (record.blockedUntil !== 0 && record.blockedUntil <= now)) {
      this.records.delete(key);
    }
    return { allowed: true };
  }

  async recordFailure(key: string): Promise<void> {
    const now = Date.now();
    let record = this.records.get(key);
    if (record && (record.updatedAt + this.failureWindowMs <= now || (record.blockedUntil !== 0 && record.blockedUntil <= now))) {
      this.records.delete(key);
      record = undefined;
    }
    if (!record) {
      this.prune(now);
      if (this.records.size >= this.maxKeys) {
        const oldest = this.records.keys().next().value;
        if (oldest !== undefined) this.records.delete(oldest);
      }
      record = { failures: 0, blockedUntil: 0, updatedAt: now };
    }
    record.failures += 1;
    record.updatedAt = now;
    if (record.failures >= this.maxFailures) record.blockedUntil = now + this.blockMs;
    this.records.delete(key);
    this.records.set(key, record);
  }

  async recordSuccess(key: string): Promise<void> {
    this.records.delete(key);
  }
}

/** Shared attempt tracker: identical semantics, one counter for every instance. */
class RedisAttemptTracker implements AttemptTracker {
  private readonly local: LocalAttemptTracker;
  private lastErrorAt = 0;

  constructor(
    private readonly options: Required<AttemptTrackerOptions>,
    private readonly connection: RedisConnection
  ) {
    this.local = new LocalAttemptTracker(options.maxFailures, options.failureWindowMs, options.blockMs, options.maxKeys);
  }

  private reportFallback(error: Error) {
    const now = Date.now();
    if (now - this.lastErrorAt > 60_000) {
      this.lastErrorAt = now;
      console.warn(`[RateLimit] Shared attempt tracker unavailable (${error.message}); using in-process fallback.`);
    }
  }

  private key(kind: 'fail' | 'block', key: string): string {
    return `${this.options.namespace}:${kind}:${String(key).slice(0, 128)}`;
  }

  /** Release the shared connection (used by tests and graceful shutdown). */
  close(): void {
    this.connection.close();
  }

  async check(key: string): Promise<AttemptDecision> {
    try {
      await this.connection.connect();
      const ttl = await this.connection.send(['PTTL', this.key('block', key)]);
      if (ttl instanceof Error) throw ttl;
      const remainingMs = Number(ttl);
      if (Number.isFinite(remainingMs) && remainingMs > 0) {
        return { allowed: false, remainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
      }
      return { allowed: true };
    } catch (error: any) {
      this.connection.close();
      this.reportFallback(error instanceof Error ? error : new Error(String(error)));
      return this.local.check(key);
    }
  }

  async recordFailure(key: string): Promise<void> {
    try {
      await this.connection.connect();
      const failures = Number(await this.connection.send(['INCR', this.key('fail', key)]));
      if (!Number.isFinite(failures)) throw new Error('Redis returned a non-numeric failure count.');
      if (failures === 1) {
        await this.connection.send(['PEXPIRE', this.key('fail', key), String(this.options.failureWindowMs)]);
      }
      if (failures >= this.options.maxFailures) {
        await this.connection.send(['SET', this.key('block', key), '1', 'PX', String(this.options.blockMs)]);
      }
      return;
    } catch (error: any) {
      this.connection.close();
      this.reportFallback(error instanceof Error ? error : new Error(String(error)));
      await this.local.recordFailure(key);
    }
  }

  async recordSuccess(key: string): Promise<void> {
    try {
      await this.connection.connect();
      await this.connection.send(['DEL', this.key('fail', key), this.key('block', key)]);
      return;
    } catch (error: any) {
      this.connection.close();
      this.reportFallback(error instanceof Error ? error : new Error(String(error)));
      await this.local.recordSuccess(key);
    }
  }
}

/**
 * Build a login/attempt tracker. Uses Redis (INCR + PX block keys) when
 * REDIS_URL is configured so every instance shares the same lockout state, and
 * falls back to the in-process tracker if the shared store is unavailable.
 */
export function createAttemptTracker(options: AttemptTrackerOptions): AttemptTracker {
  const resolved: Required<AttemptTrackerOptions> = {
    namespace: options.namespace,
    maxFailures: options.maxFailures ?? 5,
    failureWindowMs: options.failureWindowMs ?? 15 * 60_000,
    blockMs: options.blockMs ?? 15 * 60_000,
    maxKeys: options.maxKeys ?? 20_000
  };
  const redisUrl = String(process.env.REDIS_URL || '').trim();
  const backend = String(process.env.RATE_LIMIT_BACKEND || '').trim().toLowerCase();
  if (redisUrl && backend !== 'memory') {
    return new RedisAttemptTracker(resolved, new RedisConnection({
      url: redisUrl,
      commandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS) || 2_000
    }));
  }
  return new LocalAttemptTracker(resolved.maxFailures, resolved.failureWindowMs, resolved.blockMs, resolved.maxKeys);
}

/**
 * Build the limiter for a route module.
 *
 * Set REDIS_URL (redis:// or rediss://) in a multi-instance deployment so every
 * instance shares one counter. Without it the in-process limiter is used, which
 * is correct for a single instance and documented in
 * RATE_LIMITING_AND_PAYMENT_RECOVERY.md.
 */
export function createRateLimiter(options: { maxKeys?: number; namespace?: string } = {}): RateLimiter {
  const redisUrl = String(process.env.REDIS_URL || '').trim();
  const backend = String(process.env.RATE_LIMIT_BACKEND || '').trim().toLowerCase();
  if (redisUrl && backend !== 'memory') {
    return new RedisFixedWindowRateLimiter({
      url: redisUrl,
      namespace: options.namespace || 'astrosivam:rl',
      commandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS) || 2_000,
      failOpen: String(process.env.RATE_LIMIT_FAIL_MODE || 'open').toLowerCase() !== 'closed'
    });
  }
  return new FixedWindowRateLimiter(options.maxKeys);
}
