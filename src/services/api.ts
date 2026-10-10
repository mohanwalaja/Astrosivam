import { AppLanguage, ServiceType, PaymentMethod, CurrencyCode, User, CustomerBirthProfile, Order, OrderItem, SystemSettings, Statistics, AuditLog, AiChatHandoff, TeamMember, ContactMessage, AdminAnalyticsData, BannedIpEntry, OnlinePaymentSession } from '../types';

export function getApiBase(): string {
  // Always default to relative '/api' in browser contexts.
  // This automatically routes to whatever origin the app is currently served from (localhost, AI Studio preview, astrosivam.com).
  return '/api';
}

export const API_BASE = getApiBase();

/**
 * SECURITY (H3): the auth token must NEVER be persisted in localStorage (or
 * any other script-readable storage). The backend sets it as an httpOnly
 * cookie at login, the browser attaches it automatically, and this module
 * keeps at most an in-memory copy for the Authorization header fallback -
 * enough for older API deployments, gone on reload and unreadable to XSS
 * looking for a stored credential.
 */
let inMemoryAuthToken = '';

/**
 * Pre-H3 releases persisted the token under these keys. They are purged on
 * every load and on every auth transition so a previously stored 30-day
 * credential cannot keep living in web-accessible storage.
 */
const LEGACY_TOKEN_STORAGE_KEYS = ['astrosivam_token', 'astrofiji_token', 'fijiastro_token'];

function purgeLegacyStoredTokens(): void {
  try {
    for (const key of LEGACY_TOKEN_STORAGE_KEYS) localStorage.removeItem(key);
  } catch (e) {
    // Storage may be unavailable (private mode); nothing to purge then.
  }
}

// Migrate existing installs: drop any token that older releases left behind.
purgeLegacyStoredTokens();

export function getAuthToken(): string {
  return inMemoryAuthToken;
}

export function setAuthToken(token: string): void {
  inMemoryAuthToken = token || '';
  purgeLegacyStoredTokens();
}

export function clearAuthToken(): void {
  inMemoryAuthToken = '';
  purgeLegacyStoredTokens();
}

function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    'X-Authorization': `Bearer ${token}`,
    'X-Auth-Token': token
  };
}

// Resilient JSON parser that gracefully handles server errors, HTML 404/500 pages, and empty responses without throwing JSON SyntaxError
export async function safeJson<T = any>(res: Response): Promise<T> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      if (res.ok) {
        return { success: true } as any;
      }
      return {
        success: false,
        message: `Empty response received from server (HTTP ${res.status}).`,
        status: res.status
      } as any;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith('<?php') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<?')) {
      return {
        success: false,
        message: 'Server response was not in JSON format.',
        status: res.status === 200 ? 502 : res.status
      } as any;
    }
    return JSON.parse(text);
  } catch (err) {
    let fallbackMsg = 'Server response was not in JSON format.';
    if (res.status === 404) {
      fallbackMsg = 'The requested API endpoint was not found on your hosting (HTTP 404). Please ensure the latest /api folder is uploaded to public_html/api.';
    } else if (res.status === 500) {
      fallbackMsg = 'Server Error (HTTP 500). Please check your MySQL database credentials in /api/config.php.';
    } else if (res.status === 403) {
      fallbackMsg = 'Access Denied: You do not have sufficient permissions.';
    }
    return {
      success: false,
      message: fallbackMsg,
      status: res.status
    } as any;
  }
}

function hasJsonContentType(res: Response): boolean {
  return (res.headers.get('content-type') || '').toLowerCase().includes('json');
}

/** Only try a legacy URL when the current URL is genuinely missing/unsupported. */
function isUnavailableApiEndpoint(res: Response, data: any): boolean {
  if (res.status === 405 || res.status === 501) return true;
  if (res.status !== 404) return false;
  const message = String(data?.message || '').toLowerCase();
  return /api endpoint|endpoint .*not found|route .*not found|cannot (get|post|put|delete)|not found on your hosting/.test(message) ||
    !hasJsonContentType(res);
}

function isServerAuthenticatedResponse(data: any): data is { success: true; token: string; user: User } {
  const role = String(data?.user?.role || '').toLowerCase();
  return data?.success === true &&
    typeof data.token === 'string' && data.token.trim().length > 0 &&
    !!data.user && typeof data.user.id === 'string' && data.user.id.length > 0 &&
    typeof data.user.email === 'string' && data.user.email.length > 0 &&
    (role === 'customer' || role === 'admin');
}

/**
 * Try supported PHP/Node auth endpoints, accepting success only when the
 * server provides both a real user record and a signed bearer token. Endpoint
 * fallback is limited to missing/unsupported routes; credential failures are
 * never replaced with a locally fabricated session.
 */
async function postAuthEndpoints(
  endpoints: string[],
  payload: Record<string, unknown>,
  options: { requireAdmin?: boolean } = {}
): Promise<any> {
  let lastMessage = '';
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await safeJson<any>(response);
      if (isServerAuthenticatedResponse(data)) {
        if (options.requireAdmin && String(data.user.role).toLowerCase() !== 'admin') {
          return { success: false, message: 'This account is not provisioned as an administrator.' };
        }
        return data;
      }
      if (response.status === 404 || response.status === 405) {
        lastMessage = data?.message || `Authentication endpoint unavailable (HTTP ${response.status}).`;
        continue;
      }
      if (data?.success) {
        return { success: false, message: 'Authentication server did not issue a verified user session.' };
      }
      return { ...data, success: false, message: data?.message || 'Authentication failed.' };
    } catch (error: any) {
      lastMessage = error?.message || 'Authentication service is unavailable.';
    }
  }
  return { success: false, message: lastMessage || 'Authentication service is unavailable.' };
}

// Universal fetch wrapper supporting both PHP Session cookies and Bearer tokens
async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const report = (message: string, status?: number) => {
    if (url.includes('/client-error')) return;
    // Fire-and-forget: reporting must never interfere with the original request.
    fetch(`${getApiBase()}/services/client-error`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, endpoint: url.replace(window.location.origin, ''), status }) }).catch(() => {});
  };
  try {
    const response = await fetch(url, { credentials: 'include', ...options, headers: { ...getAuthHeader(), ...(options.headers || {}) } });
    if (!response.ok) report(`HTTP ${response.status} request failure`, response.status);
    return response;
  } catch (error: any) {
    report(error?.message || 'Network request failed');
    throw error;
  }
}

