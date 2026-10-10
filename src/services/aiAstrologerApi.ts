/**
 * ASTRO SIVAM AI Astrologer — browser client.
 *
 * Every call goes to /api/ai_astrologer.php, which requires an authenticated
 * account on every request. Customers need an active paid-report entitlement;
 * admins bypass purchase and daily-usage limits. The client never decides who
 * is allowed to ask - it only renders what the server allows, including 403 and
 * 429 responses.
 *
 * No AI key ever reaches this file. Model calls happen only in PHP.
 */
import { API_BASE, safeJson } from './api';

const ENDPOINT = `${API_BASE}/ai_astrologer.php`;

export type ChatLanguage = 'en' | 'ta' | 'hi';
export type MessageRole = 'customer' | 'assistant' | 'system' | 'handoff';

export interface ChatMessage {
  id: number;
  role: MessageRole;
  language: ChatLanguage;
  content: string;
  areaId?: string | null;
  sources?: string | null;
  createdAt: string;
  /** Set locally while the reply is being produced. */
  pending?: boolean;
}

export interface ChatSession {
  id: string;
  language: ChatLanguage;
  orderNumber: string | null;
  serviceType: string | null;
  status: 'ACTIVE' | 'CLOSED';
  messageCount: number;
}

export class AiAstrologerError extends Error {
  code: string;
  status: number;
  /** Server-provided wording in the customer's language, when there is one. */
  messageTa?: string;
  messageHi?: string;
  retryAfterSeconds?: number;
  retryable: boolean;
  /**
   * Which server-side check failed, when the server knows (configuration
   * problems only). Never contains a credential.
   */
  blocking?: string[];
  /** Full admin diagnostic report, present only for an administrator. */
  diagnostics?: any;

  constructor(status: number, body: any) {
    super(body?.message || 'Something went wrong. Please try again.');
    this.name = 'AiAstrologerError';
    this.status = status;
    this.code = String(body?.code || body?.message || 'UNKNOWN');
    this.messageTa = body?.message_ta;
    this.messageHi = body?.message_hi;
    this.retryAfterSeconds = body?.retryAfterSeconds;
    this.retryable = body?.retry === true || status === 503 || status === 429;
    this.blocking = Array.isArray(body?.blocking) ? body.blocking : undefined;
    this.diagnostics = body?.diagnose ?? undefined;
  }

  /**
   * True when the failure is a server setup problem rather than a slow or
   * flaky model. Those never fix themselves by retrying, so hiding them behind
   * "I am checking again" is what left the chat looking broken with nothing on
   * screen to explain it: the customer waited, retried, and got the same line
   * forever while the real cause sat in a server log nobody was reading.
   */
  get isSetupProblem(): boolean {
    return this.code === 'AI_NOT_CONFIGURED';
  }
}

/** Browser-side abort for a request. Sits above the server's 25s model timeout. */
const ASK_TIMEOUT_MS = 30000;

async function call(
  action: string,
  body: Record<string, unknown> = {},
  method: 'POST' | 'GET' = 'POST',
  timeoutMs?: number,
) {
  const url = method === 'GET'
    ? `${ENDPOINT}?action=${action}&${new URLSearchParams(body as any).toString()}`
    : `${ENDPOINT}?action=${action}`;

  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
  } catch (e) {
    // A timed-out or dropped connection gets the same retryable error as a 503.
    throw new AiAstrologerError(503, { code: 'NETWORK_TIMEOUT', retry: true });
  } finally {
    if (timer) clearTimeout(timer);
  }

  const data = await safeJson<any>(res);
  if (!res.ok || data?.success === false) {
    throw new AiAstrologerError(res.status, data);
  }
  return data;
}

export const aiAstrologer = {
  /** Opens a conversation. Pass orderId to bind it to a specific report. */
  async createSession(opts: { orderId?: string; language?: ChatLanguage } = {}): Promise<{
    sessionId: string; language: ChatLanguage; orderNumber: string | null; serviceType: string | null;
    /** When the bound report was emailed (ISO string), for the welcome greeting. */
    deliveredAt: string | null;
    dailyLimit: number | null; unlimited: boolean;
  }> {
    return call('session', opts);
  },

  async history(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    return call('history', { sessionId }, 'GET');
  },

  async ask(sessionId: string, question: string, language: ChatLanguage): Promise<{
    messageId: number; content: string; bubbles: string[]; sources: string;
    areaId: string | null; handoff: boolean; latencyMs: number;
    remainingToday: number | null; unlimited: boolean;
    /** True when the question was forwarded to the admin escalation queue. */
    escalated?: boolean;
  }> {
    return call('ask', { sessionId, question, language }, 'POST', ASK_TIMEOUT_MS);
  },

  async usage(): Promise<{
    used: number | null; limit: number | null; remaining: number | null; unlimited: boolean;
  }> {
    return call('usage', {}, 'GET');
  },

  /**
   * Admin-only: walks the reply path and reports the first thing that is wrong.
   * `ping` also makes one real (1-token) model call, which is the only way to
   * prove the host can actually reach the model. Without it the call makes no
   * outbound request.
   */
  async diagnose(ping = false): Promise<{
    ok: boolean;
    configured: boolean;
    blocking: string[];
    checks: { id: string; label: string; ok: boolean; detail: string }[];
    ping: { attempted: boolean; ok: boolean; httpStatus: number; latencyMs: number; error: string };
    recentMessages: {
      window?: number; failed?: number; sent?: number; lastError?: string | null;
      slowestLatencyMs?: number; error?: string;
    };
    generatedAt: string;
  }> {
    return call('diagnose', { ping: ping ? '1' : '' }, 'GET', 40000);
  },

  /** Attaches an ASTRO SIVAM report PDF. The server proves ownership. */
  async uploadReport(sessionId: string, file: File): Promise<{
    orderNumber: string; serviceType: string | null; reportType: string | null;
    sections: { id: string; title: string; page: number }[];
  }> {
    const form = new FormData();
    form.append('sessionId', sessionId);
    form.append('report', file);

    const res = await fetch(`${ENDPOINT}?action=upload`, {
      method: 'POST',
      credentials: 'include',
      // No Content-Type header: the browser must set the multipart boundary.
      body: form,
    });
    const data = await safeJson<any>(res);
    if (!res.ok || data?.success === false) {
      throw new AiAstrologerError(res.status, data);
    }
    return data;
  },

  async requestHandoff(sessionId: string | null, question: string, language: ChatLanguage, reason = 'requested') {
    return call('handoff', { sessionId, question, language, reason });
  },
};
