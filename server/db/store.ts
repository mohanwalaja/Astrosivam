import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  HoroscopeResult,
  WeddingMatchResult,
  BabyNamingResult,
  AppLanguage
} from '../astrology/types.js';
import { calculatePrecisionHoroscope } from '../astrology/astronomy.js';
import { calculateWeddingCompatibility } from '../astrology/matchmaking.js';
import { calculateBabyNamingDetails } from '../astrology/babynames.js';
import { computeMuhurthamResultFromPayload } from '../astrology/muhurthamScan.js';
import { MUHURTHAM_ALGORITHM_VERSION } from '../../src/lib/muhurtham/scanner.js';
import {
  defaultPaymentMethodForAccount,
  getServicePrices,
  resolveOrderCurrency
} from '../../src/services/pricing.js';
import { cleanDisplayName, resolveDisplayName } from '../security/tokens.js';
import { hasConfiguredSecret, redactSettingsSecrets } from '../security/settingsSecrets.js';
import { normalizeReportLanguage } from '../../src/services/reportLanguage.js';
import { MAX_FAMILY_ORDER_ITEMS } from '../../src/services/familyOrderLimits.js';

export type UserRole = 'customer' | 'admin';
export type ServiceType = 'BIRTH_JATHAGAM' | 'MARRIAGE_COMPATIBILITY' | 'BABY_NAMING' | 'MUHURTHAM';
export type ServiceMode = 'FREE_BETA' | 'PAID';
export type OrderStatus =
  | 'PENDING_APPROVAL'
  | 'PENDING_PAYMENT_VERIFICATION'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED';
export type EmailStatus = 'NOT_SENT' | 'PROCESSING' | 'SENT' | 'FAILED';
/** Multi-person orders store the order HEADER with this service type. */
export type OrderServiceType = ServiceType | 'MULTI_PERSON';

/**
 * One PERSON of a multi-person order (row of `order_persons`). Mirrors
 * api/migrations/003_multi_person_orders.sql - the JSON store keeps the same
 * shape the MySQL tables and the PHP backend use.
 */
export interface OrderPersonRecord {
  id: number;
  orderId: string;
  seq: number;
  fullName: string;
  gender: string;
  dob: string;
  tob: string;
  place: string;
  country: string;
  lat?: number | null;
  lon?: number | null;
  tz?: number | null;
}

/** One REPORT of a multi-person order (row of `order_items`). */
export interface OrderItemRecord {
  id: number;
  orderId: string;
  personId: number;
  serviceCode: ServiceType;
  unitPrice: number;
  reportStatus: 'PENDING' | 'CALCULATED' | 'SENT' | 'FAILED';
  language: AppLanguage;
  inputPayload: Record<string, any>;
  /** THE cache Preview and Send both read (same rule as the PHP backend). */
  calculatedResult?: any;
  sentAt?: string | null;
}
export type PaymentMethod = 'NONE' | 'MPAISA' | 'MYCASH' | 'PAYPAL' | 'GPAY' | 'UPI' | 'CARD';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  passwordHash: string;
  role: UserRole;
  country: string;
  createdAt: string;
  lastLoginAt?: string;
  /** Authentication origin prevents implicit email-based social account linking. */
  authProvider?: 'local' | 'google' | 'facebook';
  providerSubject?: string;
  emailVerifiedAt?: string;
}

export interface PendingRegistration {
  email: string;
  name: string;
  mobile: string;
  passwordHash: string;
  country: string;
  birthProfile?: Partial<CustomerBirthProfile>;
  otpHash: string;
  createdAt: string;
  expiresAt: string;
  lastSentAt: string;
  failedAttempts: number;
  resendCount: number;
}

export interface CustomerBirthProfile {
  userId: string;
  name: string;
  dob: string; // YYYY-MM-DD
  tob: string; // HH:mm
  birthPlace: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  gender: 'M' | 'F';
  updatedAt: string;
}

export interface EmailConfig {
  senderName: string;
  senderEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword?: string;
  tlsSecure: boolean;
  replyTo: string;
  status: 'NOT_CONFIGURED' | 'CONNECTED' | 'TEST_SUCCESSFUL' | 'FAILED';
  lastTestedAt?: string;
  lastTestMessage?: string;
}

export interface ChatAlertChannelResult {
  success: boolean;
  channel: 'whatsapp' | 'viber';
  message: string;
}

export interface ChatAlertConfig {
  /** Master switch for WhatsApp/Viber order alerts. */
  enabled: boolean;
  notifyOrderConfirmed: boolean;
  notifyOrderCompleted: boolean;
  whatsapp: {
    enabled: boolean;
    /** 'meta' = WhatsApp Cloud API, 'webhook' = any gateway (WATI/AiSensy/Interakt...). */
    provider: 'meta' | 'webhook';
    phoneNumberId: string;
    accessToken: string;
    apiVersion: string;
    /** Approved utility template name (required for proactive alerts). */
    templateName: string;
    templateLanguage: string;
    webhookUrl: string;
    messageType: 'template' | 'text';
  };
  viber: {
    enabled: boolean;
    /** 'viber_bot' = official PA REST API, 'webhook' = business-messages partner. */
    provider: 'viber_bot' | 'webhook';
    authToken: string;
    senderName: string;
    webhookUrl: string;
  };
  orderConfirmedMessage: string;
  orderCompletedMessage: string;
}

export interface EmailTemplate {
  subject: string;
  message: string;
}

export interface ServicePriceConfigItem {
  fjd: number;
  usd: number;
  inr: number;
}

export interface SystemSettings {
  serviceMode: ServiceMode;
  fijiPriceFJD: number;
  intlPriceUSD: number;
  indiaPriceINR?: number;
  // M-Paisa (Fiji Vodafone M-PAiSA — Offline & Online)
  vodafoneMPaisaActive: boolean;
  vodafoneMPaisaPaymentMode?: 'offline' | 'online';
  vodafoneMPaisaNumber: string;
  vodafoneMPaisaName: string;
  vodafoneMPaisaMerchantCode?: string;
  vodafoneMPaisaQrUrl?: string;
  vodafoneMPaisaInstructions: string;
  vodafoneMPaisaMerchantId?: string;
  vodafoneMPaisaApiSecret?: string;
  vodafoneMPaisaApiUrl?: string;
  vodafoneMPaisaEnvironment?: 'sandbox' | 'live';
  vodafoneMPaisaOnlineConfigured?: boolean;
  // MyCash
  digicelMyCashActive: boolean;
  digicelMyCashNumber: string;
  digicelMyCashName: string;
  digicelMyCashInstructions: string;
  // India Google Pay (GPay) & UPI (Offline & Online)
  indiaGpayActive?: boolean;
  indiaGpayPaymentMode?: 'offline' | 'online';
  indiaGpayUpiId?: string;
  indiaGpayNumber?: string;
  indiaGpayName?: string;
  indiaGpayQrUrl?: string;
  indiaGpayInstructions?: string;
  indiaGpayOnlineProvider?: 'razorpay' | 'cashfree' | 'phonepe' | 'upi_intent';
  indiaGpayMerchantId?: string;
  indiaGpayKeyId?: string;
  indiaGpayKeySecret?: string;
  indiaGpayWebhookSecret?: string;
  indiaGpayEnvironment?: 'sandbox' | 'live';
  indiaGpayOnlineConfigured?: boolean;
  // PayPal (International — Offline & Online)
  paypalActive: boolean;
  paypalPaymentMode?: 'offline' | 'online';
  paypalEmail: string;
  paypalBusinessName: string;
  paypalMeLink?: string;
  paypalClientId: string;
  paypalSecret: string;
  paypalClientSecret?: string;
  paypalWebhookId?: string;
  paypalMode: 'sandbox' | 'live';
  paypalInstructions: string;
  paypalOnlineConfigured?: boolean;
  // Per-Service Pricing Override (Separate pricing for each service)
  servicePricing?: {
    BIRTH_JATHAGAM?: ServicePriceConfigItem;
    MARRIAGE_COMPATIBILITY?: ServicePriceConfigItem;
    BABY_NAMING?: ServicePriceConfigItem;
    MUHURTHAM?: ServicePriceConfigItem;
  };
  // Facebook Login Integration
  facebookLoginEnabled: boolean;
  facebookAppId: string;
  facebookAppSecret: string;
  // Google Login Integration
  googleLoginEnabled?: boolean;
  googleClientId?: string;
  // Theme Template
  activeThemeTemplate?: string;
  // General Support & Email
  supportEmail: string;
  supportPhone: string;
  enableEmailNotifications: boolean;
  autoEmailReports: boolean;
  betaNoticeMessage: string;
  emailSettings: EmailConfig;
  emailTemplates: Record<string, EmailTemplate>;
  chatAlertSettings?: ChatAlertConfig;
}

export type PaymentIntentStatus = 'CREATED' | 'CAPTURED' | 'PENDING_MANUAL' | 'FAILED' | 'CONSUMED' | 'EXPIRED';

export interface PaymentIntent {
  id: string;
  userId: string;
  paymentMethod: PaymentMethod;
  provider: string;
  amount: number;
  currency: 'FJD' | 'USD' | 'INR';
  status: PaymentIntentStatus;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  paymentReference?: string;
  orderId?: string;
  payerAccount?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  userMobile: string;
  serviceType: OrderServiceType;
  language: AppLanguage;
  country: string;
  currency: 'FJD' | 'USD' | 'INR';
  amount: number;
  serviceMode: ServiceMode;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  paymentIntentId?: string;
  paymentStatus?: PaymentIntentStatus | 'NOT_REQUIRED' | 'PENDING_ADMIN' | 'VERIFIED_MANUAL';
  status: OrderStatus;
  emailStatus: EmailStatus;
  emailDeliveryAttempts: number;
  emailSentAt?: string;
  emailLastStatusMessage?: string;
  inputPayload: Record<string, any>;
  calculatedResult?: HoroscopeResult | WeddingMatchResult | BabyNamingResult;
  hasPdf: boolean;
  hasInvoice?: boolean;
  adminNotes?: string;
  refundStatus?: 'NONE' | 'REQUESTED' | 'REFUNDED' | 'REJECTED';
  refundReason?: string;
  refundRequestedAt?: string;
  refundProcessedAt?: string;
  refundAdminNotes?: string;
  ipAddress?: string;
  groupId?: string;
  groupOrderIndex?: number;
  groupOrderCount?: number;
  /** Attached on read for multi-person orders: the people of this order. */
  persons?: OrderPersonRecord[];
  /** Attached on read: one row per report, each with its own cached result. */
  items?: OrderItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: 'FJD' | 'USD' | 'INR';
  paymentMethod: PaymentMethod;
  reason: string;
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  requestedAt: string;
  processedAt?: string;
  adminNotes?: string;
}

export interface TeamMember {
  id: string;
  fullName: string;
  photoUrl: string;
  education: string;
  vedicEducation: string;
  yearsOfExperience: number;
  biography: string;
  specialization: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'NEW' | 'REVIEWED' | 'RESPONDED';
  adminNotes?: string;
  autoEmailDispatched: boolean;
  dispatchedTo: string;
  emailDispatchedAt?: string;
  createdAt: string;
  ip?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details: string;
  ip?: string;
}

export interface BannedIpEntry {
  id: string;
  ipAddress: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
}

/**
 * One processed provider callback. Kept for audit, for idempotency (a provider
 * retry must not capture twice) and so the admin can see that a webhook arrived
 * even when the customer's browser never completed the checkout round-trip.
 */
export interface PaymentWebhookEvent {
  id: string;
  provider: string;
  /** Provider event id (Razorpay X-Razorpay-Event-Id / PayPal transmission id). */
  externalEventId: string;
  eventType: string;
  status: 'PROCESSED' | 'IGNORED' | 'MISMATCH' | 'UNKNOWN_INTENT' | 'REJECTED';
  intentId?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  detail: string;
  payloadDigest: string;
  receivedAt: string;
  ip?: string;
}

