/**
 * ASTRO SIVAM - WhatsApp & Viber Order Alert Dispatcher (Node/Bun server)
 * ----------------------------------------------------------------------
 * Sends chat alerts to customers on two lifecycle events:
 *   1. order_confirmed - the customer's order was placed successfully
 *   2. order_completed - admin approved it and the report + invoice were emailed
 *
 * Channels:
 *   WhatsApp - Meta WhatsApp Cloud API (template or free-text message),
 *              or any gateway via a generic webhook (WATI / AiSensy / Interakt / etc.)
 *   Viber    - Official Viber Bot (PA) REST API (https://chatapi.viber.com/pa/send_message),
 *              or Viber Business Messages via a partner webhook (Infobip / MessageBird / etc.)
 *
 * Configuration lives in SystemSettings.chatAlertSettings (Admin Portal >
 * WhatsApp & Viber Alerts). Environment variables work as an alternative:
 *   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_NAME,
 *   VIBER_AUTH_TOKEN, VIBER_SENDER_NAME
 *
 * SAFETY RULE: alerts are strictly best-effort. A chat gateway outage must
 * NEVER block order placement or order approval - every network call is
 * wrapped and failures are only logged.
 */

import { db, Order, ChatAlertConfig, ChatAlertChannelResult } from '../db/store';

const DEFAULT_ORDER_CONFIRMED_MESSAGE = `Namaste {customer_name},

Your order {order_number} for {service_name} ({amount}) has been received successfully and is confirmed.

Status: {status}
Payment method: {payment_method}

Our astrologers will now prepare your report. You will get another alert with delivery details once it is complete.

Warm regards,
ASTRO SIVAM Team`;

const DEFAULT_ORDER_COMPLETED_MESSAGE = `Namaste {customer_name},

Great news! Your order {order_number} for {service_name} is now COMPLETE.

Your official Vedic Astrology Report PDF and Tax Invoice PDF have been emailed to {customer_email}. Please save both attachments for your records.

Thank you for choosing ASTRO SIVAM.

Warm regards,
ASTRO SIVAM Team`;

export type ChatAlertEvent = 'order_confirmed' | 'order_completed' | 'test';

function formatServiceName(serviceType: string): string {
  switch (serviceType) {
    case 'BIRTH_JATHAGAM':
      return 'Birth Jathagam (Horoscope Reading)';
    case 'MARRIAGE_COMPATIBILITY':
      return 'Marriage Compatibility (Jathagam Porutham)';
    case 'BABY_NAMING':
      return 'Baby Naming Certificate (Vetha Naamakaranam)';
    case 'MUHURTHAM':
      return 'Subha Muhurtham Dates (6-Month Calendar)';
    default:
      return (serviceType || '').replace(/_/g, ' ');
  }
}

/** Replace {placeholder} tokens in a message template. */
export function renderChatTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  Object.keys(vars).forEach((k) => {
    out = out.split(`{${k}}`).join(vars[k]);
  });
  return out.trim();
}

/**
 * Normalize a mobile number toward E.164 (+countrycode...).
 * Falls back to a per-country dialing code when the number is local.
 */
