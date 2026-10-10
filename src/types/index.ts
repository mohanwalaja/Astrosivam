export type AppLanguage = 'ta' | 'en' | 'hi';

export enum Rasi {
  MESHAM = 1,
  RISHABAM = 2,
  MITHUNAM = 3,
  KADAGAM = 4,
  SIMHAM = 5,
  KANNI = 6,
  THULAM = 7,
  VIRUCHIGAM = 8,
  DHANUSU = 9,
  MAGARAM = 10,
  KUMBAM = 11,
  MEENAM = 12
}

export enum Graha {
  SURYA = 'sun',
  CHANDRA = 'moon',
  CHEVVAI = 'mars',
  BUDHA = 'mercury',
  GURU = 'jupiter',
  SUKRA = 'venus',
  SANI = 'saturn',
  RAHU = 'rahu',
  KETU = 'ketu'
}

export interface PlanetPosition {
  graha?: Graha;
  planetKey?: string;
  nameTa: string;
  nameEn: string;
  nameHi: string;
  shortTa?: string;
  shortEn?: string;
  shortHi?: string;
  rasi?: Rasi;
  rasiNumber?: number;
  rasiNameTa?: string;
  rasiNameEn?: string;
  longitudeInRasiDeg?: number;
  degrees?: number;
  formattedDeg?: string;
  nakshatraNameEn?: string;
  nakshatraNameTa?: string;
  nakshatraNameHi?: string;
  pada?: number;
  isRetrograde?: boolean;
}

export type UserRole = 'customer' | 'admin';
export type ServiceType = 'BIRTH_JATHAGAM' | 'MARRIAGE_COMPATIBILITY' | 'BABY_NAMING' | 'MUHURTHAM';
/**
 * `MULTI_PERSON` is the header of a multi-person order (one order = up to 6
 * people, each with one or more of the services above). It is never a chart:
 * the charts live in `Order.items`.
 */
export type OrderServiceType = ServiceType | 'MULTI_PERSON';
export type ServiceMode = 'FREE_BETA' | 'PAID';
export type OrderStatus =
  | 'PENDING_APPROVAL'
  | 'PENDING_PAYMENT_VERIFICATION'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'PENDING'
  | 'GENERATED'
  | 'CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED';
export type EmailStatus = 'NOT_SENT' | 'PROCESSING' | 'SENT' | 'FAILED';
export type PaymentMethod = 'NONE' | 'MPAISA' | 'MYCASH' | 'PAYPAL' | 'GPAY' | 'UPI' | 'CARD';

/**
 * Each of the 3 payment systems (India GPay, International PayPal, Fiji Vodafone
 * M-PAiSA) can run in either:
 *  - 'offline': customer pays via manual transfer/QR/app and submits the
 *    Transaction Reference / Receipt ID for admin verification.
 *  - 'online': customer completes instant automated checkout via the online
 *    payment gateway API, which issues a verified transaction reference.
 * Both configurations are stored simultaneously so the admin can switch modes
 * at any time in the Admin Panel.
 */
export type PaymentGatewayMode = 'offline' | 'online';

export type IndiaGpayOnlineProvider = 'razorpay' | 'cashfree' | 'phonepe' | 'upi_intent';

export interface OnlinePaymentSession {
  sessionId: string;
  paymentIntentId?: string;
  paymentMethod: PaymentMethod;
  mode: PaymentGatewayMode;
  provider: string;
  environment: 'sandbox' | 'live';
  amount: number;
  currency: CurrencyCode;
  gatewayOrderId: string;
  description?: string;
  merchantName?: string;
  // India GPay / Razorpay / UPI Online
  keyId?: string;
  merchantId?: string;
  upiId?: string;
  upiUri?: string;
  // International PayPal Online
  clientId?: string;
  paypalEmail?: string;
  businessName?: string;
  approvalUrl?: string;
  // Fiji Vodafone M-PAiSA Online
  mpaisaNumber?: string;
  mpaisaName?: string;
  mpaisaMerchantCode?: string;
  checkoutUrl?: string;
}