interface DatabaseSchema {
  users: User[];
  pendingRegistrations?: PendingRegistration[];
  birthProfiles: Record<string, CustomerBirthProfile>;
  settings: SystemSettings;
  orders: Order[];
  /**
   * Multi-person orders (migration 003 equivalent). `orders` is the order
   * header; these two collections hold the people and their reports.
   */
  orderPersons?: OrderPersonRecord[];
  orderItems?: OrderItemRecord[];
  paymentIntents?: PaymentIntent[];
  paymentWebhookEvents?: PaymentWebhookEvent[];
  auditLogs: AuditLog[];
  teamMembers: TeamMember[];
  contactMessages?: ContactMessage[];
  bannedIps?: BannedIpEntry[];
  clientErrors?: Array<{ id: string; message: string; endpoint: string; status?: number; createdAt: string; resolvedAt?: string }>;
  betaIpOrders?: Array<{
    ipAddress: string;
    orderId: string;
    orderNumber: string;
    userId: string;
    userEmail: string;
    serviceType: string;
    createdAt: string;
  }>;
}

const configuredDataDir = process.env.ASTROSIVAM_DATA_DIR?.trim();
const DB_DIR = configuredDataDir
  ? path.resolve(configuredDataDir)
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');

const DEFAULT_EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  order_received: {
    subject: 'ASTRO SIVAM: We have received your order {order_id}',
    message: 'Namaste {customer_name},\n\nThank you for placing your order with ASTRO SIVAM for {service_name}.\n\nOrder Number: {order_id}\nSelected Service: {service_name}\n\nOur administrative desk is currently verifying your request. Once verified, your reading will be prepared by our India-based Astrology Team and delivered directly to your registered email, normally within 1–2 hours.\n\nWarm regards,\nASTRO SIVAM Team'
  },
  payment_instructions: {
    subject: 'ASTRO SIVAM: Payment Details for Order {order_id}',
    message: 'Namaste {customer_name},\n\nTo complete your {service_name} order ({order_id}), please find our payment instructions below:\n\nAmount: {amount}\nPayment Method: {payment_method}\n\nFor Fiji Users:\n• Vodafone M-PAiSA: Transfer to {mpaisa_number} ({mpaisa_name})\n• Digicel MyCash: Transfer to {mycash_number} ({mycash_name})\n\nFor Overseas Users:\n• PayPal: {paypal_email}\n\nOnce transferred, our admin will verify your reference and prepare your astrology report.\n\nWarm regards,\nASTRO SIVAM Team'
  },
  payment_confirmed: {
    subject: 'ASTRO SIVAM: Payment Verified for Order {order_id}',
    message: 'Namaste {customer_name},\n\nWe have verified your payment for order {order_id}. Your request has been assigned to our Vedic Astrologers in India.\n\nYour comprehensive horoscope and astrological guidance will be prepared and emailed to you shortly, normally within 1–2 hours.\n\nWarm regards,\nASTRO SIVAM Team'
  },
  order_approved: {
    subject: 'ASTRO SIVAM: Order {order_id} Approved - Report & Invoice Attached',
    message: 'Namaste {customer_name},\n\nYour order {order_id} for {service_name} has been approved by the Administrator and is COMPLETED.\n\nYour official Vedic Astrology Report PDF and your Tax Invoice Bill PDF are attached directly to this email.\n\nNote: For your privacy, files are transmitted directly via this email as attachments without server hosting, so no download link is required. Please save the attached PDF files directly to your device.\n\nWarm regards,\nASTRO SIVAM Team'
  },
  report_ready: {
    subject: 'ASTRO SIVAM: Order {order_id} Completed - Documents Attached',
    message: 'Namaste {customer_name},\n\nYour personalized {service_name} report and tax invoice bill for order {order_id} have been completed and are attached directly to this email.\n\nWarm regards,\nASTRO SIVAM Team'
  },
  report_delivered: {
    subject: 'ASTRO SIVAM: Your Official Astrology Report & Tax Invoice Bill ({order_id})',
    message: 'Namaste {customer_name},\n\nYour personalized {service_name} report and official tax invoice bill have been approved by Admin and are attached directly to this email as PDF files.\n\nImportant: Because documents are not permanently stored on the web host for your privacy and security, no download link is needed. Please save the attached PDF files directly to your device.\n\nOrder Number: {order_id}\nService: {service_name}\nStatus: COMPLETED\n\nMay the planetary blessings bring prosperity and clarity to your journey.\n\nWarm regards,\nASTRO SIVAM Team'
  },
  refund_requested: {
    subject: 'ASTRO SIVAM: Cancellation & Refund Request for Order {order_id}',
    message: 'Namaste {customer_name},\n\nWe have received your cancellation request for order {order_id}. Because your order was cancelled prior to Admin approval, a full refund of {amount} will be processed to your original payment method within 48 hours.\n\nWarm regards,\nASTRO SIVAM Team'
  },
  refund_processed: {
    subject: 'ASTRO SIVAM: Refund Completed for Order {order_id}',
    message: 'Namaste {customer_name},\n\nYour refund for order {order_id} in the amount of {amount} has been successfully processed.\n\nPlease allow 24–48 hours for the funds to reflect in your account depending on your provider.\n\nWarm regards,\nASTRO SIVAM Team'
  },
  order_cancelled: {
    subject: 'ASTRO SIVAM: Order {order_id} Cancelled',
    message: 'Namaste {customer_name},\n\nOrder {order_id} for {service_name} has been cancelled.\n\nIf you have any questions, please contact our support desk at admin@astrosivam.com.\n\nWarm regards,\nASTRO SIVAM Team'
  }
};

const DEFAULT_SETTINGS: SystemSettings = {
  serviceMode: 'FREE_BETA',
  fijiPriceFJD: 35,
  intlPriceUSD: 18,
  indiaPriceINR: 499,
  // M-Paisa (Fiji Vodafone M-PAiSA — Offline & Online)
  vodafoneMPaisaActive: true,
  vodafoneMPaisaPaymentMode: 'offline',
  vodafoneMPaisaNumber: '9993077',
  vodafoneMPaisaName: 'ASTRO SIVAM SERVICES',
  vodafoneMPaisaMerchantCode: '',
  vodafoneMPaisaQrUrl: '',
  vodafoneMPaisaInstructions: 'Send payment to Vodafone M-PAiSA mobile number 9993077. Please use your Order Number or Registered Name as the payment reference.',
  vodafoneMPaisaMerchantId: '',
  vodafoneMPaisaApiSecret: '',
  vodafoneMPaisaApiUrl: 'https://pay.mpaisa.vodafone.com.fj/API/',
  vodafoneMPaisaEnvironment: 'sandbox',
  // MyCash
  digicelMyCashActive: true,
  digicelMyCashNumber: '7607465',
  digicelMyCashName: 'ASTRO SIVAM SERVICES',
  digicelMyCashInstructions: 'Send payment to Digicel MyCash mobile number 7607465. Include your Order Number or Mobile Number in the message description.',
  // India Google Pay (GPay) & UPI (Offline & Online)
  indiaGpayActive: true,
  indiaGpayPaymentMode: 'offline',
  indiaGpayUpiId: 'astrosivam@okaxis',
  indiaGpayNumber: '+91 98410 78901',
  indiaGpayName: 'ASTRO SIVAM',
  indiaGpayQrUrl: '',
  indiaGpayInstructions: 'Send payment via Google Pay (GPay) or any UPI app to the UPI ID or mobile number above. Quote your Order Number in the payment note.',
  indiaGpayOnlineProvider: 'razorpay',
  indiaGpayMerchantId: '',
  indiaGpayKeyId: '',
  indiaGpayKeySecret: '',
  indiaGpayWebhookSecret: '',
  indiaGpayEnvironment: 'sandbox',
  // PayPal (International — Offline & Online)
  paypalActive: true,
  paypalPaymentMode: 'offline',
  paypalEmail: 'payments@astrosivam.com',
  paypalBusinessName: 'ASTRO SIVAM GLOBAL SERVICES',
  paypalMeLink: '',
  paypalClientId: '',
  paypalSecret: '',
  paypalWebhookId: '',
  paypalMode: 'sandbox',
  paypalInstructions: 'Pay securely via PayPal to payments@astrosivam.com or credit/debit card. Include your Order Number in the PayPal note.',
  // Per-Service Pricing Override (Fixed price for each service separately)
  servicePricing: {
    BIRTH_JATHAGAM: { fjd: 35, usd: 18, inr: 499 },
    MARRIAGE_COMPATIBILITY: { fjd: 45, usd: 22, inr: 699 },
    BABY_NAMING: { fjd: 30, usd: 15, inr: 399 },
    MUHURTHAM: { fjd: 40, usd: 20, inr: 599 }
  },
  facebookLoginEnabled: true,
  facebookAppId: process.env.FACEBOOK_APP_ID || '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',
  googleLoginEnabled: true,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  activeThemeTemplate: 'classic-primary',
  supportEmail: 'admin@astrosivam.com',
  supportPhone: '+679 760 7465',
  enableEmailNotifications: true,
  autoEmailReports: true,
  betaNoticeMessage: 'ASTRO SIVAM (astrosivam.com) is currently in FREE BETA mode. All reports are verified and prepared by our India-based Astrology Team with guaranteed delivery.',
  emailSettings: {
    senderName: 'ASTRO SIVAM Desk',
    senderEmail: 'admin@astrosivam.com',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    tlsSecure: false,
    replyTo: 'admin@astrosivam.com',
    status: 'NOT_CONFIGURED'
  },
  emailTemplates: DEFAULT_EMAIL_TEMPLATES,
  chatAlertSettings: {
    enabled: true,
    notifyOrderConfirmed: true,
    notifyOrderCompleted: true,
    whatsapp: {
      enabled: false,
      provider: 'meta',
      phoneNumberId: '',
      accessToken: '',
      apiVersion: 'v21.0',
      templateName: '',
      templateLanguage: 'en',
      webhookUrl: '',
      messageType: 'text'
    },
    viber: {
      enabled: false,
      provider: 'viber_bot',
      authToken: '',
      senderName: 'ASTRO SIVAM',
      webhookUrl: ''
    },
    orderConfirmedMessage:
      'Namaste {customer_name},\n\nYour order {order_number} for {service_name} ({amount}) has been received successfully and is confirmed.\n\nStatus: {status}\nPayment method: {payment_method}\n\nOur astrologers will now prepare your report. You will get another alert with delivery details once it is complete.\n\nWarm regards,\nASTRO SIVAM Team',
    orderCompletedMessage:
      'Namaste {customer_name},\n\nGreat news! Your order {order_number} for {service_name} is now COMPLETE.\n\nYour official Vedic Astrology Report PDF and Tax Invoice PDF have been emailed to {customer_email}. Please save both attachments for your records.\n\nThank you for choosing ASTRO SIVAM.\n\nWarm regards,\nASTRO SIVAM Team'
  }
};