/**
 * Payload accepted by the family approve / resend endpoints. Either the PDFs
 * travel inline (legacy, single-body) or they were uploaded one-by-one to the
 * staging endpoint and only the metadata is sent here.
 */
export interface FamilyFulfilPayload {
  reportPdfs?: Array<{ orderId?: string; orderNumber?: string; fileName?: string; pdfBase64: string }>;
  invoicePdfBase64?: string;
  language?: string;
  /** True when every document was uploaded through /stage-doc already. */
  useStagedDocs?: boolean;
  stagedReports?: number;
  stagedInvoice?: boolean;
  stagedBytes?: number;
  /** Require a complete set of browser-rendered preview PDFs; never use server fallbacks. */
  requirePreviewQuality?: boolean;
}

/** Render-quality telemetry returned by the family approve / resend endpoints. */
export interface FamilyFulfilResponse {
  success: boolean;
  message: string;
  orders?: Order[];
  renderQuality?: 'PREVIEW_EXACT' | 'MIXED' | 'SERVER_RENDER';
  invoiceQuality?: 'PREVIEW_EXACT' | 'SERVER_RENDER';
  previewReports?: number;
  serverRenderedReports?: number;
  serverRenderedOrderNumbers?: string[];
  stagedReportsUsed?: number;
  memberCount?: number;
  emailPartCount?: number;
  totalAttachmentBytes?: number;
}

/** Result of a per-item / whole-order multi-person delivery. */
export interface OrderItemsSendResponse {
  success: boolean;
  message: string;
  emailStatus?: 'SENT' | 'FAILED';
  emailMessage?: string;
  orderStatus?: string;
  itemStatuses?: Array<{ id: number; reportStatus: string }>;
  emailPartCount?: number;
  renderQuality?: 'PREVIEW_EXACT' | 'MIXED' | 'SERVER_RENDER';
  attachmentBytes?: number;
}

export interface StageDocPayload {
  kind: 'report' | 'invoice';
  orderId?: string;
  orderNumber?: string;
  fileName?: string;
  pdfBase64: string;
}

export interface StageDocResponse {
  success: boolean;
  message?: string;
  staged?: boolean;
  docKey?: string;
  kind?: string;
  fileName?: string;
  sizeBytes?: number;
  stagedReports?: number;
  stagedInvoice?: boolean;
  /** The deployment has no /stage-doc endpoint (older /api folder). */
  unsupported?: boolean;
  /** The server discarded the request body before PHP could read it. */
  bodyTooLarge?: boolean;
  endpoint?: string;
}

/**
 * POST one rendered PDF to the first staging endpoint that accepts it.
 * 404/405/501 means the deployed /api folder predates staging, so the next
 * endpoint is tried and, when none exist, `unsupported` lets the caller use a
 * bounded inline payload only when the complete request is safely small.
 */
async function postStagedDoc(
  endpoints: string[],
  scope: string,
  doc: StageDocPayload
): Promise<StageDocResponse> {
  let lastMessage = 'Document upload failed.';

  for (const url of endpoints) {
    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: scope, groupId: scope, ...doc })
      });

      if (res.status === 404 || res.status === 405 || res.status === 501) {
        lastMessage = `Staging endpoint not available (HTTP ${res.status}).`;
        continue;
      }

      const data = await safeJson<StageDocResponse>(res);
      if (data && data.success && data.staged) {
        return { ...data, endpoint: url };
      }

      const msg = (data && data.message) || `HTTP ${res.status}`;
      if (!data || data.success === undefined || /endpoint not found/i.test(msg)) {
        lastMessage = msg;
        continue;
      }
      // A real rejection (invalid PDF, unwritable staging area, oversized
      // body): surface it instead of silently downgrading the documents.
      return { ...data, success: false, message: msg, endpoint: url };
    } catch (err: any) {
      lastMessage = err?.message || 'Network error while uploading the rendered PDF.';
    }
  }

  return { success: false, unsupported: true, message: lastMessage };
}