export function normalizePhone(raw?: string | null, country?: string | null): string {
  const input = (raw || '').trim();
  if (!input) return '';

  const hasPlus = input.startsWith('+') || input.startsWith('00');
  let digits = input.replace(/\D+/g, '');

  // '00' is the international access prefix - drop it (the '+' marker remains).
  if (input.startsWith('00') && digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  const countryCodes: Record<string, string> = {
    fiji: '679', india: '91', usa: '1', 'united states': '1', canada: '1',
    australia: '61', 'new zealand': '64', 'united kingdom': '44', uk: '44',
    singapore: '65', malaysia: '60', 'south africa': '27', uae: '971',
    'united arab emirates': '971', qatar: '974', kuwait: '965', 'sri lanka': '94',
    bangladesh: '880', pakistan: '92', nepal: '977', philippines: '63',
    indonesia: '62', samoa: '685', tonga: '676', vanuatu: '678',
    'solomon islands': '677', 'papua new guinea': '675'
  };

  if (hasPlus) return '+' + digits;

  const cc = countryCodes[(country || '').trim().toLowerCase()] || '';
  if (cc) {
    if (digits.startsWith('0')) digits = digits.slice(1);
    return '+' + cc + digits;
  }
  if (digits.length >= 10) return '+' + digits;
  return digits;
}

/** Settings with env-var fallbacks + defaults for missing fields. */
export function resolveChatAlertConfig(): ChatAlertConfig {
  const stored: Partial<ChatAlertConfig> = db.getSettings().chatAlertSettings || {};
  const wa = stored.whatsapp || ({} as ChatAlertConfig['whatsapp']);
  const vb = stored.viber || ({} as ChatAlertConfig['viber']);

  const envWhatsappToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const envWhatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const envWhatsappTemplate = process.env.WHATSAPP_TEMPLATE_NAME || '';
  const envViberToken = process.env.VIBER_AUTH_TOKEN || '';

  return {
    enabled: stored.enabled ?? true,
    notifyOrderConfirmed: stored.notifyOrderConfirmed ?? true,
    notifyOrderCompleted: stored.notifyOrderCompleted ?? true,
    whatsapp: {
      enabled: wa.enabled ?? false,
      provider: wa.provider ?? 'meta',
      phoneNumberId: wa.phoneNumberId || envWhatsappPhoneId,
      accessToken: wa.accessToken || envWhatsappToken,
      apiVersion: wa.apiVersion || 'v21.0',
      templateName: wa.templateName ?? envWhatsappTemplate,
      templateLanguage: wa.templateLanguage || 'en',
      webhookUrl: wa.webhookUrl || '',
      messageType: wa.messageType ?? (envWhatsappTemplate ? 'template' : 'text')
    },
    viber: {
      enabled: vb.enabled ?? false,
      provider: vb.provider ?? 'viber_bot',
      authToken: vb.authToken || envViberToken,
      senderName: vb.senderName || process.env.VIBER_SENDER_NAME || 'ASTRO SIVAM',
      webhookUrl: vb.webhookUrl || ''
    },
    orderConfirmedMessage: stored.orderConfirmedMessage || DEFAULT_ORDER_CONFIRMED_MESSAGE,
    orderCompletedMessage: stored.orderCompletedMessage || DEFAULT_ORDER_COMPLETED_MESSAGE
  };
}

async function httpPostJson(
  url: string,
  payload: unknown,
  headers: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; body: string; error: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      body,
      error: res.ok ? '' : `HTTP ${res.status}`
    };
  } catch (err: any) {
    return { ok: false, status: 0, body: '', error: err?.message || 'network error' };
  }
}