const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm_01',
    fullName: 'Dr. K. Gurunathan',
    photoUrl: '',
    education: 'M.A. (Sanskrit), Ph.D. in Vedic Astrology & Astronomy',
    vedicEducation: 'Jyothida Ratnam, Mylapore Sanskrit College & Veda Pathasala',
    yearsOfExperience: 28,
    biography: 'Eminent Senior Vedic Astrologer and researcher from Tamil Nadu with over 28 years of classical calculation mastery. Specializes in precise Janma Kundali mathematical verification and Dasa Bhukti timing.',
    specialization: 'Janma Jathagam, Planetary Dosha Nivarana & Dasa Bhukti Predictions',
    isActive: true,
    displayOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tm_02',
    fullName: 'Pandit V. Balasubramanya Sastrigal',
    photoUrl: '',
    education: 'Vidvan in Vedic Astrology, B.A. Indian Epigraphy',
    vedicEducation: 'Jyothisha Pravesha, Veda Pathasala Tiruvannamalai',
    yearsOfExperience: 22,
    biography: 'Chief astrological consultant specializing in South Indian Vedic matchmaking, 10-Porutham and 12-Porutham deep synastry, Rajju Dosha remedies, and Papasamyam compatibility assessment.',
    specialization: 'Thirumana Porutham (Marriage Compatibility), Papasamyam & Sevvai Dosha',
    isActive: true,
    displayOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tm_03',
    fullName: 'Pandit S. Rameshwara Sastrigal',
    photoUrl: '',
    education: 'Jyothida Ratna, M.A. Tamil Literature & Astrology',
    vedicEducation: 'Krishna Yajur Veda Kramapatha, Sringeri Sankara Matham',
    yearsOfExperience: 19,
    biography: 'Distinguished scholar in Nakshatra Pada calculation, auspicious sound syllables (Nama Aksharas), and divine baby naming according to ancient Brihat Parasara and Muhurtha Shastras.',
    specialization: 'Auspicious Baby Naming (Nama Nakshatra Akshara), Rasi & Pada Analysis',
    isActive: true,
    displayOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tm_04',
    fullName: 'Pandit M. Senthilnathan',
    photoUrl: '',
    education: 'Jyothisha Praveena, Dip. in Predictive Astrology (Madras University)',
    vedicEducation: 'Sastra Vidwat, Chidambaram Gurukulam',
    yearsOfExperience: 16,
    biography: 'Vedic scholar and planetary mathematical calculator supporting precision planetary coordinates, Bhava Spudam, and Navamsa chart validation for overseas diaspora communities.',
    specialization: 'Navamsa & Bhava Spuda Computation, Jathagam Verification',
    isActive: true,
    displayOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tm_05',
    fullName: 'Vidwan R. Nataraja Ganapadigal',
    photoUrl: '',
    education: 'Veda Ganapada, Jyotish Visharad (ICAS Chennai)',
    vedicEducation: 'Rig Veda Samhita & Ganapatha Adhyayana',
    yearsOfExperience: 25,
    biography: 'Vedic scholar with 25 years of experience in Prasanna Jyothida, Gochara (planetary transit) analysis, Sade Sati and Guru Peyarchi calculations.',
    specialization: 'Prasannam, Planetary Transits (Gochara) & Graha Shanti Pariharams',
    isActive: true,
    displayOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export function computeOrderCalculatedResult(data: {
  serviceType: ServiceType;
  inputPayload: any;
  userName?: string;
  country?: string;
}): HoroscopeResult | WeddingMatchResult | BabyNamingResult | undefined {
  try {
    const p = data.inputPayload || {};
    if (data.serviceType === 'BIRTH_JATHAGAM') {
      return calculatePrecisionHoroscope(
        p.name || data.userName || 'User',
        p.dob,
        p.tob,
        p.birthPlace,
        p.latitude,
        p.longitude,
        p.timezoneOffsetHours,
        typeof p.country === 'string' ? p.country : '',
        p.gender || 'M'
      );
    } else if (data.serviceType === 'MARRIAGE_COMPATIBILITY') {
      return calculateWeddingCompatibility(p.bride || p, p.groom || p);
    } else if (data.serviceType === 'BABY_NAMING') {
      return calculateBabyNamingDetails(
        p.babyName || p.childName || p.name || '',
        p.dob,
        p.tob,
        p.birthPlace,
        p.gender || 'M',
        p.latitude,
        p.longitude,
        p.timezoneOffsetHours,
        typeof p.country === 'string' ? p.country : ''
      );
    } else if (data.serviceType === 'MUHURTHAM') {
      // Subha Muhurtham is a first-class family-tray member: the browser sends
      // the six-month panchangam scan with the order, and a payload without one
      // is rescanned only when it includes the separate Muhurtham location.
      // Legacy rows without that location fail rather than treating birthplace
      // as the event location or delivering a misleading calendar.
      return computeMuhurthamResultFromPayload({
        inputPayload: p,
        userName: data.userName,
        country: typeof p.country === 'string' ? p.country : ''
      });
    }
  } catch (err) {
    console.error('Failed to compute calculatedResult for order:', err);
  }
  return undefined;
}

class DataStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadDatabase();
    this.migrateDatabase();
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true, mode: 0o700 });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Database root must be a JSON object.');
        }
        return {
          users: [],
          birthProfiles: {},
          settings: DEFAULT_SETTINGS,
          orders: [],
          paymentIntents: [],
          auditLogs: [],
          teamMembers: DEFAULT_TEAM_MEMBERS,
          ...parsed
        } as DatabaseSchema;
      }
    } catch (e) {
      // Never overwrite a malformed/unreadable live database with an empty
      // schema. Fail startup so an operator can restore or inspect the original.
      console.error('Error loading the persistent database; refusing to reset user data:', e);
      throw new Error('The persistent database could not be read. Refusing to start with an empty replacement.');
    }
    return {
      users: [],
      birthProfiles: {},
      settings: DEFAULT_SETTINGS,
      orders: [],
      paymentIntents: [],
      auditLogs: [],
      teamMembers: DEFAULT_TEAM_MEMBERS
    };
  }

  private saveDatabase() {
    let tempFile: string | undefined;
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true, mode: 0o700 });
      }
      tempFile = `${DB_FILE}.${process.pid}.${randomUUID()}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tempFile, DB_FILE);
      // writeFile's mode only applies to newly created files; tighten an
      // existing database as well because it contains credentials and PII.
      fs.chmodSync(DB_FILE, 0o600);
    } catch (e) {
      if (tempFile) {
        try { fs.rmSync(tempFile, { force: true }); } catch {}
      }
      console.error('Error saving persistent database:', e);
      throw new Error('The persistent database could not be saved. The operation was not confirmed.');
    }
  }

  private migrateDatabase() {
    // Runtime databases are user data, not a place to bootstrap credentials.
    // Migrations only fill missing structural fields and never create or reset accounts.
    if (!Array.isArray(this.data.users)) this.data.users = [];
    const legacyVerifiedAt = new Date().toISOString();
    this.data.users.forEach(user => {
      if (!['local', 'google', 'facebook'].includes(String(user.authProvider || ''))) {
        user.authProvider = 'local';
      }
      // Records created before OTP activation were already active accounts, so
      // preserve access while explicitly grandfathering their legacy status.
      if (user.authProvider === 'local' && !user.emailVerifiedAt) {
        user.emailVerifiedAt = user.createdAt || legacyVerifiedAt;
      }
    });
    if (!Array.isArray(this.data.pendingRegistrations)) this.data.pendingRegistrations = [];
    const pendingRetentionCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.data.pendingRegistrations = this.data.pendingRegistrations
      .filter(registration => Date.parse(registration.createdAt) >= pendingRetentionCutoff)
      .slice(-1000);
    if (!this.data.birthProfiles || typeof this.data.birthProfiles !== 'object') this.data.birthProfiles = {};
    if (!this.data.settings || typeof this.data.settings !== 'object') this.data.settings = DEFAULT_SETTINGS;
    if (!Array.isArray(this.data.orders)) this.data.orders = [];
    if (!Array.isArray(this.data.auditLogs)) this.data.auditLogs = [];
    if (this.data.teamMembers === undefined || this.data.teamMembers === null) {
      this.data.teamMembers = [...DEFAULT_TEAM_MEMBERS];
    }
    if (!Array.isArray(this.data.paymentIntents)) {
      this.data.paymentIntents = [];
    }
    if (Array.isArray(this.data.contactMessages)) {
      // Older releases marked contact inquiries as emailed without ever using
      // SMTP. Clear that unverified status once; real deliveries now include a
      // dispatch timestamp and remain intact across restarts.
      this.data.contactMessages.forEach(message => {
        if (message.autoEmailDispatched && !message.emailDispatchedAt) {
          message.autoEmailDispatched = false;
          message.dispatchedTo = '';
        }
      });
    }

    // 3. Ensure all existing orders have complete calculatedResult computed
    if (this.data.orders && Array.isArray(this.data.orders)) {
      let updatedCount = 0;
      this.data.orders.forEach(order => {
        order.language = normalizeReportLanguage(order.language);
        // Multi-person headers have no single chart: their reports live in
        // `orderItems`, each with its own result, so there is nothing to heal.
        if ((order.serviceType as string) === 'MULTI_PERSON') return;
        const storedResult: any = order.calculatedResult;
        const inputPayload: any = order.inputPayload || {};
        const staleMuhurtham = order.serviceType === 'MUHURTHAM' && Boolean(order.calculatedResult) && (
          Number(storedResult?.muhurthamAlgorithmVersion) !== MUHURTHAM_ALGORITHM_VERSION ||
          !storedResult?.muhurthamPlace ||
          storedResult?.muhurthamPlace !== inputPayload.muhurthamPlace ||
          Number(storedResult?.muhurthamLatitude) !== Number(inputPayload.muhurthamLatitude) ||
          Number(storedResult?.muhurthamLongitude) !== Number(inputPayload.muhurthamLongitude) ||
          Number(storedResult?.muhurthamTimezoneOffsetHours) !== Number(inputPayload.muhurthamTimezoneOffsetHours) ||
          String(storedResult?.muhurthamTimeZoneId || '') !== String(inputPayload.muhurthamTimeZoneId || '')
        );
        const needsCalc = !order.calculatedResult ||
          (order.serviceType === 'BABY_NAMING' && (!(order.calculatedResult as any)?.nakshatraLetters || !(order.calculatedResult as any)?.primaryPadaInfo)) ||
          (order.serviceType === 'BIRTH_JATHAGAM' && !(order.calculatedResult as any)?.bhavas);
        if (staleMuhurtham) {
          // Never expose a pre-split result as though its birthplace calendar
          // were calculated for a separately selected residence/event place.
          order.calculatedResult = undefined;
          if (order.inputPayload && typeof order.inputPayload === 'object') {
            delete (order.inputPayload as any).muhurthamScan;
            delete (order.inputPayload as any).months;
          }
          updatedCount++;
        } else if (needsCalc && order.inputPayload && (order.serviceType as string) !== 'MULTI_PERSON') {
          const calc = computeOrderCalculatedResult({
            serviceType: order.serviceType as ServiceType,
            inputPayload: order.inputPayload,
            userName: order.userName,
            country: order.country
          });
          if (calc) {
            order.calculatedResult = calc;
            updatedCount++;
          }
        }
      });
    }

    this.saveDatabase();
  }

  // Users & Auth
  getUsers(): User[] {
    return this.data.users;
  }

  findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());
  }

  findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  findUserByProviderSubject(provider: 'google' | 'facebook', subject: string): User | undefined {
    return this.data.users.find(user => user.authProvider === provider && user.providerSubject === subject);
  }

  findPendingRegistrationByEmail(email: string): PendingRegistration | undefined {
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const pending = (this.data.pendingRegistrations || []).find(registration => registration.email === normalizedEmail);
    return pending ? { ...pending, birthProfile: pending.birthProfile ? { ...pending.birthProfile } : undefined } : undefined;
  }

  savePendingRegistration(registration: PendingRegistration): void {
    const normalizedEmail = registration.email.toLowerCase().trim();
    const registrations = this.data.pendingRegistrations || (this.data.pendingRegistrations = []);
    const existingIndex = registrations.findIndex(item => item.email === normalizedEmail);
    const normalized = { ...registration, email: normalizedEmail };
    if (existingIndex >= 0) registrations[existingIndex] = normalized;
    else registrations.push(normalized);
    if (registrations.length > 1000) registrations.splice(0, registrations.length - 1000);
    this.saveDatabase();
  }

  updatePendingRegistration(email: string, updates: Partial<PendingRegistration>): PendingRegistration | undefined {
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const registration = (this.data.pendingRegistrations || []).find(item => item.email === normalizedEmail);
    if (!registration) return undefined;
    Object.assign(registration, updates);
    this.saveDatabase();
    return { ...registration, birthProfile: registration.birthProfile ? { ...registration.birthProfile } : undefined };
  }

  deletePendingRegistration(email: string): boolean {
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const registrations = this.data.pendingRegistrations || [];
    const remaining = registrations.filter(item => item.email !== normalizedEmail);
    if (remaining.length === registrations.length) return false;
    this.data.pendingRegistrations = remaining;
    this.saveDatabase();
    return true;
  }

  createUser(user: Omit<User, 'id' | 'createdAt'>): User {
    const newUser: User = {
      ...user,
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this.saveDatabase();
    this.logAudit(newUser.id, newUser.name, newUser.role, 'USER_REGISTERED', `New ${newUser.role} registered: ${newUser.email}`);
    return newUser;
  }

  /**
   * Provision or explicitly promote an administrator from a trusted local
   * command. This method is intentionally not exposed by any HTTP route.
   */
  provisionAdminAccount(
    details: { name: string; email: string; mobile?: string; password: string; country?: string },
    promoteExisting = false
  ): User {
    const email = String(details.email || '').trim().toLowerCase();
    const name = cleanDisplayName(String(details.name || ''));
    const password = String(details.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid administrator email is required.');
    if (!name) throw new Error('An administrator name is required.');
    if (password.length < 12) throw new Error('Administrator passwords must contain at least 12 characters.');
    if (Buffer.byteLength(password, 'utf8') > 72) throw new Error('Administrator passwords must not exceed 72 UTF-8 bytes while bcrypt is used.');

    const passwordHash = bcrypt.hashSync(password, 12);
    const existing = this.findUserByEmail(email);
    if (existing) {
      if (!promoteExisting) {
        throw new Error('An account with this email already exists. Re-run with --promote-existing only after verifying ownership.');
      }
      existing.name = name;
      existing.mobile = String(details.mobile || existing.mobile || '');
      existing.country = String(details.country || existing.country || 'Fiji');
      existing.passwordHash = passwordHash;
      existing.role = 'admin';
      this.saveDatabase();
      this.logAudit(existing.id, existing.name, 'admin', 'ADMIN_ACCOUNT_PROVISIONED', `Administrator access explicitly provisioned for ${email}.`);
      return existing;
    }

    const admin: User = {
      id: `usr_admin_${randomUUID()}`,
      name,
      email,
      mobile: String(details.mobile || ''),
      passwordHash,
      role: 'admin',
      country: String(details.country || 'Fiji'),
      createdAt: new Date().toISOString()
    };
    this.data.users.push(admin);
    this.saveDatabase();
    this.logAudit(admin.id, admin.name, 'admin', 'ADMIN_ACCOUNT_PROVISIONED', `Administrator account explicitly provisioned for ${email}.`);
    return admin;
  }

  updateUserLastLogin(id: string) {
    const u = this.findUserById(id);
    if (u) {
      u.lastLoginAt = new Date().toISOString();
      this.saveDatabase();
    }
  }

  /**
   * Persists a corrected/edited display name for a user (the name the devotee
   * saves in their website profile is authoritative and must survive logins).
   */
  updateUserName(id: string, name: string) {
    const u = this.findUserById(id);
    const clean = cleanDisplayName(name);
    if (u && clean && u.name !== clean) {
      u.name = clean;
      this.saveDatabase();
    }
  }

  /**
   * Converges users.name and birth_profiles.name onto the devotee's saved
   * website-profile name (the authoritative display name) and returns it.
   * This heals legacy rows where the two names drifted apart (e.g. a stale
   * "Ramesh Chand" kept showing after the devotee renamed themselves), and
   * never lets a Google/Facebook account name overwrite the saved name.
   */
  healDisplayNames(userId: string): string {
    const u = this.findUserById(userId);
    if (!u) return '';
    const bp = this.data.birthProfiles[userId];
    const display = resolveDisplayName(u.name, bp?.name, u.email);
    if (u.name !== display) u.name = display;
    if (bp && bp.name !== display) bp.name = display;
    this.saveDatabase();
    return display;
  }

  // Birth Profile
  getBirthProfile(userId: string): CustomerBirthProfile | undefined {
    return this.data.birthProfiles[userId];
  }

  saveBirthProfile(profile: CustomerBirthProfile) {
    this.data.birthProfiles[profile.userId] = {
      ...profile,
      name: cleanDisplayName(profile.name),
      updatedAt: new Date().toISOString()
    };
    this.saveDatabase();
    this.logAudit(profile.userId, profile.name, 'customer', 'BIRTH_PROFILE_UPDATED', `Birth details updated for ${profile.name} (${profile.birthPlace})`);
  }

  // System Settings
  getSettings(): SystemSettings {
    return this.data.settings;
  }

  /**
   * Settings safe to expose on the PUBLIC (unauthenticated) endpoint.
   * SECURITY: the previous public payload only removed `paypalSecret` and
   * therefore leaked the SMTP password and the Facebook app secret to anyone
   * who called GET /api/services/settings.
   */
  getPublicSettings(): Partial<SystemSettings> {
    const {
      paypalSecret,
      paypalClientSecret,
      indiaGpayKeySecret,
      indiaGpayWebhookSecret,
      razorpayKeySecret,
      razorpayWebhookSecret,
      razorpaySecret,
      vodafoneMPaisaApiSecret,
      facebookAppSecret,
      emailSettings,
      emailTemplates,
      chatAlertSettings,
      ...safe
    } = this.data.settings as any;

    const source = this.data.settings as any;
    const razorpayConfigured = source.indiaGpayOnlineProvider === 'razorpay' &&
      typeof source.indiaGpayKeyId === 'string' && source.indiaGpayKeyId.startsWith('rzp_') &&
      hasConfiguredSecret(source.indiaGpayKeySecret);
    const paypalCredential = (typeof source.paypalSecret === 'string' && source.paypalSecret.trim())
      ? source.paypalSecret
      : source.paypalClientSecret;
    const paypalConfigured = typeof source.paypalClientId === 'string' && source.paypalClientId.trim().length > 3 &&
      hasConfiguredSecret(paypalCredential);

    return {
      ...safe,
      indiaGpayPaymentMode: razorpayConfigured && safe.indiaGpayPaymentMode === 'online' ? 'online' : 'offline',
      paypalPaymentMode: paypalConfigured && safe.paypalPaymentMode === 'online' ? 'online' : 'offline',
      // M-PAiSA stays manual until its official signed callback/webhook is configured.
      vodafoneMPaisaPaymentMode: 'offline',
      indiaGpayOnlineConfigured: razorpayConfigured,
      paypalOnlineConfigured: paypalConfigured,
      vodafoneMPaisaOnlineConfigured: false,
      // Only the non-sensitive display fields of the mail configuration.
      emailSettings: emailSettings
        ? {
            senderName: emailSettings.senderName,
            senderEmail: emailSettings.senderEmail,
            replyTo: emailSettings.replyTo,
            status: emailSettings.status
          }
        : undefined,
      // SECURITY: never expose WhatsApp/Viber API tokens publicly - only the
      // on/off flags so the UI can reflect alert availability.
      chatAlertSettings: chatAlertSettings
        ? {
            enabled: chatAlertSettings.enabled,
            notifyOrderConfirmed: chatAlertSettings.notifyOrderConfirmed,
            notifyOrderCompleted: chatAlertSettings.notifyOrderCompleted,
            whatsapp: {
              enabled: chatAlertSettings.whatsapp?.enabled
            },
            viber: {
              enabled: chatAlertSettings.viber?.enabled
            }
          }
        : undefined
    } as Partial<SystemSettings>;
  }

  updateSettings(settings: Partial<SystemSettings>, actor: { id: string; name: string }): SystemSettings {
    let updatedEmailSettings = settings.emailSettings
      ? { ...this.data.settings.emailSettings, ...settings.emailSettings }
      : this.data.settings.emailSettings;

    // The admin UI never receives the SMTP password. An empty or masked value
    // means "keep the saved password", not "replace it with a placeholder".
    if (settings.emailSettings && (!settings.emailSettings.smtpPassword || /[•]/.test(settings.emailSettings.smtpPassword) || /^\*{4,}$/.test(settings.emailSettings.smtpPassword))) {
      updatedEmailSettings = {
        ...updatedEmailSettings,
        smtpPassword: /[•]/.test(this.data.settings.emailSettings.smtpPassword || '') || /^\*{4,}$/.test(this.data.settings.emailSettings.smtpPassword || '')
          ? ''
          : this.data.settings.emailSettings.smtpPassword
      };
    }
    delete (updatedEmailSettings as any).smtpPasswordConfigured;

    const prevChat = this.data.settings.chatAlertSettings;
    const updatedChatSettings = settings.chatAlertSettings
      ? {
          ...prevChat,
          ...settings.chatAlertSettings,
          whatsapp: {
            ...(prevChat?.whatsapp || ({} as ChatAlertConfig['whatsapp'])),
            ...(settings.chatAlertSettings.whatsapp || {})
          },
          viber: {
            ...(prevChat?.viber || ({} as ChatAlertConfig['viber'])),
            ...(settings.chatAlertSettings.viber || {})
          }
        }
      : prevChat;

    this.data.settings = {
      ...this.data.settings,
      ...settings,
      emailSettings: updatedEmailSettings,
      chatAlertSettings: updatedChatSettings
    };
    this.saveDatabase();
    this.logAudit(actor.id, actor.name, 'admin', 'SETTINGS_UPDATED', `Settings updated. Service mode: ${this.data.settings.serviceMode}, Template: ${this.data.settings.activeThemeTemplate || 'classic-primary'}`);
    return this.data.settings;
  }

  // Payment intents
  createPaymentIntent(data: {
    userId: string;
    paymentMethod: PaymentMethod;
    provider: string;
    amount: number;
    currency: 'FJD' | 'USD' | 'INR';
    gatewayOrderId?: string;
    expiresInMinutes?: number;
  }): PaymentIntent {
    const now = new Date();
    const intent: PaymentIntent = {
      id: `pi_${randomUUID()}`,
      userId: data.userId,
      paymentMethod: data.paymentMethod,
      provider: data.provider,
      amount: Number(data.amount.toFixed(2)),
      currency: data.currency,
      status: 'CREATED',
      gatewayOrderId: data.gatewayOrderId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (data.expiresInMinutes || 15) * 60_000).toISOString()
    };
    (this.data.paymentIntents ||= []).unshift(intent);
    this.saveDatabase();
    return intent;
  }

  getPaymentIntentForUser(id: string, userId: string): PaymentIntent | undefined {
    const intent = (this.data.paymentIntents || []).find(item => item.id === id && item.userId === userId);
    if (!intent) return undefined;
    if (intent.status === 'CREATED' && new Date(intent.expiresAt).getTime() <= Date.now()) {
      intent.status = 'EXPIRED';
      intent.updatedAt = new Date().toISOString();
      this.saveDatabase();
    }
    return intent;
  }

  getPaymentIntentByReference(reference: string, userId: string): PaymentIntent | undefined {
    const clean = reference.trim().toLowerCase();
    if (!clean) return undefined;
    return (this.data.paymentIntents || []).find(item =>
      item.userId === userId && item.paymentReference?.trim().toLowerCase() === clean
    );
  }

  capturePaymentIntent(data: {
    id: string;
    userId: string;
    gatewayOrderId: string;
    gatewayPaymentId: string;
    paymentReference: string;
    payerAccount?: string;
  }): PaymentIntent | undefined {
    const intent = this.getPaymentIntentForUser(data.id, data.userId);
    if (!intent || intent.status === 'EXPIRED' || intent.status === 'FAILED' || intent.status === 'CONSUMED') return undefined;
    if (intent.gatewayOrderId && intent.gatewayOrderId !== data.gatewayOrderId) return undefined;
    if (intent.status === 'CAPTURED') {
      if (intent.gatewayPaymentId !== data.gatewayPaymentId || intent.paymentReference !== data.paymentReference) return undefined;
      return intent;
    }
    intent.status = 'CAPTURED';
    intent.gatewayOrderId = data.gatewayOrderId;
    intent.gatewayPaymentId = data.gatewayPaymentId;
    intent.paymentReference = data.paymentReference;
    intent.payerAccount = data.payerAccount;
    intent.updatedAt = new Date().toISOString();
    this.saveDatabase();
    return intent;
  }

  /** Provider webhook / reconciliation lookup: an intent is bound to one gateway order. */
  getPaymentIntentByGatewayOrderId(gatewayOrderId: string): PaymentIntent | undefined {
    const clean = String(gatewayOrderId || '').trim();
    if (!clean) return undefined;
    return (this.data.paymentIntents || []).find(item => item.gatewayOrderId === clean);
  }

  /**
   * Capture an intent from a *server-verified* provider callback.
   *
   * This path deliberately does not require the browser session: the whole point
   * of webhooks/reconciliation is to recover a payment whose client callback was
   * never received. The caller must have verified the provider signature and the
   * amount/currency before calling. Idempotent: replaying the same capture keeps
   * the original reference.
   */
  capturePaymentIntentFromProvider(data: {
    intentId: string;
    gatewayPaymentId: string;
    paymentReference: string;
    gatewaySignature?: string;
    payerAccount?: string;
  }): PaymentIntent | undefined {
    const intent = (this.data.paymentIntents || []).find(item => item.id === data.intentId);
    if (!intent) return undefined;
    if (intent.status === 'EXPIRED' || intent.status === 'FAILED' || intent.status === 'CONSUMED') return undefined;
    if (intent.status === 'CAPTURED') {
      if (intent.gatewayPaymentId && intent.gatewayPaymentId !== data.gatewayPaymentId) return undefined;
      return intent;
    }
    intent.status = 'CAPTURED';
    intent.gatewayPaymentId = data.gatewayPaymentId;
    intent.paymentReference = data.paymentReference;
    if (data.gatewaySignature) intent.gatewaySignature = data.gatewaySignature;
    if (data.payerAccount) intent.payerAccount = data.payerAccount;
    intent.updatedAt = new Date().toISOString();
    this.saveDatabase();
    return intent;
  }

  /**
   * Intents that were created but never captured — the candidates for
   * reconciliation when a checkout callback was missed.
   */
  listStalePaymentIntents(minutes = 30, limit = 50): PaymentIntent[] {
    const cutoff = Date.now() - Math.max(1, minutes) * 60_000;
    return (this.data.paymentIntents || [])
      .filter(intent => intent.status === 'CREATED' && new Date(intent.createdAt).getTime() <= cutoff)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, Math.max(1, limit));
  }

  getPaymentIntentById(id: string): PaymentIntent | undefined {
    return (this.data.paymentIntents || []).find(item => item.id === id);
  }

  /** Mark a payment session as expired (used by the reconciliation sweep). */
  expirePaymentIntent(id: string): boolean {
    const intent = (this.data.paymentIntents || []).find(item => item.id === id);
    if (!intent || intent.status !== 'CREATED') return false;
    intent.status = 'EXPIRED';
    intent.updatedAt = new Date().toISOString();
    this.saveDatabase();
    return true;
  }

  /** Store a provider callback for audit + idempotency. Returns duplicate=true on replay. */
  recordPaymentWebhookEvent(event: {
    provider: string;
    externalEventId: string;
    eventType: string;
    status: PaymentWebhookEvent['status'];
    intentId?: string;
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
    detail?: string;
    payloadDigest: string;
    ip?: string;
    id?: string;
  }): { duplicate: boolean; event: PaymentWebhookEvent } {
    const events = (this.data.paymentWebhookEvents ||= []);
    const externalEventId = String(event.externalEventId || '');
    if (externalEventId) {
      const existing = events.find(item =>
        item.provider === event.provider && item.externalEventId === externalEventId
      );
      if (existing) return { duplicate: true, event: existing };
    }
    const record: PaymentWebhookEvent = {
      id: event.id || `pwh_${randomUUID()}`,
      provider: event.provider,
      externalEventId,
      eventType: String(event.eventType || 'unknown'),
      status: event.status,
      intentId: event.intentId,
      gatewayOrderId: event.gatewayOrderId,
      gatewayPaymentId: event.gatewayPaymentId,
      detail: String(event.detail || '').slice(0, 500),
      payloadDigest: event.payloadDigest,
      receivedAt: new Date().toISOString(),
      ip: event.ip
    };
    events.unshift(record);
    // Bound the audit log so the JSON store cannot grow without limit.
    if (events.length > 500) events.length = 500;
    this.saveDatabase();
    return { duplicate: false, event: record };
  }

  listPaymentWebhookEvents(limit = 50): PaymentWebhookEvent[] {
    return (this.data.paymentWebhookEvents || []).slice(0, Math.max(1, limit));
  }

  consumePaymentIntent(id: string, userId: string, orderId: string, amount: number, currency: 'FJD' | 'USD' | 'INR'): PaymentIntent | undefined {
    const intent = this.getPaymentIntentForUser(id, userId);
    if (!intent || intent.status !== 'CAPTURED' || intent.orderId || intent.amount !== Number(amount.toFixed(2)) || intent.currency !== currency) return undefined;
    intent.status = 'CONSUMED';
    intent.orderId = orderId;
    intent.consumedAt = new Date().toISOString();
    intent.updatedAt = intent.consumedAt;
    this.saveDatabase();
    return intent;
  }

  // Orders
  getOrders(): Order[] {
    return this.data.orders;
  }

  getOrderById(id: string): Order | undefined {
    return this.data.orders.find(o => o.id === id || o.orderNumber === id);
  }

  getOrdersByGroupId(groupId: string): Order[] {
    if (!groupId) return [];
    return this.data.orders.filter(o => o.groupId === groupId);
  }

  updateOrdersByGroupId(
    groupId: string,
    updates: Partial<Order>,
    actor?: { id: string; name: string; role: UserRole }
  ): Order[] {
    if (!groupId) return [];
    const matched = this.data.orders.filter(o => o.groupId === groupId);
    const safeUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(safeUpdates, 'language')) {
      safeUpdates.language = normalizeReportLanguage(safeUpdates.language);
    }
    matched.forEach(order => {
      Object.assign(order, safeUpdates, { updatedAt: new Date().toISOString() });
    });
    this.saveDatabase();

    if (actor && updates.status) {
      this.logAudit(
        actor.id,
        actor.name,
        actor.role,
        'FAMILY_ORDER_STATUS_CHANGED',
        `Family Bundle [${groupId}] (${matched.length} charts) status updated to: ${updates.status}`
      );
    }

    return matched;
  }

  getUserOrders(userId: string): Order[] {
    return this.data.orders
      .filter(o => o.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getBetaIpOrderCount(ipAddress: string): number {
    if (!ipAddress) return 0;
    const records = this.data.betaIpOrders || [];
    return records.filter(r => r.ipAddress === ipAddress).length;
  }

  recordBetaIpOrder(data: {
    ipAddress: string;
    orderId: string;
    orderNumber: string;
    userId: string;
    userEmail: string;
    serviceType: string;
  }) {
    if (!this.data.betaIpOrders) {
      this.data.betaIpOrders = [];
    }
    this.data.betaIpOrders.push({
      ...data,
      createdAt: new Date().toISOString()
    });
    this.saveDatabase();
  }

  createOrder(orderData: {
    userId: string;
    userName: string;
    userEmail: string;
    userMobile: string;
    serviceType: ServiceType;
    language: AppLanguage;
    country: string;
    /** Account/billing country — never a birth place. */
    billingCountry?: string;
    paymentMethod?: PaymentMethod;
    /** Currency the customer chose to pay in (derived from the payment method). */
    currency?: 'INR' | 'FJD' | 'USD';
    paymentReference?: string;
    paymentIntentId?: string;
    paymentStatus?: PaymentIntentStatus | 'NOT_REQUIRED' | 'PENDING_ADMIN' | 'VERIFIED_MANUAL';
    inputPayload: Record<string, any>;
    ipAddress?: string;
    /** Trusted server-side flag used only for authenticated admin orders. */
    forceFree?: boolean;
  }): Order {
    const settings = this.getSettings();
    const adminFreeOrder = orderData.forceFree === true;
    const isFiji = orderData.country?.toLowerCase().includes('fiji') || orderData.country === 'FJ';
    const isIndia = orderData.country?.toLowerCase().includes('india') || orderData.country === 'IN';

    // CURRENCY RULE: the payment method the customer picked decides the
    // currency (GPAY/UPI -> INR, MPAISA/MYCASH -> FJD, PAYPAL/CARD -> USD).
    // A birth place never changes it; it is only a fallback for FREE_BETA
    // orders where no payment method exists.
    const currency = resolveOrderCurrency({
      paymentMethod: orderData.paymentMethod,
      billingCountry: orderData.billingCountry,
      country: orderData.country,
      currency: orderData.currency
    });

    const prices = getServicePrices(settings, orderData.serviceType);
    // FREE BETA RULE: exactly ONE free report per IP address — the FIRST
    // order from an IP is free; once used, every later order is a paid order.
    const freeChartAvailable =
      adminFreeOrder || (settings.serviceMode === 'FREE_BETA' && this.getBetaIpOrderCount(orderData.ipAddress || '') < 1);
    const amount = adminFreeOrder || freeChartAvailable ? 0 : prices[currency];
    const orderServiceMode: ServiceMode = adminFreeOrder || freeChartAvailable ? 'FREE_BETA' : 'PAID';

    const initialStatus: OrderStatus = adminFreeOrder || freeChartAvailable || orderData.paymentStatus === 'CAPTURED'
      ? 'PENDING_APPROVAL'
      : 'PENDING_PAYMENT_VERIFICATION';

    const orderCount = this.data.orders.length + 1001;
    const orderNumber = `AF-${new Date().getFullYear()}-${orderCount}`;
    const calculatedResult = computeOrderCalculatedResult({
      serviceType: orderData.serviceType,
      inputPayload: orderData.inputPayload,
      userName: orderData.userName,
      country: orderData.country
    });

    const newOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderNumber,
      userId: orderData.userId,
      userName: orderData.userName,
      userEmail: orderData.userEmail,
      userMobile: orderData.userMobile,
      serviceType: orderData.serviceType,
      language: normalizeReportLanguage(orderData.language),
      country: orderData.country || (isIndia ? 'India' : isFiji ? 'Fiji' : 'International'),
      currency,
      amount,
      serviceMode: orderServiceMode,
      paymentMethod: adminFreeOrder
        ? 'NONE'
        : orderData.paymentMethod ||
          (freeChartAvailable
            ? 'NONE'
            : defaultPaymentMethodForAccount(orderData.billingCountry || orderData.country)),
      paymentReference: adminFreeOrder ? undefined : orderData.paymentReference,
      paymentIntentId: adminFreeOrder ? undefined : orderData.paymentIntentId,
      paymentStatus: adminFreeOrder || freeChartAvailable ? 'NOT_REQUIRED' : (orderData.paymentStatus || 'PENDING_ADMIN'),
      status: initialStatus,
      emailStatus: 'NOT_SENT',
      emailDeliveryAttempts: 0,
      inputPayload: orderData.inputPayload,
      calculatedResult,
      hasPdf: false,
      ipAddress: orderData.ipAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.orders.unshift(newOrder);

    // Only the ONE free beta report of this IP is recorded — paid orders
    // never consume the free slot.
    if (!adminFreeOrder && freeChartAvailable && orderData.ipAddress) {
      this.recordBetaIpOrder({
        ipAddress: orderData.ipAddress,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        userId: orderData.userId,
        userEmail: orderData.userEmail,
        serviceType: orderData.serviceType
      });
    }

    this.saveDatabase();

    this.logAudit(
      orderData.userId,
      orderData.userName,
      adminFreeOrder ? 'admin' : 'customer',
      'ORDER_PLACED',
      `Placed ${newOrder.serviceType} order [${orderNumber}] in ${newOrder.language.toUpperCase()} (${adminFreeOrder ? 'ADMIN FREE' : orderServiceMode} mode) from IP: ${orderData.ipAddress || 'unknown'}`
    );

    return newOrder;
  }

  createMultiOrder(data: {
    userId: string;
    userName: string;
    userEmail: string;
    userMobile: string;
    items: Array<{
      serviceType: ServiceType;
      language: AppLanguage;
      /** Birth country of that family member (display only, never pricing). */
      country: string;
      inputPayload: Record<string, any>;
    }>;
    /** Account/billing country — never a birth place. */
    billingCountry?: string;
    paymentMethod?: PaymentMethod;
    /** Currency the customer chose to pay in (derived from the payment method). */
    currency?: 'INR' | 'FJD' | 'USD';
    paymentReference?: string;
    paymentIntentId?: string;
    paymentStatus?: PaymentIntentStatus | 'NOT_REQUIRED' | 'PENDING_ADMIN' | 'VERIFIED_MANUAL';
    ipAddress?: string;
    /** Trusted server-side flag used only for authenticated admin orders. */
    forceFree?: boolean;
  }): Order[] {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('A family order must contain at least one chart.');
    }
    if (data.items.length > MAX_FAMILY_ORDER_ITEMS) {
      throw new Error(`A family order can contain at most ${MAX_FAMILY_ORDER_ITEMS} reports.`);
    }

    const settings = this.getSettings();
    const adminFreeOrder = data.forceFree === true;
    const groupId = `GRP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const createdOrders: Order[] = [];
    const totalCount = data.items.length;

    // ONE family order = ONE payment = ONE currency. It comes from the payment
    // method the customer selected at checkout, no matter where each family
    // member was born (India, Fiji, USA ... all priced in the same currency).
    const currency = resolveOrderCurrency({
      paymentMethod: data.paymentMethod,
      billingCountry: data.billingCountry,
      country: data.billingCountry,
      currency: data.currency
    });
    const groupPaymentMethod: PaymentMethod = adminFreeOrder
      ? 'NONE'
      : data.paymentMethod ||
        (settings.serviceMode === 'FREE_BETA'
          ? 'NONE'
          : defaultPaymentMethodForAccount(data.billingCountry));

    const isFreeBetaMode = settings.serviceMode === 'FREE_BETA';
    // Customers get one free chart per IP. Authenticated admins are a separate
    // path: every chart in an admin-created family order is always free and
    // does not consume the customer's beta allowance.
    const freeChartAvailable = !adminFreeOrder && isFreeBetaMode && this.getBetaIpOrderCount(data.ipAddress || '') < 1;

    data.items.forEach((item, index) => {
      const prices = getServicePrices(settings, item.serviceType);
      // Customer-only baseline: isThisItemFree = freeChartAvailable && index === 0;
      // Admins override the family line to free for every chart.
      const isThisItemFree = adminFreeOrder || (freeChartAvailable && index === 0);
      const amount = isThisItemFree ? 0 : prices[currency];
      const itemServiceMode: ServiceMode = isThisItemFree ? 'FREE_BETA' : 'PAID';

      const initialStatus: OrderStatus = isThisItemFree || data.paymentStatus === 'CAPTURED'
        ? 'PENDING_APPROVAL'
        : 'PENDING_PAYMENT_VERIFICATION';

      const orderCount = this.data.orders.length + 1001;
      const orderNumber = `AF-${new Date().getFullYear()}-${orderCount}`;
      const calculatedResult = computeOrderCalculatedResult({
        serviceType: item.serviceType,
        inputPayload: item.inputPayload,
        userName: data.userName,
        country: item.country || ''
      });

      const newOrder: Order = {
        id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${index + 1}`,
        orderNumber,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        userMobile: data.userMobile,
        serviceType: item.serviceType,
        language: normalizeReportLanguage(item.language),
        country: item.country || '',
        currency,
        amount,
        serviceMode: itemServiceMode,
        paymentMethod: groupPaymentMethod,
        paymentReference: adminFreeOrder ? undefined : data.paymentReference,
        paymentIntentId: adminFreeOrder ? undefined : data.paymentIntentId,
        paymentStatus: adminFreeOrder || isThisItemFree ? 'NOT_REQUIRED' : (data.paymentStatus || 'PENDING_ADMIN'),
        status: initialStatus,
        emailStatus: 'NOT_SENT',
        emailDeliveryAttempts: 0,
        inputPayload: item.inputPayload,
        calculatedResult,
        hasPdf: false,
        ipAddress: data.ipAddress,
        groupId,
        groupOrderIndex: index + 1,
        groupOrderCount: totalCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.data.orders.unshift(newOrder);
      createdOrders.push(newOrder);

      // The FIRST chart consumes the ONE free-beta slot of this IP — exactly
      // one free report per IP address. Paid charts never consume it.
      if (!adminFreeOrder && isThisItemFree && data.ipAddress) {
        this.recordBetaIpOrder({
          ipAddress: data.ipAddress,
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          userId: data.userId,
          userEmail: data.userEmail,
          serviceType: item.serviceType
        });
      }
    });

    this.saveDatabase();

    this.logAudit(
      data.userId,
      data.userName,
      adminFreeOrder ? 'admin' : 'customer',
      'MULTI_ORDER_PLACED',
      `Placed Family Bundle (${totalCount} charts, Group: ${groupId}) in ${adminFreeOrder ? 'ADMIN FREE' : settings.serviceMode + ' mode'} (${adminFreeOrder ? 'all free' : freeChartAvailable ? '1 free beta chart + ' + (totalCount - 1) + ' paid' : 'all paid'}) from IP: ${data.ipAddress || 'unknown'}`
    );

    return createdOrders;
  }

  /**
   * MULTI-PERSON ORDER (mirrors `astro_create_multi_person_order()` in PHP).
   *
   * ONE order row (service_type = MULTI_PERSON, amount = server-computed total)
   * plus N `order_persons` rows and M `order_items` rows, written in one
   * synchronous transaction (a single saveDatabase() at the end). The client
   * total is never trusted: every unit price comes from the server price list.
   */
  createMultiPersonOrder(data: {
    userId: string;
    userName: string;
    userEmail: string;
    userMobile: string;
    items: Array<{
      serviceCode: ServiceType;
      language: AppLanguage;
      country: string;
      inputPayload: Record<string, any>;
      person: {
        seq: number;
        fullName: string;
        gender: string;
        dob: string;
        tob: string;
        place: string;
        country: string;
        lat?: number | null;
        lon?: number | null;
        tz?: number | null;
      };
    }>;
    /** Account/billing country - never a birth place. */
    billingCountry?: string;
    paymentMethod?: PaymentMethod;
    currency?: 'INR' | 'FJD' | 'USD';
    paymentReference?: string;
    paymentIntentId?: string;
    paymentStatus?: PaymentIntentStatus | 'NOT_REQUIRED' | 'PENDING_ADMIN' | 'VERIFIED_MANUAL';
    ipAddress?: string;
    /** Trusted server-side flag used only for authenticated admin orders. */
    forceFree?: boolean;
  }): {
    order: Order;
    persons: OrderPersonRecord[];
    items: OrderItemRecord[];
    totalAmount: number;
    freeItems: number;
    paidItems: number;
  } {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('A multi-person order must contain at least one report.');
    }

    const settings = this.getSettings();
    const adminFreeOrder = data.forceFree === true;
    const currency = resolveOrderCurrency({
      paymentMethod: data.paymentMethod,
      billingCountry: data.billingCountry,
      country: data.billingCountry,
      currency: data.currency
    });

    const isFreeBetaMode = settings.serviceMode === 'FREE_BETA';
    // Customers get the FIRST report free once per IP; admin orders never
    // charge and never consume the customer's free-beta allowance.
    const freeChartAvailable = !adminFreeOrder && isFreeBetaMode && this.getBetaIpOrderCount(data.ipAddress || '') < 1;

    const orderCount = this.data.orders.length + 1001;
    const orderNumber = `AF-${new Date().getFullYear()}-${orderCount}`;
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const allPersons = this.data.orderPersons || (this.data.orderPersons = []);
    const allItems = this.data.orderItems || (this.data.orderItems = []);

    let nextPersonId = allPersons.reduce((max, person) => Math.max(max, person.id || 0), 0) + 1;
    let nextItemId = allItems.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;

    const persons: OrderPersonRecord[] = [];
    const items: OrderItemRecord[] = [];
    const personIdBySeq = new Map<number, number>();
    let totalAmount = 0;
    let freeItems = 0;

    data.items.forEach((item, index) => {
      // One person row per distinct seq - several reports can share a person.
      if (!personIdBySeq.has(item.person.seq)) {
        const person: OrderPersonRecord = {
          id: nextPersonId++,
          orderId,
          seq: item.person.seq,
          fullName: item.person.fullName,
          gender: item.person.gender,
          dob: item.person.dob,
          tob: item.person.tob,
          place: item.person.place,
          country: item.person.country,
          lat: item.person.lat ?? null,
          lon: item.person.lon ?? null,
          tz: item.person.tz ?? null
        };
        persons.push(person);
        personIdBySeq.set(item.person.seq, person.id);
      }

      const prices = getServicePrices(settings, item.serviceCode);
      const isThisItemFree = adminFreeOrder || (freeChartAvailable && index === 0);
      const unitPrice = isThisItemFree ? 0 : prices[currency];
      if (isThisItemFree) freeItems += 1;
      totalAmount += unitPrice;

      const calculatedResult = computeOrderCalculatedResult({
        serviceType: item.serviceCode,
        inputPayload: item.inputPayload,
        userName: data.userName,
        country: item.country || ''
      });

      items.push({
        id: nextItemId++,
        orderId,
        personId: personIdBySeq.get(item.person.seq)!,
        serviceCode: item.serviceCode,
        unitPrice,
        reportStatus: calculatedResult ? 'CALCULATED' : 'PENDING',
        language: normalizeReportLanguage(item.language),
        inputPayload: item.inputPayload,
        calculatedResult,
        sentAt: null
      });
    });

    const paidItems = items.length - freeItems;
    const chargeable = paidItems > 0 && !adminFreeOrder;

    const order: Order = {
      id: orderId,
      orderNumber,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      userMobile: data.userMobile,
      serviceType: 'MULTI_PERSON',
      language: normalizeReportLanguage(data.items[0].language),
      country: data.billingCountry || 'Fiji',
      currency,
      amount: totalAmount,
      serviceMode: freeItems > 0 ? 'FREE_BETA' : 'PAID',
      paymentMethod: adminFreeOrder ? 'NONE' : (data.paymentMethod || 'NONE'),
      paymentReference: adminFreeOrder ? undefined : data.paymentReference,
      paymentIntentId: adminFreeOrder ? undefined : data.paymentIntentId,
      paymentStatus: adminFreeOrder || !chargeable ? 'NOT_REQUIRED' : (data.paymentStatus || 'PENDING_ADMIN'),
      status: adminFreeOrder || !chargeable || data.paymentStatus === 'CAPTURED' ? 'PENDING_APPROVAL' : 'PENDING_PAYMENT_VERIFICATION',
      emailStatus: 'NOT_SENT',
      emailDeliveryAttempts: 0,
      // Header payload mirrors the first report so legacy screens still render.
      inputPayload: data.items[0].inputPayload,
      calculatedResult: items[0].calculatedResult,
      hasPdf: false,
      ipAddress: data.ipAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    allPersons.push(...persons);
    allItems.push(...items);
    this.data.orders.unshift(order);

    // The first free report consumes the ONE free-beta slot of this IP.
    if (!adminFreeOrder && freeItems > 0 && data.ipAddress) {
      this.recordBetaIpOrder({
        ipAddress: data.ipAddress,
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: data.userId,
        userEmail: data.userEmail,
        serviceType: 'MULTI_PERSON'
      });
    }

    this.saveDatabase();

    this.logAudit(
      data.userId,
      data.userName,
      adminFreeOrder ? 'admin' : 'customer',
      'MULTI_PERSON_ORDER_PLACED',
      `Placed multi-person order [${orderNumber}] with ${persons.length} people and ${items.length} reports (${freeItems} free, total ${totalAmount.toFixed(2)} ${currency}) from IP: ${data.ipAddress || 'unknown'}`
    );

    return { order, persons, items, totalAmount, freeItems, paidItems };
  }

  getOrderPersons(orderId: string): OrderPersonRecord[] {
    return (this.data.orderPersons || [])
      .filter(person => person.orderId === orderId)
      .sort((a, b) => (a.seq || 0) - (b.seq || 0));
  }

  getOrderItems(orderId: string): OrderItemRecord[] {
    return (this.data.orderItems || []).filter(item => item.orderId === orderId);
  }

  findOrderItem(orderId: string, itemId: number): OrderItemRecord | undefined {
    return (this.data.orderItems || []).find(item => item.orderId === orderId && item.id === Number(itemId));
  }

  updateOrderItem(itemId: number, updates: Partial<OrderItemRecord>): OrderItemRecord | undefined {
    const item = (this.data.orderItems || []).find(candidate => candidate.id === Number(itemId));
    if (!item) return undefined;
    Object.assign(item, updates);
    this.saveDatabase();
    return item;
  }

  /**
   * Attaches people/reports to order copies (the old rows simply get empty
   * arrays). Copies - never the live array - so routes cannot corrupt the store.
   */
  attachOrderChildren<T extends { id: string }>(
    orders: T[]
  ): Array<T & { persons: OrderPersonRecord[]; items: OrderItemRecord[] }> {
    return orders.map(order => ({
      ...order,
      persons: this.getOrderPersons(order.id),
      items: this.getOrderItems(order.id)
    }));
  }

  updateOrder(orderId: string, updates: Partial<Order>, actor?: { id: string; name: string; role: UserRole }): Order | undefined {
    const order = this.getOrderById(orderId);
    if (!order) return undefined;

    const safeUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(safeUpdates, 'language')) {
      safeUpdates.language = normalizeReportLanguage(safeUpdates.language);
    }
    Object.assign(order, safeUpdates, { updatedAt: new Date().toISOString() });
    this.saveDatabase();

    if (actor && updates.status) {
      this.logAudit(
        actor.id,
        actor.name,
        actor.role,
        'ORDER_STATUS_CHANGED',
        `Order [${order.orderNumber}] status updated to: ${updates.status}`
      );
    }

    return order;
  }

  deleteOrder(orderId: string, actor?: { id: string; name: string; role: UserRole }): boolean {
    const idx = this.data.orders.findIndex(o => o.id === orderId);
    if (idx === -1) return false;
    const [deleted] = this.data.orders.splice(idx, 1);
    this.saveDatabase();

    if (actor) {
      this.logAudit(
        actor.id,
        actor.name,
        actor.role,
        'ORDER_DELETED',
        `Deleted order [${deleted.orderNumber}] (${deleted.id})`
      );
    }
    return true;
  }

  // Audit Logs
  logAudit(actorId: string, actorName: string, actorRole: UserRole, action: string, details: string, ip?: string) {
    const log: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorId,
      actorName,
      actorRole,
      action,
      details,
      ip
    };
    this.data.auditLogs.unshift(log);
    // Keep max 500 audit logs
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.saveDatabase();
  }

  getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  // Statistics
  getStatistics() {
    const orders = this.data.orders;
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
    const pendingApproval = orders.filter(o => o.status === 'PENDING_APPROVAL' || o.status === 'PENDING_PAYMENT_VERIFICATION').length;
    const rejectedOrders = orders.filter(o => o.status === 'REJECTED').length;

    const totalRevenueFJD = orders
      .filter(o => o.status === 'COMPLETED' && o.currency === 'FJD')
      .reduce((sum, o) => sum + o.amount, 0);

    const totalRevenueUSD = orders
      .filter(o => o.status === 'COMPLETED' && o.currency === 'USD')
      .reduce((sum, o) => sum + o.amount, 0);

    const serviceCounts: Record<string, number> = {
      BIRTH_JATHAGAM: 0,
      MARRIAGE_COMPATIBILITY: 0,
      BABY_NAMING: 0,
      MUHURTHAM: 0
    };
    const languageCounts: Record<string, number> = {
      ta: 0,
      en: 0,
      hi: 0
    };
    const countryCounts: Record<string, number> = {};

    orders.forEach(o => {
      serviceCounts[o.serviceType] = (serviceCounts[o.serviceType] || 0) + 1;
      languageCounts[o.language] = (languageCounts[o.language] || 0) + 1;
      const c = o.country || 'Fiji';
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    });

    return {
      totalOrders,
      completedOrders,
      pendingApproval,
      rejectedOrders,
      totalRevenueFJD,
      totalRevenueUSD,
      serviceCounts,
      languageCounts,
      countryCounts,
      totalUsers: this.data.users.length,
      currentServiceMode: this.data.settings.serviceMode
    };
  }

  // Astrology Team Members
  getTeamMembers(onlyActive = false): TeamMember[] {
    const list = this.data.teamMembers || [];
    const filtered = onlyActive ? list.filter(m => m.isActive) : list;
    return filtered.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  getTeamMemberById(id: string): TeamMember | undefined {
    return (this.data.teamMembers || []).find(m => m.id === id);
  }

  createTeamMember(data: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>, actor?: { id: string; name: string }): TeamMember {
    if (!this.data.teamMembers) {
      this.data.teamMembers = [];
    }
    const maxOrder = this.data.teamMembers.reduce((max, m) => Math.max(max, m.displayOrder || 0), 0);
    const newMember: TeamMember = {
      ...data,
      id: `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      displayOrder: data.displayOrder ?? (maxOrder + 1),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.teamMembers.push(newMember);
    this.saveDatabase();
    if (actor) {
      this.logAudit(actor.id, actor.name, 'admin', 'TEAM_MEMBER_ADDED', `Added team profile: ${newMember.fullName} (${newMember.specialization})`);
    }
    return newMember;
  }

  updateTeamMember(id: string, updates: Partial<TeamMember>, actor?: { id: string; name: string }): TeamMember | undefined {
    const member = this.getTeamMemberById(id);
    if (!member) return undefined;
    Object.assign(member, updates, { updatedAt: new Date().toISOString() });
    this.saveDatabase();
    if (actor) {
      this.logAudit(actor.id, actor.name, 'admin', 'TEAM_MEMBER_UPDATED', `Updated team profile: ${member.fullName}`);
    }
    return member;
  }

  deleteTeamMember(id: string, actor?: { id: string; name: string }): boolean {
    const initialLen = this.data.teamMembers.length;
    const member = this.getTeamMemberById(id);
    this.data.teamMembers = this.data.teamMembers.filter(m => m.id !== id);
    const deleted = this.data.teamMembers.length < initialLen;
    if (deleted) {
      this.saveDatabase();
      if (actor && member) {
        this.logAudit(actor.id, actor.name, 'admin', 'TEAM_MEMBER_DELETED', `Removed team profile: ${member.fullName}`);
      }
    }
    return deleted;
  }

  // Contact Messages & Admin Inquiries
  getContactMessages(): ContactMessage[] {
    if (!this.data.contactMessages) {
      this.data.contactMessages = [];
    }
    return [...this.data.contactMessages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  addContactMessage(data: { name: string; email: string; subject: string; message: string; ip?: string }): ContactMessage {
    if (!this.data.contactMessages) {
      this.data.contactMessages = [];
    }
    const newMsg: ContactMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      email: data.email.trim(),
      subject: data.subject.trim() || 'General Astrological Inquiry',
      message: data.message.trim(),
      status: 'NEW',
      autoEmailDispatched: false,
      dispatchedTo: '',
      createdAt: new Date().toISOString(),
      ip: data.ip
    };
    this.data.contactMessages.unshift(newMsg);
    this.saveDatabase();

    // Log receipt without copying the visitor's email/message into audit logs.
    this.logAudit('public_visitor', 'Website visitor', 'customer', 'CONTACT_MESSAGE_RECEIVED', `Inquiry ${newMsg.id} was saved to the admin inbox.`);

    return newMsg;
  }

  markContactMessageEmailDispatched(id: string, recipient: string): ContactMessage | undefined {
    if (!this.data.contactMessages) return undefined;
    const message = this.data.contactMessages.find(item => item.id === id);
    if (!message) return undefined;
    message.autoEmailDispatched = true;
    message.dispatchedTo = recipient;
    message.emailDispatchedAt = new Date().toISOString();
    this.saveDatabase();
    return message;
  }

  updateContactMessage(id: string, updates: Partial<ContactMessage>, actor?: { id: string; name: string }): ContactMessage | undefined {
    if (!this.data.contactMessages) return undefined;
    const msg = this.data.contactMessages.find(m => m.id === id);
    if (!msg) return undefined;
    Object.assign(msg, updates);
    this.saveDatabase();
    if (actor) {
      this.logAudit(actor.id, actor.name, 'admin', 'CONTACT_MESSAGE_UPDATED', `Admin updated inquiry ${id} status to ${msg.status}`);
    }
    return msg;
  }

  deleteContactMessage(id: string, actor?: { id: string; name: string }): boolean {
    if (!this.data.contactMessages) return false;
    const initialLen = this.data.contactMessages.length;
    this.data.contactMessages = this.data.contactMessages.filter(m => m.id !== id);
    const deleted = this.data.contactMessages.length < initialLen;
    if (deleted) {
      this.saveDatabase();
      if (actor) {
        this.logAudit(actor.id, actor.name, 'admin', 'CONTACT_MESSAGE_DELETED', `Deleted inquiry message ID: ${id}`);
      }
    }
    return deleted;
  }

  // Database Management: Export & Import
  exportDatabase(collection?: string) {
    if (collection && collection !== 'all') {
      if (collection === 'users') {
        // Exclude password hashes from export
        return this.data.users.map(({ passwordHash, ...u }) => u);
      }
      if (collection === 'birthProfiles') return this.data.birthProfiles;
      if (collection === 'teamMembers') return this.data.teamMembers;
      if (collection === 'orders') return this.data.orders;
      if (collection === 'settings') {
        return redactSettingsSecrets({ ...(this.data.settings as any) });
      }
      if (collection === 'auditLogs') return this.data.auditLogs;
      if (collection === 'contactMessages') return this.data.contactMessages || [];
    }

    // Return a backup without reusable payment/OAuth/mail/chat credentials.
    const safeSettings = redactSettingsSecrets({ ...(this.data.settings as any) });
    return {
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      system: 'ASTRO SIVAM Management System',
      users: this.data.users.map(({ passwordHash, ...u }) => u),
      birthProfiles: this.data.birthProfiles,
      settings: safeSettings,
      teamMembers: this.data.teamMembers,
      orders: this.data.orders,
      auditLogs: this.data.auditLogs,
      contactMessages: this.data.contactMessages || []
    };
  }

  importDatabase(
    importedData: any,
    options: { mode: 'merge' | 'replace'; collection?: string },
    actor: { id: string; name: string }
  ): { success: boolean; message: string; stats: { imported: number; updated: number; skipped: number } } {
    const mode = options.mode || 'merge';
    const collection = options.collection || 'all';
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      // If importing team members
      if ((collection === 'all' || collection === 'teamMembers') && Array.isArray(importedData.teamMembers || (Array.isArray(importedData) && collection === 'teamMembers' ? importedData : null))) {
        const members: TeamMember[] = importedData.teamMembers || importedData;
        if (mode === 'replace') {
          this.data.teamMembers = [];
        }
        members.forEach(m => {
          if (!m.fullName) {
            skippedCount++;
            return;
          }
          const existingIdx = this.data.teamMembers.findIndex(x => x.id === m.id || x.fullName.toLowerCase() === m.fullName.toLowerCase());
          if (existingIdx >= 0 && mode === 'merge') {
            this.data.teamMembers[existingIdx] = { ...this.data.teamMembers[existingIdx], ...m, updatedAt: new Date().toISOString() };
            updatedCount++;
          } else {
            this.data.teamMembers.push({
              id: m.id || `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              fullName: m.fullName,
              photoUrl: m.photoUrl || '',
              education: m.education || '',
              vedicEducation: m.vedicEducation || '',
              yearsOfExperience: Number(m.yearsOfExperience) || 10,
              biography: m.biography || '',
              specialization: m.specialization || 'Vedic Astrology',
              isActive: m.isActive !== undefined ? m.isActive : true,
              displayOrder: Number(m.displayOrder) || (this.data.teamMembers.length + 1),
              createdAt: m.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            importedCount++;
          }
        });
      }

      // If importing orders
      if ((collection === 'all' || collection === 'orders') && Array.isArray(importedData.orders || (Array.isArray(importedData) && collection === 'orders' ? importedData : null))) {
        const orderList: Order[] = importedData.orders || importedData;
        orderList.forEach(o => {
          if (!o.orderNumber && !o.id) {
            skippedCount++;
            return;
          }
          const existingIdx = this.data.orders.findIndex(x => x.id === o.id || x.orderNumber === o.orderNumber);
          if (existingIdx >= 0 && mode === 'merge') {
            this.data.orders[existingIdx] = { ...this.data.orders[existingIdx], ...o, updatedAt: new Date().toISOString() };
            updatedCount++;
          } else {
            this.data.orders.push({
              ...o,
              id: o.id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              createdAt: o.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            importedCount++;
          }
        });
      }

      this.saveDatabase();
      this.logAudit(
        actor.id,
        actor.name,
        'admin',
        'DATABASE_IMPORTED',
        `Imported database records in ${mode.toUpperCase()} mode (Collection: ${collection}). New: ${importedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`
      );

      return {
        success: true,
        message: `Database import completed successfully. Inserted: ${importedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`,
        stats: { imported: importedCount, updated: updatedCount, skipped: skippedCount }
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Import parsing failed',
        stats: { imported: importedCount, updated: updatedCount, skipped: skippedCount }
      };
    }
  }

  // Financial & Audit Reports (Date-Range & Breakdown)
  getFinancialReport(params?: { startDate?: string; endDate?: string; reportType?: string }) {
    const orders = this.data.orders;
    const start = params?.startDate ? new Date(params.startDate).getTime() : 0;
    const end = params?.endDate ? new Date(params.endDate).setHours(23, 59, 59, 999) : Infinity;

    const filtered = orders.filter(o => {
      const t = new Date(o.createdAt).getTime();
      return t >= start && t <= end;
    });

    let totalPaymentsCount = 0;
    let totalPaymentsAmountFJD = 0;
    let totalPaymentsAmountUSD = 0;
    let totalPaymentsAmountINR = 0;
    let pendingPaymentsCount = 0;
    let approvedPaymentsCount = 0;
    let rejectedPaymentsCount = 0;
    let totalRefundsCount = 0;
    let totalRefundsAmountFJD = 0;
    let totalRefundsAmountUSD = 0;
    let totalRefundsAmountINR = 0;
    let pendingRefundsCount = 0;
    let betaUsageCount = 0;

    const revenueByService: Record<string, { fjd: number; usd: number; inr: number; count: number }> = {
      BIRTH_JATHAGAM: { fjd: 0, usd: 0, inr: 0, count: 0 },
      MARRIAGE_COMPATIBILITY: { fjd: 0, usd: 0, inr: 0, count: 0 },
      BABY_NAMING: { fjd: 0, usd: 0, inr: 0, count: 0 },
      MUHURTHAM: { fjd: 0, usd: 0, inr: 0, count: 0 }
    };

    const revenueByPaymentMethod: Record<string, { fjd: number; usd: number; inr: number; count: number }> = {
      MPAISA: { fjd: 0, usd: 0, inr: 0, count: 0 },
      MYCASH: { fjd: 0, usd: 0, inr: 0, count: 0 },
      GPAY: { fjd: 0, usd: 0, inr: 0, count: 0 },
      UPI: { fjd: 0, usd: 0, inr: 0, count: 0 },
      PAYPAL: { fjd: 0, usd: 0, inr: 0, count: 0 },
      NONE: { fjd: 0, usd: 0, inr: 0, count: 0 }
    };

    filtered.forEach(o => {
      if (o.serviceMode === 'FREE_BETA') {
        betaUsageCount++;
      }

      if (o.status === 'PENDING_APPROVAL' || o.status === 'PENDING_PAYMENT_VERIFICATION') {
        pendingPaymentsCount++;
      } else if (o.status === 'APPROVED' || o.status === 'COMPLETED' || o.status === 'PROCESSING') {
        approvedPaymentsCount++;
        totalPaymentsCount++;
        if (o.currency === 'FJD') totalPaymentsAmountFJD += o.amount;
        if (o.currency === 'USD') totalPaymentsAmountUSD += o.amount;
        if (o.currency === 'INR') totalPaymentsAmountINR += o.amount;

        if (revenueByService[o.serviceType]) {
          revenueByService[o.serviceType].count++;
          if (o.currency === 'FJD') revenueByService[o.serviceType].fjd += o.amount;
          if (o.currency === 'USD') revenueByService[o.serviceType].usd += o.amount;
          if (o.currency === 'INR') revenueByService[o.serviceType].inr += o.amount;
        }

        const pm = (o.paymentMethod || 'NONE').toUpperCase();
        if (!revenueByPaymentMethod[pm]) {
          revenueByPaymentMethod[pm] = { fjd: 0, usd: 0, inr: 0, count: 0 };
        }
        revenueByPaymentMethod[pm].count++;
        if (o.currency === 'FJD') revenueByPaymentMethod[pm].fjd += o.amount;
        if (o.currency === 'USD') revenueByPaymentMethod[pm].usd += o.amount;
        if (o.currency === 'INR') revenueByPaymentMethod[pm].inr += o.amount;
      } else if (o.status === 'REJECTED') {
        rejectedPaymentsCount++;
      } else if (o.status === 'REFUNDED') {
        totalRefundsCount++;
        if (o.currency === 'FJD') totalRefundsAmountFJD += o.amount;
        if (o.currency === 'USD') totalRefundsAmountUSD += o.amount;
        if (o.currency === 'INR') totalRefundsAmountINR += o.amount;
      } else if (o.status === 'CANCELLED' || o.status === 'REFUND_REQUESTED') {
        pendingRefundsCount++;
      }
    });

    const netRevenueFJD = totalPaymentsAmountFJD - totalRefundsAmountFJD;
    const netRevenueUSD = totalPaymentsAmountUSD - totalRefundsAmountUSD;
    const netRevenueINR = totalPaymentsAmountINR - totalRefundsAmountINR;

    const gpayCount = (revenueByPaymentMethod.GPAY?.count || 0) + (revenueByPaymentMethod.UPI?.count || 0);
    const gpayAmountINR = (revenueByPaymentMethod.GPAY?.inr || 0) + (revenueByPaymentMethod.UPI?.inr || 0);
    const gpayAmountFJD = (revenueByPaymentMethod.GPAY?.fjd || 0) + (revenueByPaymentMethod.UPI?.fjd || 0);

    return {
      generatedAt: new Date().toISOString(),
      dateRange: { startDate: params?.startDate, endDate: params?.endDate },
      totalPaymentsCount,
      totalPaymentsAmountFJD,
      totalPaymentsAmountUSD,
      totalPaymentsAmountINR,
      grossRevenueFJD: totalPaymentsAmountFJD,
      grossRevenueUSD: totalPaymentsAmountUSD,
      grossRevenueINR: totalPaymentsAmountINR,
      pendingPaymentsCount,
      approvedPaymentsCount,
      rejectedPaymentsCount,
      totalRefundsCount,
      totalRefundsAmountFJD,
      totalRefundsAmountUSD,
      totalRefundsAmountINR,
      totalRefundsFJD: totalRefundsAmountFJD,
      totalRefundsUSD: totalRefundsAmountUSD,
      totalRefundsINR: totalRefundsAmountINR,
      refundsCount: totalRefundsCount,
      totalOrdersCount: filtered.length,
      paidOrdersCount: totalPaymentsCount,
      betaOrdersCount: betaUsageCount,
      pendingRefundsCount,
      netRevenueFJD,
      netRevenueUSD,
      netRevenueINR,
      revenueByService,
      revenueByPaymentMethod,
      byPaymentMethod: {
        MPAISA: { amount: revenueByPaymentMethod.MPAISA.fjd, count: revenueByPaymentMethod.MPAISA.count },
        MYCASH: { amount: revenueByPaymentMethod.MYCASH.fjd, count: revenueByPaymentMethod.MYCASH.count },
        GPAY: { amount: gpayAmountINR > 0 ? gpayAmountINR : gpayAmountFJD, inrAmount: gpayAmountINR, fjdAmount: gpayAmountFJD, count: gpayCount },
        UPI: { amount: revenueByPaymentMethod.UPI?.inr || 0, count: revenueByPaymentMethod.UPI?.count || 0 },
        PAYPAL: { amount: revenueByPaymentMethod.PAYPAL.usd, count: revenueByPaymentMethod.PAYPAL.count }
      },
      byServiceType: {
        BIRTH_JATHAGAM: { amount: revenueByService.BIRTH_JATHAGAM.fjd, count: revenueByService.BIRTH_JATHAGAM.count },
        MARRIAGE_COMPATIBILITY: { amount: revenueByService.MARRIAGE_COMPATIBILITY.fjd, count: revenueByService.MARRIAGE_COMPATIBILITY.count },
        BABY_NAMING: { amount: revenueByService.BABY_NAMING.fjd, count: revenueByService.BABY_NAMING.count },
        MUHURTHAM: { amount: revenueByService.MUHURTHAM.fjd, count: revenueByService.MUHURTHAM.count }
      },
      betaUsageCount,
      orders: filtered
    };
  }

  // ==========================================
  // BANNED IP & ANTI-FRAUD ENGINE
  // ==========================================
  getClientErrors() { return this.data.clientErrors || []; }
  addClientError(input: { message: string; endpoint: string; status?: number }) {
    if (!this.data.clientErrors) this.data.clientErrors = [];
    const now = Date.now();
    // Collapse identical recurring failures for 60 seconds to prevent alert floods.
    const recent = this.data.clientErrors.find(e => !e.resolvedAt && e.message === input.message && e.endpoint === input.endpoint && now - Date.parse(e.createdAt) < 60000);
    if (recent) return recent;
    const entry = { id: `err_${now}_${Math.random().toString(36).slice(2, 8)}`, ...input, message: String(input.message).slice(0, 500), endpoint: String(input.endpoint).slice(0, 250), createdAt: new Date().toISOString() };
    this.data.clientErrors.unshift(entry);
    this.data.clientErrors = this.data.clientErrors.slice(0, 200);
    this.saveDatabase(); return entry;
  }
  resolveClientError(id: string) {
    const error = this.getClientErrors().find(e => e.id === id);
    if (!error) return false;
    error.resolvedAt = new Date().toISOString(); this.saveDatabase(); return true;
  }

  getBannedIps(): BannedIpEntry[] {
    if (!this.data.bannedIps) {
      this.data.bannedIps = [];
    }
    return [...this.data.bannedIps];
  }

  isIpBanned(ip: string): boolean {
    if (!ip) return false;
    const cleanIp = ip.trim();
    const list = this.getBannedIps();
    return list.some(b => b.ipAddress === cleanIp || cleanIp.startsWith(b.ipAddress));
  }

  banIp(ipAddress: string, reason = 'Repeated fake orders / policy violation', bannedBy = 'Admin'): BannedIpEntry {
    if (!this.data.bannedIps) {
      this.data.bannedIps = [];
    }
    const cleanIp = ipAddress.trim();
    const existing = this.data.bannedIps.find(b => b.ipAddress === cleanIp);
    if (existing) {
      existing.reason = reason;
      existing.bannedBy = bannedBy;
      existing.bannedAt = new Date().toISOString();
      this.saveDatabase();
      return existing;
    }

    const entry: BannedIpEntry = {
      id: `ban_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ipAddress: cleanIp,
      reason,
      bannedBy,
      bannedAt: new Date().toISOString()
    };
    this.data.bannedIps.unshift(entry);
    this.saveDatabase();
    this.logAudit('sys', bannedBy, 'admin', 'IP_BANNED', `Blocked IP ${cleanIp}. Reason: ${reason}`);
    return entry;
  }

  unbanIp(ipAddress: string, unbannedBy = 'Admin'): boolean {
    if (!this.data.bannedIps) {
      this.data.bannedIps = [];
      return false;
    }
    const cleanIp = ipAddress.trim();
    const initialLen = this.data.bannedIps.length;
    this.data.bannedIps = this.data.bannedIps.filter(b => b.ipAddress !== cleanIp);
    const wasRemoved = this.data.bannedIps.length < initialLen;
    if (wasRemoved) {
      this.saveDatabase();
      this.logAudit('sys', unbannedBy, 'admin', 'IP_UNBANNED', `Unblocked IP ${cleanIp}`);
    }
    return wasRemoved;
  }

  /**
   * Number of outstanding, unverified checkout groups for one IP.
   *
   * A family bundle is one checkout even though it creates several order rows,
   * and provider-captured/no-charge orders must not block a customer from
   * placing another independently paid order while reports await approval.
   */
  countPendingOrdersByIp(ipAddress: string): number {
    if (!ipAddress) return 0;
    const cleanIp = ipAddress.trim();
    const pendingGroups = new Set<string>();

    for (const order of this.data.orders) {
      const isPending = order.status === 'PENDING_APPROVAL' ||
        order.status === 'PENDING_PAYMENT_VERIFICATION' ||
        (order.status as any) === 'PENDING';
      if (order.ipAddress !== cleanIp || !isPending) continue;

      const paymentStatus = String(order.paymentStatus || '').toUpperCase();
      if (['CAPTURED', 'VERIFIED_MANUAL', 'NOT_REQUIRED'].includes(paymentStatus)) continue;

      const groupId = String(order.groupId || '').trim();
      pendingGroups.add(groupId ? `group:${groupId}` : `order:${order.id}`);
    }

    return pendingGroups.size;
  }

  isPaymentReferenceDuplicate(paymentReference?: string, currentOrderId?: string): boolean {
    if (!paymentReference) return false;
    const cleanRef = paymentReference.trim().toLowerCase();
    if (!cleanRef) return false;
    return this.data.orders.some(o => {
      if (currentOrderId && o.id === currentOrderId) return false;
      if (o.status === 'CANCELLED' || o.status === 'REJECTED') return false;
      return o.paymentReference && o.paymentReference.trim().toLowerCase() === cleanRef;
    });
  }
}

export const db = new DataStore();