/**
 * Settlement currencies supported by ASTRO SIVAM.
 * The currency of a charge is decided by the PAYMENT METHOD the customer
 * chooses (M-PAiSA -> FJD, GPay/UPI -> INR, PayPal/Card -> USD) and never by
 * the birth place of a family member.
 */
export type CurrencyCode = 'INR' | 'FJD' | 'USD';

/** A price expressed in all three currencies at once. */
export type CurrencyPriceMap = Record<CurrencyCode, number>;

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  country: string;
  createdAt?: string;
  lastLoginAt?: string;
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

export type BirthProfile = CustomerBirthProfile;

export interface EmailConfig {
  senderName: string;
  senderEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword?: string;
  /** Admin API boolean: secret exists without returning the secret to the client. */
  smtpPasswordConfigured?: boolean;
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
    accessTokenConfigured?: boolean;
    webhookUrlConfigured?: boolean;
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
    authTokenConfigured?: boolean;
    webhookUrlConfigured?: boolean;
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

export interface ServicePriceItem {
  fjd: number;
  usd: number;
  inr: number;
}

export interface SystemSettings {
  serviceMode: ServiceMode;
  /**
   * FREE BETA: the PHP API also exposes this flag alongside serviceMode.
   */
  freeBetaActive?: boolean;
  /**
   * FREE BETA RULE — 1 free report per customer, tracked per IP address.
   * `true`  = this customer's free chart is still unused (first chart free),
   * `false` = already used / not in beta (every chart is charged).
   * Served per requesting IP by GET /api/services/settings.
   */
  betaFreeChartAvailable?: boolean;
  fijiPriceFJD: number;
  intlPriceUSD: number;
  indiaPriceINR?: number;
  // 3. Fiji Vodafone M-PAiSA (Offline & Online)
  vodafoneMPaisaActive?: boolean;
  vodafoneMPaisaPaymentMode?: PaymentGatewayMode;
  // Offline settings
  vodafoneMPaisaNumber: string;
  vodafoneMPaisaName?: string;
  vodafoneMPaisaMerchantCode?: string;
  vodafoneMPaisaQrUrl?: string;
  vodafoneMPaisaInstructions?: string;
  // Online settings (Vodafone Fiji M-PAiSA E-Commerce API)
  vodafoneMPaisaMerchantId?: string;
  vodafoneMPaisaApiSecret?: string;
  vodafoneMPaisaApiSecretConfigured?: boolean;
  vodafoneMPaisaApiUrl?: string;
  vodafoneMPaisaEnvironment?: 'sandbox' | 'live';
  vodafoneMPaisaOnlineConfigured?: boolean;
  // MyCash
  digicelMyCashActive?: boolean;
  digicelMyCashNumber: string;
  digicelMyCashName?: string;
  digicelMyCashInstructions?: string;
  // 1. India Google Pay (GPay) & UPI (Offline & Online)
  indiaGpayActive?: boolean;
  indiaGpayPaymentMode?: PaymentGatewayMode;
  // Offline settings
  indiaGpayUpiId?: string;
  indiaGpayNumber?: string;
  indiaGpayName?: string;
  indiaGpayQrUrl?: string;
  indiaGpayInstructions?: string;
  // Online settings (Razorpay / Cashfree / PhonePe / UPI Intent)
  indiaGpayOnlineProvider?: IndiaGpayOnlineProvider;
  indiaGpayMerchantId?: string;
  indiaGpayKeyId?: string;
  indiaGpayKeySecret?: string;
  indiaGpayKeySecretConfigured?: boolean;
  indiaGpayWebhookSecret?: string;
  indiaGpayWebhookSecretConfigured?: boolean;
  indiaGpayEnvironment?: 'sandbox' | 'live';
  indiaGpayOnlineConfigured?: boolean;
  // 2. International PayPal (Offline & Online)
  paypalActive?: boolean;
  paypalPaymentMode?: PaymentGatewayMode;
  // Offline settings
  paypalEmail: string;
  paypalBusinessName?: string;
  paypalMeLink?: string;
  paypalInstructions?: string;
  // Online settings (PayPal REST API v2)
  paypalClientId?: string;
  paypalSecret?: string;
  paypalSecretConfigured?: boolean;
  paypalClientSecret?: string;
  paypalClientSecretConfigured?: boolean;
  paypalWebhookId?: string;
  paypalMode?: 'sandbox' | 'live';
  paypalOnlineConfigured?: boolean;
  // Legacy / convenience currency fields
  currencyFiji?: string;
  currencyIntl?: string;
  currencyIndia?: string;
  // Per-Service Pricing Override (Separate pricing for each service)
  servicePricing?: {
    BIRTH_JATHAGAM?: ServicePriceItem;
    MARRIAGE_COMPATIBILITY?: ServicePriceItem;
    BABY_NAMING?: ServicePriceItem;
    MUHURTHAM?: ServicePriceItem;
  };
  // Facebook Login Integration
  facebookLoginEnabled?: boolean;
  facebookAppId?: string;
  facebookAppSecret?: string;
  facebookAppSecretConfigured?: boolean;
  // Google Login Integration
  googleLoginEnabled?: boolean;
  googleClientId?: string;
  // Web Design Theme Template (South Indian Styles)
  activeThemeTemplate?: ThemeTemplateId;
  // General & Email
  supportEmail: string;
  supportPhone: string;
  enableEmailNotifications?: boolean;
  autoEmailReports?: boolean;
  betaNoticeMessage: string;
  emailSettings?: EmailConfig;
  emailTemplates?: Record<string, EmailTemplate>;
  chatAlertSettings?: ChatAlertConfig;
}

export type AppSettings = SystemSettings;

export interface TeamMember {
  id: string;
  nameEn?: string;
  nameTa?: string;
  nameHi?: string;
  titleEn?: string;
  titleTa?: string;
  fullName?: string;
  photoUrl: string;
  education?: string;
  educationEn?: string;
  educationTa?: string;
  vedicEducation?: string;
  experienceYears?: number;
  yearsOfExperience?: number;
  biography?: string;
  bioEn?: string;
  bioTa?: string;
  specialization?: string;
  specializations?: string[];
  isActive: boolean;
  order?: number;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id: string;
  serviceType: ServiceType;
  language: AppLanguage;
  devoteeName: string;
  summaryText: string;
  country: string;
  inputPayload: Record<string, any>;
  calculatedResult?: any;
  /**
   * Price of THIS chart in every currency, captured when the chart was added.
   * The tray/checkout always prices the whole family in the ONE currency the
   * customer pays with, so `country` (birth place) never changes the currency.
   */
  prices?: CurrencyPriceMap;
  /** @deprecated legacy single-currency price, kept for old saved carts */
  unitPrice: number;
  /** @deprecated currency implied by birth place — no longer used for totals */
  currency: 'FJD' | 'USD' | 'INR';
  saveAsProfile?: boolean;
}

export interface MultiOrderPayload {
  items: Array<{
    serviceType: ServiceType;
    language: AppLanguage;
    country: string;
    inputPayload: Record<string, any>;
    saveAsProfile?: boolean;
  }>;
  language?: AppLanguage;
  country?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  /** Currency the customer chose to pay in (derived from paymentMethod). */
  currency?: CurrencyCode;
  /** Total shown to the customer, for the server-side sanity check. */
  totalAmount?: number;
}

/**
 * One person of a multi-person order (row of `order_persons`). Legacy orders
 * carry exactly one person with seq 1 (backfilled by migration 003).
 */
export interface OrderPerson {
  id?: number;
  seq: number;
  fullName: string;
  gender: 'M' | 'F' | 'O' | string;
  dob: string;
  tob: string;
  place: string;
  country?: string;
  lat?: number | null;
  lon?: number | null;
  tz?: number | null;
}

export type OrderItemReportStatus = 'PENDING' | 'CALCULATED' | 'SENT' | 'FAILED';

/**
 * One report of a multi-person order (row of `order_items`): a service bought
 * for one person, with its own price, language, payload and cached result.
 * `calculatedResult` is the ONE cache Preview and Send both read.
 */
export interface OrderItem {
  id: number;
  orderId: string;
  personId?: number;
  personSeq?: number;
  personName?: string;
  serviceCode: OrderServiceType;
  unitPrice: number;
  reportStatus: OrderItemReportStatus;
  language: AppLanguage;
  inputPayload: Record<string, any>;
  calculatedResult?: any;
  sentAt?: string | null;
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
  currency: CurrencyCode;
  amount: number;
  serviceMode: ServiceMode;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  paymentIntentId?: string;
  paymentStatus?: 'NOT_REQUIRED' | 'CREATED' | 'CAPTURED' | 'PENDING_MANUAL' | 'PENDING_ADMIN' | 'VERIFIED_MANUAL' | 'FAILED' | 'CONSUMED' | 'EXPIRED';
  status: OrderStatus;
  emailStatus: EmailStatus;
  emailDeliveryAttempts: number;
  emailSentAt?: string;
  emailLastStatusMessage?: string;
  inputPayload: Record<string, any>;
  calculatedResult?: any;
  hasPdf: boolean;
  hasInvoice?: boolean;
  adminNotes?: string;
  refundStatus?: 'NONE' | 'REQUESTED' | 'REFUNDED' | 'REJECTED';
  refundReason?: string;
  refundRequestedAt?: string;
  refundProcessedAt?: string;
  refundAdminNotes?: string;
  ipAddress?: string;
  isIpBanned?: boolean;
  groupId?: string;
  groupOrderIndex?: number;
  groupOrderCount?: number;
  /** People of this order (multi-person checkout; legacy orders have one). */
  persons?: OrderPerson[];
  /** Reports of this order - one row per person + service. */
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BannedIpEntry {
  id: string;
  ipAddress: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: CurrencyCode;
  paymentMethod: PaymentMethod;
  reason: string;
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  requestedAt: string;
  processedAt?: string;
  adminNotes?: string;
}

export interface FinancialSummaryReport {
  generatedAt: string;
  dateRange: { startDate?: string; endDate?: string };
  totalPaymentsCount: number;
  totalPaymentsAmountFJD: number;
  totalPaymentsAmountUSD: number;
  totalPaymentsAmountINR?: number;
  grossRevenueFJD: number;
  grossRevenueUSD: number;
  grossRevenueINR?: number;
  pendingPaymentsCount: number;
  approvedPaymentsCount: number;
  rejectedPaymentsCount: number;
  totalRefundsCount: number;
  totalRefundsAmountFJD: number;
  totalRefundsAmountUSD: number;
  totalRefundsAmountINR?: number;
  totalRefundsFJD: number;
  totalRefundsUSD?: number;
  totalRefundsINR?: number;
  refundsCount: number;
  totalOrdersCount: number;
  paidOrdersCount: number;
  betaOrdersCount: number;
  pendingRefundsCount: number;
  netRevenueFJD: number;
  netRevenueUSD: number;
  netRevenueINR?: number;
  revenueByService: Record<string, { fjd: number; usd: number; inr?: number; count: number }>;
  revenueByPaymentMethod: Record<string, { fjd: number; usd: number; inr?: number; count: number }>;
  byPaymentMethod: {
    MPAISA: { amount: number; count: number };
    MYCASH: { amount: number; count: number };
    GPAY: { amount: number; inrAmount?: number; fjdAmount?: number; count: number };
    UPI?: { amount: number; count: number };
    PAYPAL: { amount: number; count: number };
  };
  byServiceType: {
    BIRTH_JATHAGAM: { amount: number; count: number };
    MARRIAGE_COMPATIBILITY: { amount: number; count: number };
    BABY_NAMING: { amount: number; count: number };
    MUHURTHAM: { amount: number; count: number };
  };
  betaUsageCount: number;
  orders: Order[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details: string;
}

/** One customer complaint / "talk to our astrologer" escalation from the AI chat queue. */
export interface AiChatHandoff {
  id: number;
  session_id: string | null;
  user_id: string;
  user_name: string;
  user_email: string | null;
  user_mobile: string | null;
  language: string;
  question: string;
  reason: string;
  order_number: string | null;
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Statistics {
  totalOrders: number;
  completedOrders: number;
  pendingApproval: number;
  pendingOrders?: number;
  rejectedOrders: number;
  totalRevenueFJD: number;
  totalRevenueUSD: number;
  serviceCounts: Record<string, number>;
  languageCounts: Record<string, number>;
  countryCounts: Record<string, number>;
  totalUsers: number;
  currentServiceMode: ServiceMode;
}

export type AdminStats = Statistics;

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

export interface MonthlyUserStat {
  month: string;
  activeUsers: number;
  newSignups: number;
  ordersPlaced: number;
}

export interface PopularServiceStat {
  serviceType: string;
  name: string;
  count: number;
  percentage: number;
  revenueFJD: number;
  revenueUSD: number;
  avgRating: number;
}

export interface RevenueTimelineStat {
  period: string;
  fjd: number;
  usd: number;
  totalOrders: number;
  avgOrderFJD: number;
  avgOrderUSD: number;
}

export interface ProcessingTimeStat {
  avgMinutes: number;
  medianMinutes: number;
  fastestMinutes: number;
  sla12hCompliancePercent: number;
  byService: Record<string, number>;
  distribution: Array<{ range: string; count: number; percentage: number }>;
}

export interface EmailDeliveryStat {
  totalAttempted: number;
  sent: number;
  failed: number;
  pending: number;
  successRate: number;
  avgDeliveryLatencySec: number;
  recentLogs: Array<{
    id: string;
    orderNumber: string;
    recipient: string;
    serviceType: string;
    status: 'SENT' | 'FAILED' | 'PENDING';
    timestamp: string;
    attempts: number;
    latencySec: number;
  }>;
}

export interface AdminAnalyticsData {
  timeframe: string;
  generatedAt: string;
  kpis: {
    monthlyActiveUsers: number;
    mauGrowthPercent: number;
    totalRevenueFJD: number;
    totalRevenueUSD: number;
    revenueGrowthPercent: number;
    avgProcessingMinutes: number;
    emailDeliveryRate: number;
    totalCompletedOrders: number;
    slaComplianceRate: number;
    totalRegisteredUsers: number;
  };
  monthlyActiveUsersTrend: MonthlyUserStat[];
  popularServices: PopularServiceStat[];
  revenueOverTime: RevenueTimelineStat[];
  processingTimeMetrics: ProcessingTimeStat;
  emailDeliveryMetrics: EmailDeliveryStat;
  geographicBreakdown: Array<{
    region: string;
    orderCount: number;
    percentage: number;
    revenueFJD: number;
    revenueUSD: number;
  }>;
}
export type ThemeTemplateId = 'classic-primary';

export interface ThemeTemplateConfig {
  id: ThemeTemplateId;
  modelNumber: number;
  modelName: string;
  name: string;
  subtitle: string;
  badge: string;
  isPrimary?: boolean;
  tagline: string;
  description: string;
  culturalOrigin: string;
  highlightPills: string[];
  layoutVariant: 'standard';
  heroLayoutVariant: 'split-modern';
  fontPairing: {
    display: string;
    body: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    bgPageLight: string;
    bgPageDark: string;
    cardBgLight: string;
    cardBgDark: string;
    borderColorLight: string;
    borderColorDark: string;
    goldShimmer: string;
    textHeadingLight: string;
    textHeadingDark: string;
  };
  attributes: {
    mandapamArch: boolean;
    kolamPattern: boolean;
    brassDiyaGlow: boolean;
    zariSilkBorder: boolean;
    astralRings: boolean;
    palmLeafTexture: boolean;
    waxSealEmblem: boolean;
    hudTelemetry: boolean;
    cardCornerStyle: string;
    cardSurfaceClass: string;
    buttonGradient: string;
    bannerGradient: string;
    sectionDividerStyle: string;
  };
}