export const api = {
  async getAdminClientErrors(): Promise<{ success: boolean; errors: Array<{ id: string; message: string; endpoint: string; status?: number; createdAt: string; resolvedAt?: string }>; openCount: number }> {
    const res = await apiFetch(`${getApiBase()}/admin/client-errors`); return safeJson(res);
  },
  async resolveAdminClientError(id: string): Promise<{ success: boolean }> {
    const res = await apiFetch(`${getApiBase()}/admin/client-errors/${encodeURIComponent(id)}/resolve`, { method: 'POST' }); return safeJson(res);
  },

  // Public settings
  async getSettings(): Promise<{ success: boolean; settings: SystemSettings }> {
    const apiBase = getApiBase();
    try {
      const res = await fetch(`${apiBase}/services.php?action=settings`);
      const data = await safeJson(res);
      if (data.success || res.status !== 404) return data;
    } catch (e) {}

    const res = await fetch(`${apiBase}/services/settings`);
    return safeJson(res);
  },

  // Public Astrology Team
  async getTeamMembers(): Promise<{ success: boolean; count: number; team: TeamMember[] }> {
    const apiBase = getApiBase();
    try {
      const res = await fetch(`${apiBase}/services.php?action=team`);
      const data = await safeJson(res);
      if (data.success || res.status !== 404) return data;
    } catch (e) {}

    const res = await fetch(`${apiBase}/services/team`);
    return safeJson(res);
  },

  async getAstrologyTeam(): Promise<{ success: boolean; count: number; team: TeamMember[] }> {
    return this.getTeamMembers();
  },

  // Auth - Customer
  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; birthProfile?: CustomerBirthProfile; message?: string }> {
    const apiBase = getApiBase();
    return postAuthEndpoints([
      `${apiBase}/login.php`,
      `${apiBase}/auth/index.php`,
      `${apiBase}/auth/login`
    ], { email: email.toLowerCase().trim(), password, action: 'login' });
  },

  // Auth - Facebook Social Login / Registration
  // SECURITY: only the backend may verify the provider token and create a user.
  async facebookLogin(fbData: { id?: string; name?: string; email?: string; accessToken: string }): Promise<{
    success: boolean;
    token?: string;
    user?: User;
    birthProfile?: CustomerBirthProfile;
    message?: string;
  }> {
    const apiBase = getApiBase();
    if (!fbData.accessToken?.trim()) {
      return { success: false, message: 'A Facebook access token is required.' };
    }
    return postAuthEndpoints([
      `${apiBase}/auth/index.php?action=facebook`,
      `${apiBase}/auth/facebook`
    ], { accessToken: fbData.accessToken, action: 'facebook-login' });
  },

  // Auth - Google Social Login / Registration
  // SECURITY: the backend verifies the ID/access token and resolves identity.
  async googleLogin(googleData: { id?: string; sub?: string; name?: string; email?: string; credential?: string; accessToken?: string }): Promise<{
    success: boolean;
    token?: string;
    user?: User;
    birthProfile?: CustomerBirthProfile;
    message?: string;
  }> {
    const apiBase = getApiBase();
    if (!googleData.credential?.trim() && !googleData.accessToken?.trim()) {
      return { success: false, message: 'A verified Google credential is required.' };
    }
    return postAuthEndpoints([
      `${apiBase}/auth/index.php?action=google`,
      `${apiBase}/auth/google`
    ], {
      credential: googleData.credential,
      accessToken: googleData.accessToken,
      action: 'google-login'
    });
  },

  // Auth - Dedicated Admin Portal Authentication
  async adminLogin(email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; message?: string }> {
    const apiBase = getApiBase();
    return postAuthEndpoints([
      `${apiBase}/login.php?action=admin-login`,
      `${apiBase}/auth/index.php?action=admin-login`,
      `${apiBase}/auth/admin-login`
    ], {
      email: email.toLowerCase().trim(),
      password,
      action: 'admin-login',
      isAdmin: true
    }, { requireAdmin: true });
  },

  /**
   * SECURITY (H3): signing out must clear the httpOnly auth cookie server-side.
   * Dropping client state alone is not enough - the cookie would authenticate
   * the next GET /me and silently sign the user back in. Fire-and-forget from
   * the caller's perspective; local state is dropped either way.
   */
  async logout(): Promise<{ success: boolean }> {
    const apiBase = getApiBase();
    for (const endpoint of [`${apiBase}/auth/index.php?action=logout`, `${apiBase}/auth/logout`]) {
      try {
        const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
        const data = await safeJson<any>(res);
        if (res.status !== 404 && res.status !== 405) return { success: !!data.success };
      } catch (e) {
        // Try the next endpoint; the caller clears local state regardless.
      }
    }
    return { success: false };
  },

  async register(data: {
    name: string;
    email: string;
    mobile: string;
    password: string;
    country: string;
    birthProfile?: Partial<CustomerBirthProfile>;
  }): Promise<{ success: boolean; token?: string; user?: User; birthProfile?: CustomerBirthProfile; message?: string }> {
    const apiBase = getApiBase();
    // 1. Try dedicated register.php endpoint first
    try {
      const res = await fetch(`${apiBase}/register.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action: 'register' })
      });
      const resJson = await safeJson(res);
      const isHtmlFallback = !hasJsonContentType(res) && !resJson.success && res.ok;
      if (!isHtmlFallback && res.status !== 404 && res.status !== 405) return resJson;
    } catch (e) {}

    // 2. Try auth/index.php with query action
    try {
      const res2 = await fetch(`${apiBase}/auth/index.php?action=register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action: 'register' })
      });
      const resJson2 = await safeJson(res2);
      const isHtmlFallback = !hasJsonContentType(res2) && !resJson2.success && res2.ok;
      if (!isHtmlFallback && res2.status !== 404 && res2.status !== 405) return resJson2;
    } catch (e) {}

    // 3. Fallback to /auth/register
    const res3 = await fetch(`${apiBase}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, action: 'register' })
    });
    return safeJson(res3);
  },

  async verifyRegisterOtp(email: string, otp: string, password: string): Promise<{
    success: boolean; token?: string; user?: User; birthProfile?: CustomerBirthProfile; message?: string;
  }> {
    const apiBase = getApiBase();
    const endpoints = [
      `${apiBase}/auth/index.php?action=verify-register-otp`,
      `${apiBase}/auth/register/verify`
    ];
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, password, action: 'verify-register-otp' })
      });
      const data = await safeJson<any>(res);
      if ((!hasJsonContentType(res) && !data.success && res.ok) || res.status === 404 || res.status === 405) continue;
      return data;
    }
    return { success: false, message: 'Email verification endpoint is unavailable.' };
  },

  async resendRegisterOtp(email: string): Promise<{ success: boolean; message?: string }> {
    const apiBase = getApiBase();
    const endpoints = [
      `${apiBase}/auth/index.php?action=resend-register-otp`,
      `${apiBase}/auth/register/resend`
    ];
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'resend-register-otp' })
      });
      const data = await safeJson<any>(res);
      if ((!hasJsonContentType(res) && !data.success && res.ok) || res.status === 404 || res.status === 405) continue;
      return data;
    }
    return { success: false, message: 'Verification-code resend endpoint is unavailable.' };
  },

  /** Emails a password-reset code. The reply is identical whether or not the account exists. */
  async forgotPassword(email: string): Promise<{ success: boolean; message?: string }> {
    const apiBase = getApiBase();
    const endpoints = [
      `${apiBase}/auth/index.php?action=forgot-password`,
      `${apiBase}/auth/forgot-password`
    ];
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), action: 'forgot-password' })
      });
      const data = await safeJson<any>(res);
      if ((!hasJsonContentType(res) && !data.success && res.ok) || res.status === 404 || res.status === 405) continue;
      return data;
    }
    return { success: false, message: 'Password reset is unavailable right now. Please try again shortly.' };
  },

  /** Sets a new password with the emailed code. Revokes all existing sessions. */
  async resetPassword(email: string, code: string, password: string): Promise<{ success: boolean; message?: string }> {
    const apiBase = getApiBase();
    const endpoints = [
      `${apiBase}/auth/index.php?action=reset-password`,
      `${apiBase}/auth/reset-password`
    ];
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), code: code.trim(), password, action: 'reset-password' })
      });
      const data = await safeJson<any>(res);
      if ((!hasJsonContentType(res) && !data.success && res.ok) || res.status === 404 || res.status === 405) continue;
      return data;
    }
    return { success: false, message: 'Password reset is unavailable right now. Please try again shortly.' };
  },

  async getMe(): Promise<{ success: boolean; user?: User; birthProfile?: CustomerBirthProfile }> {
    const apiBase = getApiBase();
    try {
      const res = await fetch(`${apiBase}/auth/index.php?action=me`, {
        headers: { ...getAuthHeader() }
      });
      const data = await safeJson(res);
      if (data.success || res.status !== 404) return data;
    } catch (e) {}

    const res = await fetch(`${apiBase}/auth/me`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  // Customer Profile
  async getProfile(): Promise<{ success: boolean; profile?: CustomerBirthProfile }> {
    const apiBase = getApiBase();
    try {
      const res = await fetch(`${apiBase}/services/profile`, {
        headers: { ...getAuthHeader() }
      });
      const resData = await safeJson(res);
      if (resData.success || (res.status !== 404 && !resData.message?.includes('not found'))) {
        return resData;
      }
    } catch (e) {}

    try {
      const res = await fetch(`${apiBase}/services.php?action=get-profile`, {
        headers: { ...getAuthHeader() }
      });
      const resData = await safeJson(res);
      if (resData.success || res.status !== 404) {
        return resData;
      }
    } catch (e) {}

    const res = await fetch(`${apiBase}/services/index.php?action=get-profile`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async saveProfile(profile: Partial<CustomerBirthProfile>): Promise<{ success: boolean; profile?: CustomerBirthProfile; message?: string }> {
    const apiBase = getApiBase();
    try {
      const res = await fetch(`${apiBase}/services/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(profile)
      });
      const resData = await safeJson(res);
      if (resData.success || (res.status !== 404 && !resData.message?.includes('not found'))) {
        return resData;
      }
    } catch (e) {}

    try {
      const res = await fetch(`${apiBase}/services.php?action=save-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(profile)
      });
      const resData = await safeJson(res);
      if (resData.success || res.status !== 404) {
        return resData;
      }
    } catch (e) {}

    const res = await fetch(`${apiBase}/services/index.php?action=save-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(profile)
    });
    return safeJson(res);
  },

  // Calculations Preview
  async calculatePreview(serviceType: ServiceType, payload: Record<string, any>): Promise<{ success: boolean; result?: any; message?: string }> {
    const apiBase = getApiBase();
    try {
      const res = await fetch(`${apiBase}/services/calculate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, payload })
      });
      const resData = await safeJson(res);
      if (resData.success && resData.result) {
        return resData;
      }
    } catch (e) {}

    try {
      const res = await fetch(`${apiBase}/services.php?action=calculate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, payload })
      });
      const resData = await safeJson(res);
      if (resData.success && resData.result) {
        return resData;
      }
    } catch (e) {}

    try {
      const res = await fetch(`${apiBase}/services/index.php?action=calculate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, payload })
      });
      const resData = await safeJson(res);
      if (resData.success && resData.result) {
        return resData;
      }
    } catch (e) {}

    // Resilient fallback: compute using the high-precision client-side astrology engine
    try {
      const { calculateLocalAstrology } = await import('./localAstrology');
      const result = calculateLocalAstrology(serviceType, payload);
      if (result) {
        return { success: true, result };
      }
    } catch (calcError: any) {
      console.warn('[ASTRO SIVAM] Local preview calculation failed:', calcError);
      return { success: false, message: calcError?.message || 'Calculation failed' };
    }

    return { success: false, message: 'The calculation preview could not be prepared.' };
  },

  // Calculation Service Alias for Preview Testing
  async calculateService(serviceType: ServiceType, payload: Record<string, any>): Promise<{ success: boolean; result?: any; message?: string }> {
    return this.calculatePreview(serviceType, payload);
  },

  // Order Placement
  async placeOrder(data: {
    serviceType: ServiceType;
    language: AppLanguage;
    country: string;
    /** Account/billing country — never a birth place. Used only when no payment method is chosen. */
    billingCountry?: string;
    paymentMethod?: PaymentMethod;
    /** Currency the customer chose to pay in (derived from paymentMethod). */
    currency?: CurrencyCode;
    paymentReference?: string;
    paymentIntentId?: string;
    inputPayload: Record<string, any>;
    saveAsProfile?: boolean;
  }): Promise<{ success: boolean; order?: Order; message?: string }> {
    const orderPayload = { ...data, action: 'order' };
    const apiBase = getApiBase();

    try {
      const res = await apiFetch(`${apiBase}/services/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const resData = await safeJson(res);
      if (resData.success || (res.status !== 404 && !resData.message?.includes('not found'))) {
        return resData;
      }
    } catch (e) {}

    try {
      const res = await apiFetch(`${apiBase}/services.php?action=order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const resData = await safeJson(res);
      if (resData.success || res.status !== 404) {
        return resData;
      }
    } catch (e) {}

    const res = await apiFetch(`${apiBase}/services/index.php?action=order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    return safeJson(res);
  },

  // Family Tray / Multi-Order Batch Placement
  async placeMultiOrder(data: {
    items: Array<{
      serviceType: ServiceType;
      language: AppLanguage;
      /** Birth country of that family member (display + astrology only, never pricing). */
      country: string;
      inputPayload: Record<string, any>;
    }>;
    /** Billing country of the account — never a birth place. */
    country?: string;
    billingCountry?: string;
    paymentMethod?: PaymentMethod;
    /** Currency the customer chose to pay in (derived from paymentMethod). */
    currency?: CurrencyCode;
    /** Total shown to the customer, used by the server as a sanity check. */
    totalAmount?: number;
    paymentReference?: string;
    paymentIntentId?: string;
  }): Promise<{ success: boolean; orders?: Order[]; groupId?: string; message?: string }> {
    const multiOrderPayload = { ...data, action: 'multi-order' };
    const apiBase = getApiBase();

    try {
      const res = await apiFetch(`${apiBase}/services/multi-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(multiOrderPayload)
      });
      const resData = await safeJson(res);
      if (resData.success || (res.status !== 404 && !resData.message?.includes('not found'))) {
        return resData;
      }
    } catch (e) {}

    try {
      const res = await apiFetch(`${apiBase}/services.php?action=multi-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(multiOrderPayload)
      });
      const resData = await safeJson(res);
      if (resData.success || res.status !== 404) {
        return resData;
      }
    } catch (e) {}

    const res = await apiFetch(`${apiBase}/services/index.php?action=multi-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(multiOrderPayload)
    });
    return safeJson(res);
  },

  // ---------------------------------------------------------------------
  // Multi-person checkout: ONE order, up to 6 people, one total.
  // ---------------------------------------------------------------------
  /**
   * Places a multi-person order. Each person carries birth details plus a
   * checklist of services; the SERVER recomputes every price from its own price
   * list and returns the authoritative total.
   */
  async placeMultiPersonOrder(data: {
    people: Array<{
      name: string;
      gender?: string;
      dob: string;
      tob: string;
      place: string;
      country?: string;
      latitude: number | null;
      longitude: number | null;
      timezoneOffsetHours: number | null;
      timeZoneId?: string;
      services: ServiceType[];
      language?: AppLanguage;
      partner?: Record<string, any>;
      muhurtham?: Record<string, any>;
    }>;
    /** Billing country of the account - never a birth place. */
    country?: string;
    billingCountry?: string;
    paymentMethod?: PaymentMethod;
    currency?: CurrencyCode;
    /** Total shown to the customer; the server only uses it as a sanity check. */
    totalAmount?: number;
    paymentReference?: string;
    paymentIntentId?: string;
    language?: AppLanguage;
  }): Promise<{
    success: boolean;
    message?: string;
    order?: Order;
    orders?: Order[];
    people?: any[];
    items?: any[];
    currency?: CurrencyCode;
    totalAmount?: number;
    errors?: string[];
    warnings?: string[];
  }> {
    const payload = { ...data, action: 'multi-person-order' };
    const apiBase = getApiBase();
    const endpoints = [
      `${apiBase}/services/multi-order`,
      `${apiBase}/services.php?action=multi-order`,
      `${apiBase}/services/index.php?action=multi-order`
    ];
    let last: any = { success: false, message: 'Multi-person checkout is unavailable on this server. Upload the latest API routes and retry.' };
    for (const endpoint of endpoints) {
      let response: Response;
      try {
        response = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (error: any) {
        return { success: false, message: error?.message || 'Multi-person checkout failed.' };
      }
      const data = await safeJson<any>(response);
      if (data?.success) return data;
      last = data;
      // Validation/payment errors are final answers - only fall through when the
      // endpoint itself is missing (older /api folder on the host).
      if (!isUnavailableApiEndpoint(response, data)) return data;
    }
    return last;
  },

  // Customer Orders
  async getMyOrders(): Promise<{ success: boolean; orders: Order[] }> {
    const apiBase = getApiBase();
    try {
      const res = await apiFetch(`${apiBase}/services/my-orders`);
      const resData = await safeJson(res);
      if (resData.success || (res.status !== 404 && !resData.message?.includes('not found'))) {
        return resData;
      }
    } catch (e) {}

    try {
      const res = await apiFetch(`${apiBase}/services.php?action=my-orders`);
      const resData = await safeJson(res);
      if (resData.success || res.status !== 404) {
        return resData;
      }
    } catch (e) {}

    const res = await apiFetch(`${apiBase}/services/index.php?action=my-orders`);
    return safeJson(res);
  },

  async getOrder(id: string): Promise<{ success: boolean; order?: Order; message?: string }> {
    const res = await apiFetch(`${API_BASE}/services/orders/${id}`);
    return safeJson(res);
  },

  async requestCustomerEmailResend(
    id: string,
    targetEmail?: string,
    payload?: Partial<FamilyFulfilPayload> & {
      reportPdfBase64?: string;
      language?: string;
      requirePreviewQuality?: boolean;
    }
  ): Promise<{ success: boolean; message?: string; emailPartCount?: number }> {
    const apiBase = getApiBase();
    const res = await apiFetch(`${apiBase}/services/orders/${encodeURIComponent(id)}/request-resend-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail, ...(payload || {}) })
    });
    return safeJson(res);
  },


  // NOTE: Customer-facing getOrderPdfUrl / getPdfDownloadUrl / getOrderInvoicePdfUrl /
  // downloadOrderPdf / downloadOrderInvoicePdf were intentionally removed. Reports and
  // tax invoices are delivered to customers only by email (see requestCustomerEmailResend
  // above) and must never be viewable or downloadable directly on the website. Do not
  // re-add functions pointing at services/orders/:id/pdf or /invoice-pdf.

  async downloadPreviewPdf(
    serviceType: string,
    result: any,
    language: AppLanguage = 'en',
    fileName = 'ASTRO_SIVAM_Preview_Report.pdf'
  ) {
    const res = await fetch(`${API_BASE}/services/export-preview-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ serviceType, result, language })
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err.message || 'Failed to export PDF');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Admin APIs
  async getAdminOrders(params?: {
    status?: string;
    serviceType?: string;
    language?: string;
    country?: string;
    search?: string;
  }): Promise<{ success: boolean; count: number; orders: Order[] }> {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          cleanParams[k] = String(v);
        }
      });
    }
    const query = new URLSearchParams(cleanParams).toString();
    const queryStr = query ? `?${query}` : '';

    try {
      const res = await apiFetch(`${API_BASE}/admin/orders${queryStr}`);
      const data = await safeJson(res);
      if (data && data.success && Array.isArray(data.orders)) {
        return data;
      }
    } catch (e) {}

    try {
      const res = await apiFetch(`${API_BASE}/admin/orders.php${queryStr}`);
      const data = await safeJson(res);
      if (data && data.success && Array.isArray(data.orders)) {
        return data;
      }
    } catch (e) {}

    try {
      const res = await apiFetch(`${API_BASE}/admin/index.php?action=orders${query ? `&${query}` : ''}`);
      const data = await safeJson(res);
      if (data && data.success && Array.isArray(data.orders)) {
        return data;
      }
    } catch (e) {}

    return { success: true, count: 0, orders: [] };
  },

  async approveOrder(
    id: string,
    payload?: {
      reportPdfBase64?: string;
      invoicePdfBase64?: string;
      language?: string;
      useStagedDocs?: boolean;
      stagedDocs?: number;
      requirePreviewQuality?: boolean;
    }
  ): Promise<{
    success: boolean;
    message: string;
    order?: Order;
    orders?: Order[];
    renderQuality?: 'PREVIEW_EXACT';
    invoiceQuality?: 'PREVIEW_EXACT';
    emailPartCount?: number;
  }> {
    const endpoints = [
      `${API_BASE}/admin/orders/${encodeURIComponent(id)}/approve`,
      `${API_BASE}/admin/approve_order.php?id=${encodeURIComponent(id)}`,
      `${API_BASE}/admin/index.php?action=approve_order&id=${encodeURIComponent(id)}`
    ];
    for (const endpoint of endpoints) {
      let response: Response;
      try {
        response = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload ? JSON.stringify(payload) : undefined
        });
      } catch (error: any) {
        // A network failure is ambiguous: the server may have accepted the send
        // before the connection dropped. Do not retry another mail endpoint.
        return { success: false, message: error?.message || 'Approval request failed; check the order before retrying.' };
      }
      const data = await safeJson(response);
      if (data?.success || !isUnavailableApiEndpoint(response, data)) return data;
    }
    return {
      success: false,
      message: 'No supported order-approval endpoint is available. Upload the latest API routes and retry.'
    };
  },

  async approveFamilyOrder(
    groupId: string,
    payload?: FamilyFulfilPayload
  ): Promise<FamilyFulfilResponse> {
    // The payload carries the complete set of preview-rendered PDFs; legacy
    // route fallback is allowed only when the direct PHP endpoint is absent.
    const body = JSON.stringify({ group_id: groupId, groupId, ...(payload || {}) });
    const endpoint = `${API_BASE}/admin/approve_order.php`;
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body
      });
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || 'Family approval request failed; check the group before retrying.'
      };
    }
    const data = await safeJson<FamilyFulfilResponse>(response);
    if (data?.success || !isUnavailableApiEndpoint(response, data)) return data;

    const fallback = await fetch(`${API_BASE}/admin/family-orders/${encodeURIComponent(groupId)}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body
    });
    return safeJson(fallback);
  },

  async resendFamilyEmail(
    groupId: string,
    payload?: FamilyFulfilPayload
  ): Promise<FamilyFulfilResponse> {
    const res = await fetch(`${API_BASE}/admin/family-orders/${encodeURIComponent(groupId)}/resend-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ group_id: groupId, groupId, ...(payload || {}) })
    });
    return safeJson(res);
  },

  /* ---------------------------------------------------------------------
   * STAGED PREVIEW-QUALITY DOCUMENT UPLOADS
   *
   * The admin panel renders every report / invoice in the browser with the
   * high-quality html2canvas + jsPDF pipeline (~2 MB and ~8 s per report).
   * A family bundle therefore cannot be shipped inside ONE JSON body: PHP's
   * post_max_size (8M by default) can silently discard an oversized body.
   * Approval now fails closed when a preview PDF is missing, and family
   * documents are uploaded one per request so the full bundle fits reliably.
   * Single orders stage only when their combined inline payload is too large.
   * ------------------------------------------------------------------ */

  /**
   * Upload ONE preview-rendered PDF for a FAMILY GROUP scope (group id).
   * Returns `unsupported: true` when the deployed API has no staging endpoint;
   * only small bundles may then use the bounded inline payload.
   */
  async stageFamilyDoc(
    groupId: string,
    doc: StageDocPayload
  ): Promise<StageDocResponse> {
    return postStagedDoc(
      [
        `${API_BASE}/admin/family-orders/${encodeURIComponent(groupId)}/stage-doc`,
        `${API_BASE}/admin/family_docs.php?group_id=${encodeURIComponent(groupId)}`
      ],
      groupId,
      doc
    );
  },

  /**
   * Upload ONE preview-rendered PDF for a SINGLE ORDER scope. The server maps
   * the order to its family group when it belongs to one, so the same staging
   * area feeds the consolidated family email.
   */
  async stageOrderDoc(
    orderId: string,
    doc: StageDocPayload
  ): Promise<StageDocResponse> {
    return postStagedDoc(
      [
        `${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/stage-doc`,
        `${API_BASE}/admin/family_docs.php?order_id=${encodeURIComponent(orderId)}`
      ],
      orderId,
      doc
    );
  },

  /** Owner-authenticated staging for a customer's completed family resend. */
  async stageCustomerFamilyDoc(groupId: string, doc: StageDocPayload): Promise<StageDocResponse> {
    return postStagedDoc(
      [`${API_BASE}/services/family-orders/${encodeURIComponent(groupId)}/stage-doc`],
      groupId,
      doc
    );
  },

  /** Owner-authenticated staging for a customer's completed single-order resend. */
  async stageCustomerOrderDoc(orderId: string, doc: StageDocPayload): Promise<StageDocResponse> {
    return postStagedDoc(
      [`${API_BASE}/services/orders/${encodeURIComponent(orderId)}/stage-doc`],
      orderId,
      doc
    );
  },

  /** Best-effort cleanup for customer resend staging (the files also expire by TTL). */
  async clearCustomerFamilyStagedDocs(groupId: string): Promise<void> {
    try {
      await apiFetch(`${API_BASE}/services/family-orders/${encodeURIComponent(groupId)}/stage-doc`, { method: 'DELETE' });
    } catch {
      /* staging is private and expires automatically */
    }
  },

  async clearCustomerOrderStagedDocs(orderId: string): Promise<void> {
    try {
      await apiFetch(`${API_BASE}/services/orders/${encodeURIComponent(orderId)}/stage-doc`, { method: 'DELETE' });
    } catch {
      /* staging is private and expires automatically */
    }
  },

  /** Best-effort cleanup of staged documents (they also expire by TTL). */
  async clearFamilyStagedDocs(scope: string): Promise<void> {
    // Start every render run with an empty scope. Otherwise an interrupted old
    // run can leave reports behind and a later approval can mix them with a new render.
    const endpoints = [
      `${API_BASE}/admin/family-orders/${encodeURIComponent(scope)}/stage-doc`,
      `${API_BASE}/admin/family_docs.php?group_id=${encodeURIComponent(scope)}`
    ];
    for (const url of endpoints) {
      try {
        const res = await apiFetch(url, { method: 'DELETE' });
        if (res.ok) return;
      } catch {
        /* try the direct PHP endpoint next */
      }
    }
  },

  async clearOrderStagedDocs(orderId: string): Promise<void> {
    const endpoints = [
      `${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/stage-doc`,
      `${API_BASE}/admin/family_docs.php?order_id=${encodeURIComponent(orderId)}`
    ];
    for (const url of endpoints) {
      try {
        const res = await apiFetch(url, { method: 'DELETE' });
        if (res.ok) return;
      } catch {
        /* try the direct PHP endpoint next */
      }
    }
  },

  async cancelFamilyOrder(groupId: string, reason = 'Cancelled by administrator'): Promise<{ success: boolean; message: string; orders?: Order[] }> {
    const res = await fetch(`${API_BASE}/admin/family-orders/${encodeURIComponent(groupId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ reason })
    });
    return safeJson(res);
  },

  // NOTE: Customer-facing getFamilyInvoicePdfUrl / downloadFamilyInvoicePdf were
  // intentionally removed for the same reason as the single-order equivalents:
  // reports and invoices are delivered to customers only by email, never
  // viewable/downloadable directly on the site. Do not re-add functions
  // pointing at services/family-orders/:groupId/invoice-pdf.

  getAdminFamilyInvoicePdfUrl(groupId: string): string {
    return `${API_BASE}/admin/family-orders/${encodeURIComponent(groupId)}/invoice-pdf`;
  },

  // ---------------------------------------------------------------------
  // Multi-person orders: per-report Preview / Send
  // ---------------------------------------------------------------------
  /**
   * get-or-calculate ONE report of an order. The server returns the cached
   * `order_items.calculated_result` when it is present (and current) and
   * calculates + caches it otherwise, so the Preview and the Send always use the
   * same numbers.
   */
  async getOrderItemResult(
    orderId: string,
    itemId: number
  ): Promise<{ success: boolean; item?: OrderItem; result?: any; recalculated?: boolean; message?: string }> {
    const res = await fetch(
      `${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(String(itemId))}/result`,
      { headers: { ...getAuthHeader() } }
    );
    return safeJson(res);
  },

  /** Sends ONE report of an order (one email per order, one report PDF per item). */
  async sendOrderItemEmail(
    orderId: string,
    itemId: number,
    payload?: {
      reportPdfBase64?: string;
      invoicePdfBase64?: string;
      itemId?: number;
      language?: string;
    }
  ): Promise<OrderItemsSendResponse> {
    const res = await fetch(
      `${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(String(itemId))}/send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ ...(payload || {}), itemId })
      }
    );
    return safeJson(res);
  },

  /** Sends every report of an order + ONE invoice in a single email. */
  async sendAllOrderItems(
    orderId: string,
    payload?: {
      reportPdfs?: Array<{ itemId: number; fileName?: string; pdfBase64: string }>;
      invoicePdfBase64?: string;
    }
  ): Promise<OrderItemsSendResponse> {
    const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/items/send-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload || {})
    });
    return safeJson(res);
  },

  async downloadAdminFamilyInvoicePdf(groupId: string, fileName?: string) {
    const fn = fileName || `ASTRO_SIVAM_Family_Invoice_${groupId}.pdf`;
    const res = await fetch(`${API_BASE}/admin/family-orders/${encodeURIComponent(groupId)}/invoice-pdf`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err.message || 'Failed to download family invoice');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  getAdminOrderPdfUrl(id: string, lang?: string): string {
    return `${API_BASE}/admin/orders/${id}/pdf${lang ? `?lang=${lang}` : ''}`;
  },

  getAdminOrderInvoicePdfUrl(id: string): string {
    return `${API_BASE}/admin/orders/${id}/invoice-pdf`;
  },

  async downloadAdminOrderPdf(id: string, fileName = 'ASTRO_SIVAM_Report.pdf') {
    const res = await fetch(`${API_BASE}/admin/orders/${id}/pdf`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err.message || 'Failed to download Report PDF');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async downloadAdminOrderInvoicePdf(id: string, fileName = 'ASTRO_SIVAM_Invoice.pdf') {
    const res = await fetch(`${API_BASE}/admin/orders/${id}/invoice-pdf`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err.message || 'Failed to download Invoice PDF');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async cancelOrder(id: string, reason = 'Cancelled by administrator or customer'): Promise<{ success: boolean; message: string; order?: Order }> {
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        const data = await safeJson(res);
        if (data.success) return data;
      }
    } catch {
      // fallback
    }

    const res2 = await fetch(`${API_BASE}/services/orders/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ reason })
    });
    return safeJson(res2);
  },

  async deleteOrder(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/orders/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async processRefund(id: string, adminNotes?: string): Promise<{ success: boolean; message: string; order?: Order }> {
    const res = await fetch(`${API_BASE}/admin/orders/${id}/process-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ adminNotes })
    });
    return safeJson(res);
  },

  async getAdminFinancialReport(params?: { startDate?: string; endDate?: string; reportType?: string }): Promise<{ success: boolean; report: any }> {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`${API_BASE}/admin/reports/financial?${query}`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async getAdminAnalytics(params?: { timeframe?: string }): Promise<{ success: boolean; data: AdminAnalyticsData; message?: string }> {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`${API_BASE}/admin/analytics?${query}`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async exportDatabase(collection?: string): Promise<{ success: boolean; data: any }> {
    const query = collection ? `?collection=${collection}` : '';
    const res = await fetch(`${API_BASE}/admin/database/export${query}`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async importDatabase(data: any, options?: { mode?: 'merge' | 'replace'; collection?: string }): Promise<{ success: boolean; message: string; stats?: any }> {
    const res = await fetch(`${API_BASE}/admin/database/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ data, ...options })
    });
    return safeJson(res);
  },

  async testEmailConfig(testRecipient?: string): Promise<{ success: boolean; message: string; emailSettings?: any }> {
    const res = await fetch(`${API_BASE}/admin/testing/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ testRecipient })
    });
    return safeJson(res);
  },

  async testChatAlert(phone: string, channels?: Array<'whatsapp' | 'viber'>, chatAlertSettings?: any): Promise<{ success: boolean; message: string; results?: any[] }> {
    const res = await fetch(`${API_BASE}/admin/testing/chat-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ phone, channels, chatAlertSettings })
    });
    return safeJson(res);
  },

  async testPaymentConfig(
    method: 'MPAISA' | 'MYCASH' | 'GPAY' | 'PAYPAL',
    settings?: Partial<SystemSettings>
  ): Promise<{ success: boolean; message: string; testedAt?: string }> {
    const res = await apiFetch(`${API_BASE}/admin/testing/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ method, settings })
    });
    return safeJson(res);
  },

  async createPaymentSession(payload: {
    paymentMethod: PaymentMethod;
    amount: number;
    currency: CurrencyCode;
    description?: string;
    itemCount?: number;
  }): Promise<{ success: boolean; session?: OnlinePaymentSession; message?: string }> {
    const apiBase = getApiBase();
    try {
      const res = await apiFetch(`${apiBase}/services/payment/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, action: 'create-payment-session' })
      });
      if (res.status !== 404) {
        return safeJson(res);
      }
    } catch {}

    const fallbackRes = await apiFetch(`${apiBase}/services.php?action=create-payment-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action: 'create-payment-session' })
    });
    return safeJson(fallbackRes);
  },

  async verifyPaymentSession(payload: {
    sessionId?: string;
    paymentIntentId?: string;
    paymentMethod: PaymentMethod;
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
    gatewaySignature?: string;
    payerAccount?: string;
  }): Promise<{
    success: boolean;
    verified?: boolean;
    paymentIntentId?: string;
    paymentReference?: string;
    paymentMethod?: string;
    verifiedAt?: string;
    message?: string;
  }> {
    const apiBase = getApiBase();
    try {
      const res = await apiFetch(`${apiBase}/services/payment/verify-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, action: 'verify-payment-session' })
      });
      if (res.status !== 404) {
        return safeJson(res);
      }
    } catch {}

    const fallbackRes = await apiFetch(`${apiBase}/services.php?action=verify-payment-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action: 'verify-payment-session' })
    });
    return safeJson(fallbackRes);
  },

  async verifyPayment(id: string, autoApprove = false, adminNotes?: string): Promise<{ success: boolean; message: string; order?: Order }> {
    const res = await fetch(`${API_BASE}/admin/orders/${id}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ autoApprove, adminNotes })
    });
    return safeJson(res);
  },

  async rejectOrder(id: string, reason: string): Promise<{ success: boolean; message: string; order?: Order }> {
    const res = await fetch(`${API_BASE}/admin/orders/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ reason })
    });
    return safeJson(res);
  },

  async resendEmail(
    id: string,
    payload?: {
      reportPdfBase64?: string;
      invoicePdfBase64?: string;
      language?: string;
      useStagedDocs?: boolean;
      stagedDocs?: number;
      requirePreviewQuality?: boolean;
    }
  ): Promise<{
    success: boolean;
    message: string;
    order?: Order;
    renderQuality?: 'PREVIEW_EXACT';
    invoiceQuality?: 'PREVIEW_EXACT';
    emailPartCount?: number;
  }> {
    const res = await fetch(`${API_BASE}/admin/orders/${id}/resend-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    return safeJson(res);
  },

  async getAdminSettings(): Promise<{ success: boolean; settings: SystemSettings }> {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async updateAdminSettings(settings: Partial<SystemSettings>): Promise<{ success: boolean; message: string; settings: SystemSettings }> {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(settings)
    });
    return safeJson(res);
  },

  async getAdminStatistics(): Promise<{ success: boolean; statistics: Statistics }> {
    const res = await fetch(`${API_BASE}/admin/statistics`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async getAdminStats(): Promise<{ success: boolean; statistics: Statistics; stats: Statistics }> {
    const res = await this.getAdminStatistics();
    return { ...res, stats: res.statistics };
  },

  async getAdminAuditLogs(): Promise<{ success: boolean; logs: AuditLog[] }> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async getAiHandoffs(): Promise<{ success: boolean; count: number; handoffs: AiChatHandoff[]; note?: string }> {
    const res = await apiFetch(`${API_BASE}/admin/ai-handoffs`);
    return safeJson(res);
  },

  async updateAiHandoff(id: number, status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED', adminNotes?: string): Promise<{ success: boolean; message?: string }> {
    const res = await apiFetch(`${API_BASE}/admin/ai-handoffs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, adminNotes })
    });
    return safeJson(res);
  },

  async getAdminCustomers(): Promise<{ success: boolean; count: number; customers: any[] }> {
    const res = await fetch(`${API_BASE}/admin/customers`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async getAdminUsers(): Promise<{ success: boolean; count: number; users: any[]; customers: any[] }> {
    const res = await this.getAdminCustomers();
    return { ...res, users: res.customers };
  },

  // Admin Team Management
  async getAdminTeamMembers(): Promise<{ success: boolean; count: number; team: TeamMember[] }> {
    const res = await fetch(`${API_BASE}/admin/team`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async createTeamMember(member: Partial<TeamMember>): Promise<{ success: boolean; message: string; member: TeamMember }> {
    const res = await fetch(`${API_BASE}/admin/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(member)
    });
    return safeJson(res);
  },

  async updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<{ success: boolean; message: string; member: TeamMember }> {
    const res = await fetch(`${API_BASE}/admin/team/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(updates)
    });
    return safeJson(res);
  },

  async deleteTeamMember(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/team/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  // Public Contact Inquiry (saved to the admin inbox; SMTP notification is best-effort)
  async submitContactMessage(data: {
    name: string;
    email: string;
    subject?: string;
    message: string;
  }): Promise<{ success: boolean; message: string; messageId?: string; emailDispatched?: boolean }> {
    const res = await fetch(`${API_BASE}/services/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return safeJson(res);
  },

  // Admin Inquiries / Messages
  async getAdminMessages(): Promise<{ success: boolean; count: number; messages: ContactMessage[] }> {
    const res = await fetch(`${API_BASE}/admin/messages`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async updateAdminMessage(id: string, updates: { status?: 'NEW' | 'REVIEWED' | 'RESPONDED'; adminNotes?: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(updates)
    });
    return safeJson(res);
  },

  async deleteAdminMessage(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/messages/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  // Admin Banned IPs & Fraud Prevention
  async getAdminBannedIps(): Promise<{ success: boolean; count: number; bannedIps: BannedIpEntry[] }> {
    const res = await fetch(`${API_BASE}/admin/banned-ips`, {
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async banIp(ipAddress: string, reason?: string): Promise<{ success: boolean; message: string; entry?: BannedIpEntry }> {
    const res = await fetch(`${API_BASE}/admin/banned-ips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ ipAddress, reason })
    });
    return safeJson(res);
  },

  async unbanIp(ipAddress: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/banned-ips/${encodeURIComponent(ipAddress)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return safeJson(res);
  },

  async banOrderIp(orderId: string, reason?: string): Promise<{ success: boolean; message: string; ip?: string; entry?: BannedIpEntry }> {
    const res = await fetch(`${API_BASE}/admin/orders/${orderId}/ban-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ reason })
    });
    return safeJson(res);
  },

  async banIpFromOrder(orderId: string, reason?: string): Promise<{ success: boolean; message: string; ip?: string; entry?: BannedIpEntry }> {
    return this.banOrderIp(orderId, reason);
  }
};