/** Send one message through the configured WhatsApp transport. */
export async function sendWhatsAppAlert(
  cfg: ChatAlertConfig,
  phone: string,
  message: string,
  vars: Record<string, string>
): Promise<ChatAlertChannelResult> {
  const wa = cfg.whatsapp;
  if (!wa.enabled) return { success: false, channel: 'whatsapp', message: 'WhatsApp alerts are disabled' };
  if (!phone) return { success: false, channel: 'whatsapp', message: 'No mobile number on the customer profile' };

  if (wa.provider === 'webhook') {
    const url = (wa.webhookUrl || '').trim();
    if (!url) return { success: false, channel: 'whatsapp', message: 'WhatsApp webhook URL is not configured' };
    const res = await httpPostJson(url, { channel: 'whatsapp', event: vars.event || '', to: phone, message, vars });
    return {
      success: res.ok,
      channel: 'whatsapp',
      message: res.ok ? 'Delivered via webhook gateway' : `Webhook error: ${res.error} ${res.body.slice(0, 300)}`
    };
  }

  // Meta WhatsApp Cloud API
  const token = (wa.accessToken || '').trim();
  const phoneId = (wa.phoneNumberId || '').trim();
  if (!token || !phoneId) {
    return { success: false, channel: 'whatsapp', message: 'WhatsApp Phone Number ID / Access Token missing' };
  }

  const apiVersion = (wa.apiVersion || 'v21.0').trim() || 'v21.0';
  const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneId)}/messages`;

  let payload: Record<string, unknown>;
  const messageType = wa.messageType || (wa.templateName ? 'template' : 'text');

  if (messageType === 'template' && wa.templateName) {
    // Fixed parameter order matching typical order-update templates:
    // {{1}} customer name  {{2}} order number  {{3}} service  {{4}} amount  {{5}} status
    const templateParams = ['customer_name', 'order_number', 'service_name', 'amount', 'status'].map((key) => ({
      type: 'text',
      text: String(vars[key] ?? '-')
    }));
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: wa.templateName,
        language: { code: wa.templateLanguage || 'en' },
        components: [{ type: 'body', parameters: templateParams }]
      }
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone.replace(/^\+/, ''),
      type: 'text',
      text: { preview_url: false, body: message.slice(0, 4096) }
    };
  }

  const res = await httpPostJson(url, payload, { Authorization: `Bearer ${token}` });
  return {
    success: res.ok,
    channel: 'whatsapp',
    message: res.ok ? 'Delivered via WhatsApp Cloud API' : `WhatsApp API error: ${res.error} ${res.body.slice(0, 300)}`
  };
}

/** Send one message through the configured Viber transport. */
export async function sendViberAlert(
  cfg: ChatAlertConfig,
  phone: string,
  message: string,
  vars: Record<string, string>
): Promise<ChatAlertChannelResult> {
  const vb = cfg.viber;
  if (!vb.enabled) return { success: false, channel: 'viber', message: 'Viber alerts are disabled' };
  if (!phone) return { success: false, channel: 'viber', message: 'No mobile number on the customer profile' };

  if (vb.provider === 'webhook') {
    const url = (vb.webhookUrl || '').trim();
    if (!url) return { success: false, channel: 'viber', message: 'Viber webhook URL is not configured' };
    const res = await httpPostJson(url, { channel: 'viber', event: vars.event || '', to: phone, message, vars });
    return {
      success: res.ok,
      channel: 'viber',
      message: res.ok ? 'Delivered via webhook gateway' : `Webhook error: ${res.error} ${res.body.slice(0, 300)}`
    };
  }

  // Official Viber Bot (PA) REST API
  const token = (vb.authToken || '').trim();
  if (!token) return { success: false, channel: 'viber', message: 'Viber auth token missing' };

  const payload = {
    // Unique Viber user id - a subscribed user's phone (E.164) is also
    // accepted by the PA API for users who have interacted with the bot.
    receiver: phone.replace(/^\+/, ''),
    min_api_version: 7,
    sender: { name: vb.senderName || 'ASTRO SIVAM' },
    type: 'text',
    text: message.slice(0, 7000)
  };

  const res = await httpPostJson('https://chatapi.viber.com/pa/send_message', payload, {
    'X-Viber-Auth-Token': token
  });

  // Viber answers HTTP 200 with a JSON status code - surface it.
  let ok = res.ok;
  let detail = 'Delivered via Viber Bot API';
  if (res.body) {
    try {
      const decoded = JSON.parse(res.body);
      if (decoded && typeof decoded.status === 'number' && decoded.status !== 0) {
        ok = false;
        detail = `Viber API error ${decoded.status}: ${decoded.status_message || 'unknown'}`;
      } else if (!ok) {
        detail = `Viber API error: ${res.error} ${res.body.slice(0, 300)}`;
      }
    } catch {
      if (!ok) detail = `Viber API error: ${res.error} ${res.body.slice(0, 300)}`;
    }
  } else if (!ok) {
    detail = `Viber API error: ${res.error}`;
  }

  return { success: ok, channel: 'viber', message: detail };
}

function buildVars(order: Order, extra: Record<string, string> = {}): Record<string, string> {
  return {
    customer_name: order.userName || 'User',
    customer_email: order.userEmail || '',
    order_number: order.orderNumber || '',
    service_name: formatServiceName(order.serviceType),
    amount: `${order.currency || 'FJD'} ${(order.amount || 0).toFixed(2)}`,
    currency: order.currency || 'FJD',
    status: order.status || 'PENDING',
    payment_method: order.paymentMethod || 'N/A',
    site_name: 'ASTRO SIVAM',
    ...extra
  };
}

/**
 * Fire WhatsApp + Viber alerts for a lifecycle event. Safe to fire-and-forget:
 * it never throws and never blocks the calling order flow.
 */
export async function sendChatOrderAlerts(
  event: ChatAlertEvent,
  orders: Order[],
  cfgOverride?: ChatAlertConfig
): Promise<ChatAlertChannelResult[]> {
  try {
    if (!orders.length) return [];

    const cfg = cfgOverride || resolveChatAlertConfig();
    if (!cfg.enabled) return [];
    if (event === 'order_confirmed' && !cfg.notifyOrderConfirmed) return [];
    if (event === 'order_completed' && !cfg.notifyOrderCompleted) return [];
    const waOn = !!cfg.whatsapp?.enabled;
    const vbOn = !!cfg.viber?.enabled;
    if (!waOn && !vbOn) return [];

    const first = orders[0];
    const vars = buildVars(first, { event });

    if (orders.length > 1) {
      const extra = orders.length - 1;
      vars.order_number = `${vars.order_number || 'GROUP'} (+${extra} more chart${extra > 1 ? 's' : ''})`;
      vars.service_name = `${orders.length}-chart family bundle`;
      const total = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
      vars.amount = `${vars.currency} ${total.toFixed(2)}`;
      vars.status = first.status || 'PENDING';
    }

    const template =
      event === 'order_confirmed'
        ? cfg.orderConfirmedMessage || DEFAULT_ORDER_CONFIRMED_MESSAGE
        : cfg.orderCompletedMessage || DEFAULT_ORDER_COMPLETED_MESSAGE;
    const message = renderChatTemplate(template, vars);

    const phone = normalizePhone(first.userMobile, (first as any).billingCountry || first.country);

    const results: ChatAlertChannelResult[] = [];
    if (waOn) results.push(await sendWhatsAppAlert(cfg, phone, message, vars));
    if (vbOn) results.push(await sendViberAlert(cfg, phone, message, vars));

    results.forEach((r) => {
      if (!r.success) {
        console.warn(`[ChatAlerts] ${event} ${r.channel} -> ${phone}: ${r.message}`);
      }
    });

    try {
      const summary = results.map((r) => `${r.channel}=${r.success ? 'OK' : `FAIL(${r.message.slice(0, 120)})`}`).join(' | ');
      db.logAudit('system', 'Chat Alerts', 'admin', 'CHAT_ALERT_SENT', `Event ${event} for ${vars.order_number}: ${summary}`);
    } catch {
      /* audit logging is optional */
    }

    return results;
  } catch (err: any) {
    console.warn('[ChatAlerts] fatal (suppressed):', err?.message || err);
    return [];
  }
}

/** Send a diagnostic test message to an arbitrary phone number. */
export async function sendChatTestAlert(
  phone: string,
  channels: Array<'whatsapp' | 'viber'> = ['whatsapp', 'viber'],
  cfgOverride?: ChatAlertConfig
): Promise<ChatAlertChannelResult[]> {
  const cfg = cfgOverride || resolveChatAlertConfig();
  const target = normalizePhone(phone);
  const vars: Record<string, string> = {
    event: 'test',
    customer_name: 'Test User',
    customer_email: 'test@astrosivam.com',
    order_number: 'ORD-TEST1',
    service_name: 'Diagnostic Test',
    amount: 'FJD 0.00',
    currency: 'FJD',
    status: 'TEST',
    payment_method: 'N/A',
    site_name: 'ASTRO SIVAM'
  };
  const message = renderChatTemplate(
    `ASTRO SIVAM chat alert test.\nNamaste {customer_name}, this is a diagnostic message confirming that WhatsApp/Viber alerts are configured correctly.\n\nOrder: {order_number}\nTime: ${new Date().toISOString()}`,
    vars
  );

  const results: ChatAlertChannelResult[] = [];
  if (channels.includes('whatsapp')) results.push(await sendWhatsAppAlert(cfg, target, message, vars));
  if (channels.includes('viber')) results.push(await sendViberAlert(cfg, target, message, vars));
  return results;
}

export { DEFAULT_ORDER_CONFIRMED_MESSAGE, DEFAULT_ORDER_COMPLETED_MESSAGE };
