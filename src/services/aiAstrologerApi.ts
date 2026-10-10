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

  constructor(status: number, body: any) {
    super(body?.message || 'Something went wrong. Please try again.');
    this.name = 'AiAstrologerError';
    this.status = status;
    this.code = String(body?.code || body?.message || 'UNKNOWN');
    this.messageTa = body?.message_ta;
    this.messageHi = body?.message_hi;
    this.retryAfterSeconds = body?.retryAfterSeconds;
    this.retryable = body?.retry === true || status === 503 || status === 429;
  }
}

async function call(action: string, body: Record<string, unknown> = {}, method: 'POST' | 'GET' = 'POST') {
  const url = method === 'GET'
    ? `${ENDPOINT}?action=${action}&${new URLSearchParams(body as any).toString()}`
    : `${ENDPOINT}?action=${action}`;

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

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
  }> {
    return call('ask', { sessionId, question, language });
  },

  async usage(): Promise<{
    used: number | null; limit: number | null; remaining: number | null; unlimited: boolean;
  }> {
    return call('usage', {}, 'GET');
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
