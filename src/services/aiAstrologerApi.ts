/**
 * ASTRO SIVAM source-based astrologer — browser client.
 *
 * Every call goes to /api/ai_astrologer.php, which requires an authenticated
 * account on every request. Customers need an active paid-report entitlement;
 * admins bypass purchase and daily-usage limits. The client never decides who
 * is allowed to ask - it only renders what the server allows, including 403 and
 * 429 responses.
 *
 * No AI key is used. Replies are built locally in PHP from chart data and curated knowledge.
 */
import { API_BASE, safeJson } from './api';

const ENDPOINT = `${API_BASE}/ai_astrologer.php`;

export type ChatLanguage = 'en' | 'ta' | 'hi';
export type MessageRole = 'customer' | 'assistant' | 'system' | 'handoff';

/**
 * GUIDED MODE — one curated question option. Customers pick an option id;
 * they never type a question. Only complaint options with `needsDetails`
 * accept a short detail line, which is queued to the human team.
 */
export type GuidedKind = 'area' | 'service' | 'dosha' | 'remedy' | 'order' | 'complaint';

export interface GuidedQuestion {
  id: string;
  kind: GuidedKind;
  text: string;
  needsDetails: boolean;
}

export interface GuidedCategory {
  id: string;
  icon: string;
  title: string;
  hint: string;
  questions: GuidedQuestion[];
}

/**
 * One of the customer's own delivered reports, which this conversation can be
 * attached to. Only the Wedding Matching / Baby Naming / Subha Muhurtham
 * chapters need it — they are answered by reading the attached report.
 */
export interface AttachableOrder {
  orderNumber: string;
  serviceType: string;
  deliveredAt: string | null;
  /** Service name in the customer's language, supplied by the server. */
  title: string;
}

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

  /** True when the local knowledge files or server setup need attention. */
  get isSetupProblem(): boolean {
    return this.code === 'LOCAL_KNOWLEDGE_UNAVAILABLE';
  }
}

  /** Browser-side abort protects chart rebuilding and local source retrieval. */
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

  /**
   * The guided menu: categories with curated options in the customer's
   * language. The server decides which chapters this account is entitled to
   * (the three service chapters need a delivered report of that service) and
   * returns the reports this conversation may be attached to.
   */
  async options(language: ChatLanguage): Promise<{
    language: ChatLanguage; categories: GuidedCategory[];
    entitledServices: string[]; orders: AttachableOrder[];
  }> {
    return call('options', { language }, 'GET');
  },

  /**
   * Attaches one of the customer's own delivered reports to this
   * conversation, so the service chapters read from it. Pass an empty
   * orderNumber to detach. The server re-checks ownership and delivery.
   */
  async bind(sessionId: string, orderNumber: string): Promise<{
    sessionId: string; orderNumber: string | null; serviceType: string | null; serviceTitle: string | null;
  }> {
    return call('bind', { sessionId, orderNumber });
  },

  /**
   * Sends one picked option. `questionId` is the curated option id;
   * `complaintDetails` is the optional short line on complaint options.
   * `question` (free text) is accepted from administrator sessions only.
   */
  async ask(sessionId: string, input: { questionId?: string; question?: string; complaintDetails?: string }, language: ChatLanguage): Promise<{
    messageId: number; content: string; bubbles: string[]; sources: string;
    areaId: string | null; handoff: boolean; latencyMs: number;
    remainingToday: number | null; unlimited: boolean;
    /** The curated option id the server answered, when one was sent. */
    guidedId?: string | null;
    /** True when the question was forwarded to the admin escalation queue. */
    escalated?: boolean;
  }> {
    return call('ask', { sessionId, ...input, language }, 'POST', ASK_TIMEOUT_MS);
  },

  async usage(): Promise<{
    used: number | null; limit: number | null; remaining: number | null; unlimited: boolean;
  }> {
    return call('usage', {}, 'GET');
  },

  /** Admin-only local health check. It never makes an outbound network call. */
  async diagnose(): Promise<{
    ok: boolean;
    configured: false;
    /** The only supported mode is local knowledge-base replies. */
    mode?: 'knowledge-base';
    blocking: string[];
    checks: { id: string; label: string; ok: boolean; detail: string }[];
    ping: { attempted: boolean; ok: boolean; httpStatus: number; latencyMs: number; error: string };
    sourceRegistry?: {
      total: number;
      excluded: number;
      citableTamil: number;
      byVerification: Record<string, number>;
    };
    recentMessages: {
      window?: number; failed?: number; sent?: number; lastError?: string | null;
      slowestLatencyMs?: number; error?: string;
    };
    generatedAt: string;
  }> {
    return call('diagnose', {}, 'GET', 40000);
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
