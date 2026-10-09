import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Eye,
  RefreshCw,
  Search,
  Settings,
  Users,
  FileText,
  Lock,
  Plus,
  Trash2,
  Edit2,
  UserCheck,
  GraduationCap,
  Award,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Mail,
  MessageSquare,
  Send,
  DollarSign,
  CreditCard,
  Database,
  ShieldCheck,
  RotateCcw,
  Activity,
  Check,
  X,
  Smartphone,
  Globe,
  Zap,
  TrendingUp,
  BarChart3,
  Receipt,
  Crown,
  ShieldAlert,
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronUp,
  Layers,
  Package,
  Copy,
  Calendar,
  MapPin,
  Palette
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { describeFamilyRenderQuality } from '../services/formatUtils';
// The simplified Surya + Chandra mark stays legible at avatar sizes; the full
// 12-rasi emblem is used for the large brand moments (Navbar / Login / Footer).
import logoImg from '../assets/astrosivam_appicon.png';
import { Order, OrderItem, AppSettings, AdminStats, TeamMember, ContactMessage, BannedIpEntry } from '../types';
import { OrderReportModal } from '../components/common/OrderReportModal';
import { LivePdfPreviewModal } from '../components/common/LivePdfPreviewModal';
import { AdminLogin } from '../components/admin/AdminLogin';
import {
  exportOrderPdf,
  exportOrderInvoicePdf,
  generateOrderPdfsBase64,
  exportFamilyInvoiceHtmlToPdf,
  prepareFamilyFulfilPayload,
  deliverOrderPdfPayload,
  FamilyRenderProgress,
  FamilyStagingResult,
  downloadHtmlPdf,
  orderInvoiceFileName
} from '../services/jathagamPdfExporter';
import {
  buildOrderInvoiceHtmlForItems,
  getOrCalculateResult,
  orderItemAsOrder,
  prepareOrderItemPdfs,
  prepareOrderItemsSendPayload
} from '../services/orderItems';
import { orderChartServiceType } from '../services/multiPersonOrder';
import { FinancialDashboard } from '../components/admin/FinancialDashboard';
import { AdminAnalyticsDashboard } from '../components/admin/AdminAnalyticsDashboard';
import { PaymentConfigPanel } from '../components/admin/PaymentConfigPanel';
import { EmailConfigPanel } from '../components/admin/EmailConfigPanel';
import { ChatAlertConfigPanel } from '../components/admin/ChatAlertConfigPanel';
import { DatabaseBackupPanel } from '../components/admin/DatabaseBackupPanel';
import { SetupChecklistPanel } from '../components/admin/SetupChecklistPanel';
import { GoogleSetupPanel } from '../components/admin/GoogleSetupPanel';
import { SecurityBannedIpPanel } from '../components/admin/SecurityBannedIpPanel';
import { SEO } from '../components/common/SEO';

interface AdminPortalProps {
  onNavigate: (route: string) => void;
}

function describeEmailParts(response: any): string {
  const count = Math.max(1, Math.floor(Number(response?.emailPartCount) || 1));
  return count === 1 ? 'one email' : `${count} emails`;
}

const SERVICE_DISPLAY: Record<string, string> = {
  BIRTH_JATHAGAM: '🪐 Janma Jathagam',
  MARRIAGE_COMPATIBILITY: '💍 Marriage Compatibility',
  BABY_NAMING: '👶 Baby Naming',
  MUHURTHAM: '📅 Subha Muhurtham',
  MULTI_PERSON: '👪 Multi-Person Order'
};

const serviceDisplayName = (service?: string) => SERVICE_DISPLAY[service || ''] || service || 'Report';

/** Per-report fulfilment badge for multi-person orders. */
function getItemStatusBadge(status?: string) {
  const s = (status || 'PENDING').toUpperCase();
  const cls =
    s === 'SENT'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : s === 'FAILED'
      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
      : s === 'CALCULATED'
      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
  return <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${cls}`}>{s}</span>;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onNavigate }) => {
  const { user, isAdmin, isLoading: isAuthLoading, settings: authSettings, refreshSettings } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(authSettings);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [messagesList, setMessagesList] = useState<ContactMessage[]>([]);
  const [bannedIps, setBannedIps] = useState<BannedIpEntry[]>([]);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<any[]>([]);

  const handleCopyIp = (ip: string) => {
    if (!ip) return;
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});
  const toggleGroupExpand = (groupId: string) =>
    setExpandedGroupIds(prev => ({ ...prev, [groupId]: !prev[groupId] }));

  const [activeSection, setActiveSection] = useState<
    'orders' | 'analytics' | 'financial' | 'payments' | 'emails' | 'alerts' | 'database' | 'checklist' | 'messages' | 'team' | 'settings' | 'users' | 'logs' | 'google' | 'security' | 'errors'
  >('orders');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
  const startProcessing = (id: string) => setProcessingIds(prev => ({ ...prev, [id]: true }));
  const stopProcessing = (id: string) => setProcessingIds(prev => {
    const next = { ...prev };
    delete next[id];
    return next;
  });
  const isProcessing = (id: string) => !!processingIds[id];

  /**
   * Live progress of the family (group order) render pipeline. Every member
   * report is rendered one at a time in the browser at live-preview quality
   * (~2 MB, ~8 s each) and uploaded before the next one starts - exactly like
   * the single-order flow - so the operator can see which user is being
   * rendered instead of staring at a frozen button.
   */
  const [familyRenderProgress, setFamilyRenderProgress] = useState<{
    groupId: string;
    phase: FamilyRenderProgress['phase'];
    index: number;
    total: number;
    memberName: string;
    orderNumber: string;
    message: string;
    bytes?: number;
  } | null>(null);

  const [batchProgress, setBatchProgress] = useState<{
    total: number;
    current: number;
    currentOrderNum: string;
    successCount: number;
    failCount: number;
    isProcessing: boolean;
  } | null>(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Setting edit state
  const [serviceMode, setServiceMode] = useState<'FREE_BETA' | 'PAID'>(authSettings?.serviceMode || 'FREE_BETA');
  const [fijiPrice, setFijiPrice] = useState(authSettings?.fijiPriceFJD || 10);
  const [intlPrice, setIntlPrice] = useState(authSettings?.intlPriceUSD || 5);
  const [indiaPrice, setIndiaPrice] = useState(authSettings?.indiaPriceINR || 499);
  const [servicePricing, setServicePricing] = useState({
    BIRTH_JATHAGAM: {
      fjd: authSettings?.servicePricing?.BIRTH_JATHAGAM?.fjd ?? 35,
      usd: authSettings?.servicePricing?.BIRTH_JATHAGAM?.usd ?? 18,
      inr: authSettings?.servicePricing?.BIRTH_JATHAGAM?.inr ?? 499
    },
    MARRIAGE_COMPATIBILITY: {
      fjd: authSettings?.servicePricing?.MARRIAGE_COMPATIBILITY?.fjd ?? 45,
      usd: authSettings?.servicePricing?.MARRIAGE_COMPATIBILITY?.usd ?? 22,
      inr: authSettings?.servicePricing?.MARRIAGE_COMPATIBILITY?.inr ?? 699
    },
    BABY_NAMING: {
      fjd: authSettings?.servicePricing?.BABY_NAMING?.fjd ?? 30,
      usd: authSettings?.servicePricing?.BABY_NAMING?.usd ?? 15,
      inr: authSettings?.servicePricing?.BABY_NAMING?.inr ?? 399
    },
    MUHURTHAM: {
      fjd: authSettings?.servicePricing?.MUHURTHAM?.fjd ?? 40,
      usd: authSettings?.servicePricing?.MUHURTHAM?.usd ?? 20,
      inr: authSettings?.servicePricing?.MUHURTHAM?.inr ?? 599
    }
  });
  const [autoEmail, setAutoEmail] = useState(authSettings?.autoEmailReports ?? true);

  // Modal inspection
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [previewOrderForPdf, setPreviewOrderForPdf] = useState<Order | null>(null);
  const [isPreviewPdfLoading, setIsPreviewPdfLoading] = useState(false);
  const [familyInvoicePreview, setFamilyInvoicePreview] = useState<{ orders: Order[]; groupId: string } | null>(null);
  // MULTI-PERSON ORDERS: one row per order, expanding to people + their reports.
  const [expandedItemOrderIds, setExpandedItemOrderIds] = useState<Record<string, boolean>>({});
  const [reportItemView, setReportItemView] = useState<{ header: Order; item: OrderItem; chartOrder: Order } | null>(null);
  const [itemSendProgress, setItemSendProgress] = useState('');

  // Team Member Form Modal State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberFormData, setMemberFormData] = useState({
    nameEn: '',
    nameTa: '',
    nameHi: '',
    titleEn: '',
    titleTa: '',
    photoUrl: '',
    educationEn: '',
    educationTa: '',
    experienceYears: 15,
    specializations: 'Birth Jathagam, Navagraha Doshas, Matrimonial Poruthams',
    bioEn: '',
    bioTa: '',
    isActive: true,
    order: 1
  });

  const fetchAdminData = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [statsRes, ordersRes, settingsRes, usersRes, logsRes, teamRes, msgsRes, bannedRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminOrders(),
        api.getAdminSettings(),
        api.getAdminUsers(),
        api.getAdminAuditLogs(),
        api.getAdminTeamMembers(),
        api.getAdminMessages(),
        api.getAdminBannedIps()
      ]);

      if (statsRes.success && statsRes.stats) setStats(statsRes.stats);
      // Defensive: API may return a non-array value for lists. Force arrays to
      // prevent .filter/.map/.length crashes during render after a page reload.
      if (ordersRes.success && ordersRes.orders) setOrders(Array.isArray(ordersRes.orders) ? ordersRes.orders : []);
      if (settingsRes.success && settingsRes.settings) {
        setSettings(settingsRes.settings);
        setServiceMode(settingsRes.settings.serviceMode);
        setFijiPrice(settingsRes.settings.fijiPriceFJD);
        setIntlPrice(settingsRes.settings.intlPriceUSD);
        if (settingsRes.settings.indiaPriceINR) {
          setIndiaPrice(settingsRes.settings.indiaPriceINR);
        }
        if (settingsRes.settings.servicePricing) {
          setServicePricing({
            BIRTH_JATHAGAM: {
              fjd: settingsRes.settings.servicePricing.BIRTH_JATHAGAM?.fjd ?? 35,
              usd: settingsRes.settings.servicePricing.BIRTH_JATHAGAM?.usd ?? 18,
              inr: settingsRes.settings.servicePricing.BIRTH_JATHAGAM?.inr ?? 499
            },
            MARRIAGE_COMPATIBILITY: {
              fjd: settingsRes.settings.servicePricing.MARRIAGE_COMPATIBILITY?.fjd ?? 45,
              usd: settingsRes.settings.servicePricing.MARRIAGE_COMPATIBILITY?.usd ?? 22,
              inr: settingsRes.settings.servicePricing.MARRIAGE_COMPATIBILITY?.inr ?? 699
            },
            BABY_NAMING: {
              fjd: settingsRes.settings.servicePricing.BABY_NAMING?.fjd ?? 30,
              usd: settingsRes.settings.servicePricing.BABY_NAMING?.usd ?? 15,
              inr: settingsRes.settings.servicePricing.BABY_NAMING?.inr ?? 399
            },
            MUHURTHAM: {
              fjd: settingsRes.settings.servicePricing.MUHURTHAM?.fjd ?? 40,
              usd: settingsRes.settings.servicePricing.MUHURTHAM?.usd ?? 20,
              inr: settingsRes.settings.servicePricing.MUHURTHAM?.inr ?? 599
            }
          });
        }
        setAutoEmail(settingsRes.settings.autoEmailReports);
      }
      if (usersRes.success && usersRes.users) setUsersList(Array.isArray(usersRes.users) ? usersRes.users : []);
      if (logsRes.success && logsRes.logs) setAuditLogs(Array.isArray(logsRes.logs) ? logsRes.logs : []);
      if (teamRes.success && teamRes.team) setTeamMembers(Array.isArray(teamRes.team) ? teamRes.team : []);
      if (msgsRes.success && msgsRes.messages) setMessagesList(Array.isArray(msgsRes.messages) ? msgsRes.messages : []);
      if (bannedRes.success && bannedRes.bannedIps) setBannedIps(Array.isArray(bannedRes.bannedIps) ? bannedRes.bannedIps : []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch admin data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const handleApproveOrder = async (orderId: string) => {
    startProcessing(orderId);
    setErrorMessage('');
    try {
      const order = orders.find(candidate => candidate.id === orderId);
      if (!order) throw new Error('The order is no longer available. Refresh the admin list and retry.');

      let res;
      if (order.groupId) {
        const groupOrders = orders.filter(candidate => candidate.groupId === order.groupId);
        const prepared = await prepareFamilyFulfilPayload(groupOrders, order.groupId);
        res = await api.approveFamilyOrder(order.groupId, prepared.payload);
      } else {
        const pdfs = await generateOrderPdfsBase64(order, order.language || 'ta');
        const payload = await deliverOrderPdfPayload(order, {
          ...pdfs,
          language: order.language || 'ta'
        });
        res = await api.approveOrder(orderId, payload);
      }

      if (res.success) {
        setSuccessMessage(order.groupId
          ? `Family group approved; all preview-quality reports and the consolidated invoice were delivered in ${describeEmailParts(res)}.`
          : `Order ${res.order?.orderNumber || orderId} approved and emailed with preview-quality PDFs.`);
        setOrders(prev => prev.map(o => o.id === orderId || (order.groupId && o.groupId === order.groupId)
          ? { ...o, status: 'COMPLETED', emailStatus: 'SENT' }
          : o));
        setTimeout(() => setSuccessMessage(''), 5000);
        fetchAdminData();
      } else {
        setErrorMessage(res.message || 'Approval failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Approval failed; no email was sent.');
    } finally {
      stopProcessing(orderId);
    }
  };

  const handlePreviewOrderPdf = async (order: Order) => {
    setErrorMessage('');
    if (order.calculatedResult) {
      setPreviewOrderForPdf(order);
      return;
    }

    // If pending, calculate on the fly so admin can preview the exact result before approving
    setIsPreviewPdfLoading(true);
    startProcessing(order.id);
    try {
      const res = await api.calculateService(orderChartServiceType(order), order.inputPayload);
      if (res.success && res.result) {
        const simulatedOrder: Order = {
          ...order,
          calculatedResult: res.result
        };
        setPreviewOrderForPdf(simulatedOrder);
      } else {
        setErrorMessage(res.message || 'Failed to calculate astrology result for preview');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error generating preview');
    } finally {
      setIsPreviewPdfLoading(false);
      stopProcessing(order.id);
    }
  };

  /**
   * MULTI-PERSON ORDERS ------------------------------------------------------
   * One `orders` row now holds up to 6 people and their reports. Preview and
   * Send are PER REPORT, and both read the same cached result through
   * getOrCalculateResult() - so the PDF the customer receives is exactly the
   * report the admin previewed. The customer still gets ONE email per order
   * (all reports + the single consolidated invoice).
   */
  const isMultiPersonUnit = (order: Order) =>
    order.serviceType === 'MULTI_PERSON' || (Array.isArray(order.items) && order.items.length > 1);

  const toggleItemsExpand = (orderId: string) =>
    setExpandedItemOrderIds(prev => ({ ...prev, [orderId]: !prev[orderId] }));

  const handlePreviewOrderItem = async (header: Order, item: OrderItem) => {
    setErrorMessage('');
    startProcessing(`item-preview-${item.id}`);
    try {
      const calculated = await getOrCalculateResult(header.id, item);
      const chartOrder = orderItemAsOrder(header, calculated.item);
      setReportItemView({
        header: {
          ...header,
          items: (header.items || []).map(candidate => candidate.id === item.id ? calculated.item : candidate)
        },
        item: calculated.item,
        chartOrder
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to calculate this report');
    } finally {
      stopProcessing(`item-preview-${item.id}`);
    }
  };

  const handleSendOrderItem = async (header: Order, item: OrderItem) => {
    setErrorMessage('');
    setItemSendProgress(`Rendering report for ${item.personName || 'this person'}…`);
    startProcessing(`item-send-${item.id}`);
    try {
      const calculated = await getOrCalculateResult(header.id, item);
      const pdfs = await prepareOrderItemPdfs(header, calculated.item, calculated.result);
      const res: any = await api.sendOrderItemEmail(header.id, item.id, {
        reportPdfBase64: pdfs.reportPdfBase64,
        invoicePdfBase64: pdfs.invoicePdfBase64,
        itemId: item.id
      });
      if (res && res.success) {
        setSuccessMessage(`✅ ${res.message || `Report emailed to ${header.userEmail}.`}`);
        setOrders(prev => prev.map(o => o.id === header.id ? {
          ...o,
          emailStatus: 'SENT',
          status: (res.orderStatus as any) || o.status,
          items: (o.items || []).map(candidate => candidate.id === item.id
            ? { ...candidate, reportStatus: 'SENT' as any, sentAt: new Date().toISOString() }
            : candidate)
        } : o));
        setTimeout(() => setSuccessMessage(''), 6000);
        fetchAdminData();
      } else {
        setErrorMessage(res?.message || 'Failed to send this report');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to prepare this report PDF; no email was sent.');
    } finally {
      setItemSendProgress('');
      stopProcessing(`item-send-${item.id}`);
    }
  };

  const handleSendAllOrderItems = async (order: Order) => {
    const items = order.items || [];
    if (items.length === 0) return;
    setErrorMessage('');
    setItemSendProgress('Preparing reports…');
    startProcessing(`email-${order.id}`);
    try {
      const payload = await prepareOrderItemsSendPayload(order, items, message => setItemSendProgress(message));
      const res: any = await api.sendAllOrderItems(order.id, payload);
      if (res && res.success) {
        setSuccessMessage(`✅ ${res.message || `All ${items.length} reports plus the order invoice were emailed to ${order.userEmail}.`}`);
        setOrders(prev => prev.map(o => o.id === order.id ? {
          ...o,
          status: (res.orderStatus as any) || 'COMPLETED',
          emailStatus: 'SENT',
          items: (o.items || []).map(candidate => ({ ...candidate, reportStatus: 'SENT' as any }))
        } : o));
        setTimeout(() => setSuccessMessage(''), 6000);
        fetchAdminData();
      } else {
        setErrorMessage(res?.message || 'Failed to email the order reports');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to prepare the order PDFs; no email was sent.');
    } finally {
      setItemSendProgress('');
      stopProcessing(`email-${order.id}`);
    }
  };

  /** The order's ONE tax invoice (all reports on one document). */
  const handleDownloadOrderInvoice = async (order: Order) => {
    startProcessing(`inv-${order.id}`);
    try {
      const items = order.items || [];
      await downloadHtmlPdf(buildOrderInvoiceHtmlForItems(order, items), orderInvoiceFileName(order));
    } catch (e) {
      console.warn('Direct order invoice export failed, falling back to the backend render:', e);
      window.open(api.getAdminOrderInvoicePdfUrl(order.id), '_blank');
    } finally {
      stopProcessing(`inv-${order.id}`);
    }
  };

  const handleDownloadReport = async (order: Order) => {
    startProcessing(`pdf-${order.id}`);
    try {
      await exportOrderPdf(order);
    } catch (e) {
      console.warn('Direct PDF export error, falling back to backend download:', e);
      window.open(api.getAdminOrderPdfUrl(order.id), '_blank');
    } finally {
      stopProcessing(`pdf-${order.id}`);
    }
  };

  const handleDownloadInvoice = async (order: Order) => {
    startProcessing(`inv-${order.id}`);
    try {
      await exportOrderInvoicePdf(order);
    } catch (e) {
      console.warn('Direct invoice export error, falling back to backend download:', e);
      window.open(api.getAdminOrderInvoicePdfUrl(order.id), '_blank');
    } finally {
      stopProcessing(`inv-${order.id}`);
    }
  };

  const handleDirectSendCustomerEmail = async (order: Order) => {
    // A multi-person order is delivered per report + one invoice, through the
    // per-item endpoints - never through the single-chart approve path.
    if (isMultiPersonUnit(order)) {
      await handleSendAllOrderItems(order);
      return;
    }
    setErrorMessage('');
    startProcessing(`email-${order.id}`);
    try {
      setSuccessMessage(`⏳ Preparing preview-quality report & invoice for Order #${order.orderNumber}...`);

      let res;
      let fulfilledOrderIds = [order.id];
      if (order.groupId) {
        const groupOrders = orders.filter(candidate => candidate.groupId === order.groupId);
        fulfilledOrderIds = groupOrders.map(member => member.id);
        const prepared = await buildFamilyPreviewPayload(groupOrders, order.groupId);
        const anyPending = groupOrders.some(member => ['PENDING', 'PENDING_APPROVAL'].includes((member.status || '').toUpperCase()));
        res = anyPending
          ? await api.approveFamilyOrder(order.groupId, prepared.payload)
          : await api.resendFamilyEmail(order.groupId, prepared.payload);
      } else {
        const language = order.language || 'ta';
        const pdfs = await generateOrderPdfsBase64(order, language);
        const payload = await deliverOrderPdfPayload(order, { ...pdfs, language });
        if (order.status === 'PENDING' || order.status === 'PENDING_APPROVAL') {
          res = await api.approveOrder(order.id, payload);
        } else {
          res = await api.resendEmail(order.id, payload);
        }
      }

      if (res && res.success) {
        setSuccessMessage(order.groupId
          ? `✅ All preview-quality family reports and the consolidated invoice were emailed to ${order.userEmail} in ${describeEmailParts(res)}.`
          : `✅ Preview-quality report & invoice successfully emailed to ${order.userEmail}!`);
        setOrders(prev => prev.map(o => fulfilledOrderIds.includes(o.id)
          ? { ...o, status: 'COMPLETED', emailStatus: 'SENT' }
          : o));
        setTimeout(() => setSuccessMessage(''), 6000);
        fetchAdminData();
      } else {
        setOrders(prev => prev.map(o => fulfilledOrderIds.includes(o.id) ? { ...o, emailStatus: 'FAILED' } : o));
        setErrorMessage(res?.message || 'Failed to email customer');
      }
    } catch (err: any) {
      setOrders(prev => prev.map(o => o.id === order.id || (order.groupId && o.groupId === order.groupId)
        ? { ...o, emailStatus: 'FAILED' }
        : o));
      console.error('Error sending customer email directly:', err);
      setErrorMessage(err.message || 'Failed to prepare preview-quality PDFs; no email was sent.');
    } finally {
      stopProcessing(`email-${order.id}`);
    }
  };

  const handleBatchApproveAndSendAllPending = async () => {
    const pendingList = orders.filter(o => {
      const s = (o.status || '').toUpperCase();
      return s === 'PENDING' || s === 'PENDING_APPROVAL';
    });

    if (pendingList.length === 0) {
      alert('No pending orders found to process.');
      return;
    }

    if (!window.confirm(`Found ${pendingList.length} pending horoscope calculations across individual and family orders. Do you want to process and email all customers now?`)) {
      return;
    }

    // De-duplicate family groups so family orders receive 1 consolidated email per group
    const processedGroupIds = new Set<string>();
    const processingUnits: Array<{ type: 'family'; groupId: string; orders: Order[] } | { type: 'single'; order: Order }> = [];

    for (const order of pendingList) {
      if (order.groupId) {
        if (!processedGroupIds.has(order.groupId)) {
          processedGroupIds.add(order.groupId);
          const groupOrders = orders.filter(o => o.groupId === order.groupId);
          processingUnits.push({ type: 'family', groupId: order.groupId, orders: groupOrders });
        }
      } else {
        processingUnits.push({ type: 'single', order });
      }
    }

    setBatchProgress({
      total: processingUnits.length,
      current: 0,
      currentOrderNum: '',
      successCount: 0,
      failCount: 0,
      isProcessing: true
    });

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < processingUnits.length; i++) {
      const unit = processingUnits[i];
      const identifier = unit.type === 'family' ? unit.groupId : (unit.order.orderNumber || unit.order.id);

      setBatchProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentOrderNum: identifier
      } : null);

      if (unit.type === 'family') {
        startProcessing(`family-approve-${unit.groupId}`);
        try {
          // All reports and the invoice must be rendered/staged before approval.
          const prepared = await buildFamilyPreviewPayload(unit.orders, unit.groupId);
          const res = await api.approveFamilyOrder(unit.groupId, prepared.payload);
          if (res && res.success) {
            succeeded++;
            setOrders(prev => prev.map(o => o.groupId === unit.groupId ? { ...o, status: 'COMPLETED', emailStatus: 'SENT' } : o));
          } else {
            failed++;
          }
        } catch (e) {
          console.error(`Error processing family group #${unit.groupId}:`, e);
          failed++;
        } finally {
          stopProcessing(`family-approve-${unit.groupId}`);
          setBatchProgress(prev => prev ? {
            ...prev,
            successCount: succeeded,
            failCount: failed
          } : null);
        }
      } else if (isMultiPersonUnit(unit.order)) {
        const order = unit.order;
        startProcessing(`email-${order.id}`);
        try {
          const payload = await prepareOrderItemsSendPayload(order, order.items || [], message =>
            setBatchProgress(prev => prev ? { ...prev, currentOrderNum: `${identifier} • ${message}` } : null)
          );
          const res: any = await api.sendAllOrderItems(order.id, payload);
          if (res && res.success) {
            succeeded++;
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'COMPLETED', emailStatus: 'SENT' } : o));
          } else {
            failed++;
          }
        } catch (e) {
          console.error(`Error processing multi-person order #${order.orderNumber}:`, e);
          failed++;
        } finally {
          stopProcessing(`email-${order.id}`);
          setBatchProgress(prev => prev ? {
            ...prev,
            successCount: succeeded,
            failCount: failed
          } : null);
        }
      } else {
        const order = unit.order;
        startProcessing(`email-${order.id}`);

        try {
          const language = order.language || 'ta';
          const pdfs = await generateOrderPdfsBase64(order, language);
          const payload = await deliverOrderPdfPayload(order, { ...pdfs, language });
          const res = await api.approveOrder(order.id, payload);
          if (res && res.success) {
            succeeded++;
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'COMPLETED', emailStatus: 'SENT' } : o));
          } else {
            failed++;
          }
        } catch (e) {
          console.error(`Error processing batch order #${order.orderNumber}:`, e);
          failed++;
        } finally {
          stopProcessing(`email-${order.id}`);
          setBatchProgress(prev => prev ? {
            ...prev,
            successCount: succeeded,
            failCount: failed
          } : null);
        }
      }
    }

    setBatchProgress(null);
    setSuccessMessage(`🎉 Batch complete! Successfully processed & emailed ${succeeded} package(s).${failed > 0 ? ` (${failed} failed)` : ''}`);
    setTimeout(() => setSuccessMessage(''), 8000);
    fetchAdminData();
  };

  /**
   * Renders the EXACT same high-quality PDFs shown in the admin live preview
   * for a family bundle - one report PDF per member + ONE consolidated family
   * tax invoice (premium invoiceHtmlBuilder design) - and uploads each of them
   * with its own request, member by member, exactly like the single-order
   * "Send Email" button does.
   *
   * Why not one big request? A family bundle is N * ~2 MB of PDF; a single JSON
   * body that large is discarded by PHP's post_max_size, and the server then
   * emails its own low-quality render instead. Staging one document per request
   * is what makes the group order quality identical to the single order.
   */
  const buildFamilyPreviewPayload = async (
    memberOrders: Order[],
    groupId: string,
    preferredLang?: string
  ): Promise<{ payload: any; staging: FamilyStagingResult }> => {
    const onProgress = (progress: FamilyRenderProgress) => {
      setFamilyRenderProgress({ groupId, ...progress });
      setSuccessMessage(`⏳ ${progress.message}`);
    };

    const prepared = await prepareFamilyFulfilPayload(
      memberOrders,
      groupId,
      onProgress,
      preferredLang ? { preferredLang: preferredLang as any } : undefined
    );

    if (prepared.staging.warnings.length > 0) {
      console.warn(`Family group ${groupId} render warnings:`, prepared.staging.warnings);
      // A failed staged upload may use a bounded inline preview-PDF payload;
      // render/upload warnings never trigger server-rendered substitutions.
      setErrorMessage(`Preview-quality upload warning for group ${groupId}: ${prepared.staging.warnings.join(' ')}`);
    }
    if (prepared.staging.skipped.length > 0) {
      setErrorMessage(
        `${prepared.staging.skipped.length} family member report(s) could not be rendered: ` +
          prepared.staging.skipped.map(s => `#${s.orderNumber} (${s.memberName})`).join(', ')
      );
    }

    return { payload: prepared.payload, staging: prepared.staging };
  };


  const handleApproveFamilyGroup = async (groupId: string, memberOrders: Order[]) => {
    const count = memberOrders.length;
    startProcessing(`family-approve-${groupId}`);
    setErrorMessage('');
    try {
      setSuccessMessage(`⏳ Rendering ${count} preview-quality report(s) & the consolidated family tax invoice in this browser...`);
      // A render or staging failure aborts the operation; the server is never
      // asked to substitute its lower-quality PDF renderer.
      const prepared = await buildFamilyPreviewPayload(memberOrders, groupId);
      const res = await api.approveFamilyOrder(groupId, prepared.payload);
      if (res.success) {
        setSuccessMessage(
          `🎉 Family Order group (${count} charts) approved. All preview-quality reports and the consolidated invoice were delivered in ${describeEmailParts(res)}.${describeFamilyRenderQuality(res)}`
        );
        setOrders(prev => prev.map(o => o.groupId === groupId ? { ...o, status: 'COMPLETED', emailStatus: 'SENT' } : o));
        setTimeout(() => setSuccessMessage(''), 6000);
        fetchAdminData();
      } else {
        setOrders(prev => prev.map(o => o.groupId === groupId ? { ...o, emailStatus: 'FAILED' } : o));
        setErrorMessage(res.message || 'Family group approval failed');
      }
    } catch (err: any) {
      setOrders(prev => prev.map(o => o.groupId === groupId ? { ...o, emailStatus: 'FAILED' } : o));
      setErrorMessage(err.message || 'Family group approval failed');
    } finally {
      stopProcessing(`family-approve-${groupId}`);
    }
  };

  const handleResendFamilyEmail = async (groupId: string, memberOrders: Order[]) => {
    startProcessing(`family-email-${groupId}`);
    setErrorMessage('');
    try {
      setSuccessMessage(`⏳ Rendering preview-quality reports & family tax invoice for group ${groupId}...`);
      const prepared = await buildFamilyPreviewPayload(memberOrders, groupId);
      const res = await api.resendFamilyEmail(groupId, prepared.payload);
      if (res.success) {
        setSuccessMessage(`🎉 All preview-quality family reports and the consolidated invoice were delivered in ${describeEmailParts(res)}.${describeFamilyRenderQuality(res)}`);
        setOrders(prev => prev.map(o => o.groupId === groupId ? { ...o, emailStatus: 'SENT' } : o));
        setTimeout(() => setSuccessMessage(''), 5000);
        fetchAdminData();
      } else {
        setOrders(prev => prev.map(o => o.groupId === groupId ? { ...o, emailStatus: 'FAILED' } : o));
        setErrorMessage(res.message || 'Failed to send family email');
      }
    } catch (err: any) {
      setOrders(prev => prev.map(o => o.groupId === groupId ? { ...o, emailStatus: 'FAILED' } : o));
      setErrorMessage(err.message || 'Failed to send family email');
    } finally {
      stopProcessing(`family-email-${groupId}`);
    }
  };

  const handleCancelFamilyOrder = async (groupId: string) => {
    const reason = window.prompt('Enter reason for cancelling entire family package:', 'Cancelled by administrator') || 'Cancelled by administrator';
    startProcessing(`family-cancel-${groupId}`);
    try {
      const res = await api.cancelFamilyOrder(groupId, reason);
      if (res.success) {
        setSuccessMessage('Entire family package cancelled successfully.');
        setTimeout(() => setSuccessMessage(''), 4000);
        fetchAdminData();
      } else {
        setErrorMessage(res.message || 'Cancellation failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Cancellation failed');
    } finally {
      stopProcessing(`family-cancel-${groupId}`);
    }
  };

  /** Opens the LIVE high-quality preview of the consolidated family tax invoice. */
  const handlePreviewFamilyInvoice = (memberOrders: Order[], groupId: string) => {
    setErrorMessage('');
    setFamilyInvoicePreview({ orders: memberOrders, groupId });
  };

  const handleDownloadFamilyInvoice = async (memberOrders: Order[], groupId: string) => {
    startProcessing(`family-inv-${groupId}`);
    try {
      // High-quality consolidated family invoice rendered from the exact same
      // HTML builder as the admin live preview (falls back to the server PDF).
      if (memberOrders && memberOrders.length > 0) {
        await exportFamilyInvoiceHtmlToPdf(memberOrders, groupId, `ASTRO_SIVAM_Family_Invoice_${groupId}.pdf`);
      } else {
        await api.downloadAdminFamilyInvoicePdf(groupId);
      }
    } catch (e: any) {
      console.warn('High-quality family invoice export failed, trying server fallback:', e);
      try {
        await api.downloadAdminFamilyInvoicePdf(groupId);
      } catch (err: any) {
        console.warn('Direct PDF download error, opening link:', err);
        window.open(api.getAdminFamilyInvoicePdfUrl(groupId), '_blank');
      }
    } finally {
      stopProcessing(`family-inv-${groupId}`);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt('Enter reason for order cancellation:', 'Cancelled by administrator') || 'Cancelled by administrator';
    startProcessing(orderId);
    try {
      const res = await api.cancelOrder(orderId, reason);
      if (res.success) {
        setSuccessMessage('Order has been cancelled successfully.');
        setTimeout(() => setSuccessMessage(''), 4000);
        fetchAdminData();
      } else {
        setErrorMessage(res.message || 'Cancellation failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Cancellation failed');
    } finally {
      stopProcessing(orderId);
    }
  };

  const handleBanOrderIp = async (order: Order) => {
    const ip = order.ipAddress;
    const defaultReason = `Fake / spam order #${order.orderNumber || order.id} (${order.paymentReference ? 'Invalid payment ref: ' + order.paymentReference : 'Unverified user submission'})`;
    const reason = window.prompt(
      `Enter reason for banning IP address ${ip ? `(${ip})` : ''} from Order #${order.orderNumber || order.id}:`,
      defaultReason
    );
    if (!reason) return;

    startProcessing(`ban-${order.id}`);
    try {
      const res = await api.banIpFromOrder(order.id, reason);
      if (res.success) {
        setSuccessMessage(`🛡️ IP Address ${res.ip ? `(${res.ip})` : ''} has been banned successfully! Future requests from this IP will be blocked.`);
        setTimeout(() => setSuccessMessage(''), 6000);
        fetchAdminData();
      } else {
        setErrorMessage(res.message || 'Failed to ban IP address');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to ban IP address');
    } finally {
      stopProcessing(`ban-${order.id}`);
    }
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete Order #${orderNumber}? This will remove it from the system completely.`)) {
      return;
    }
    startProcessing(orderId);
    try {
      const res = await api.deleteOrder(orderId);
      if (res.success) {
        setSuccessMessage(`Order #${orderNumber} deleted successfully.`);
        setTimeout(() => setSuccessMessage(''), 4000);
        fetchAdminData();
      } else {
        setErrorMessage(res.message || 'Delete failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Delete failed');
    } finally {
      stopProcessing(orderId);
    }
  };

  const handleProcessRefund = async (orderId: string, notes?: string) => {
    startProcessing(orderId);
    try {
      const res = await api.processRefund(orderId, notes || 'Refund verified and processed via Admin Portal');
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => setSuccessMessage(''), 4000);
        fetchAdminData();
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Refund processing failed');
    } finally {
      stopProcessing(orderId);
    }
  };

  const handleUpdateSettingsGeneric = async (updates: Partial<AppSettings>) => {
    try {
      const res = await api.updateAdminSettings(updates);
      if (res.success) {
        setSuccessMessage('Settings updated successfully!');
        await refreshSettings();
        fetchAdminData();
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update settings');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.updateAdminSettings({
        serviceMode,
        fijiPriceFJD: Number(fijiPrice),
        intlPriceUSD: Number(intlPrice),
        indiaPriceINR: Number(indiaPrice),
        servicePricing,
        autoEmailReports: autoEmail
      });
      if (res.success) {
        setSuccessMessage('System settings & service pricing saved successfully!');
        await refreshSettings();
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update settings');
    }
  };

  // Team CRUD Handlers
  const handleOpenAddTeamModal = () => {
    setEditingMember(null);
    setMemberFormData({
      nameEn: '',
      nameTa: '',
      nameHi: '',
      titleEn: 'Senior Sivachariyar & Astrological Consultant',
      titleTa: 'முதுநிலை சிவாச்சாரியார் மற்றும் வேத ஜோதிட ஆலோசகர்',
      photoUrl: '',
      educationEn: 'Veda Agama Praveena, Sanskrit University',
      educationTa: 'வேத ஆகம பிரவீணா, சமஸ்கிருத வித்யாபீடம்',
      experienceYears: 15,
      specializations: 'Birth Jathagam, 10 Poruthams Matching, Navagraha Dosha Pariharam',
      bioEn: 'Over 15 years of dedicated practice in traditional South Indian Vedic astrology and temple ritual sciences.',
      bioTa: 'பாரம்பரிய வேத ஜோதிட கணிப்பு மற்றும் கோவில் பூஜை வழிபாடுகளில் 15 ஆண்டுகளுக்கும் மேலான அனுபவம் கொண்டவர்.',
      isActive: true,
      order: teamMembers.length + 1
    });
    setIsTeamModalOpen(true);
  };

  const handleOpenEditTeamModal = (member: TeamMember) => {
    setEditingMember(member);
    setMemberFormData({
      nameEn: member.nameEn,
      nameTa: member.nameTa || '',
      nameHi: member.nameHi || '',
      titleEn: member.titleEn,
      titleTa: member.titleTa || '',
      photoUrl: member.photoUrl,
      educationEn: member.educationEn,
      educationTa: member.educationTa || '',
      experienceYears: member.experienceYears,
      specializations: member.specializations.join(', '),
      bioEn: member.bioEn || '',
      bioTa: member.bioTa || '',
      isActive: member.isActive,
      order: member.order
    });
    setIsTeamModalOpen(true);
  };

  const handleSaveTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nameEn: memberFormData.nameEn,
        nameTa: memberFormData.nameTa,
        nameHi: memberFormData.nameHi,
        titleEn: memberFormData.titleEn,
        titleTa: memberFormData.titleTa,
        photoUrl: memberFormData.photoUrl,
        educationEn: memberFormData.educationEn,
        educationTa: memberFormData.educationTa,
        experienceYears: Number(memberFormData.experienceYears),
        specializations: memberFormData.specializations.split(',').map(s => s.trim()).filter(Boolean),
        bioEn: memberFormData.bioEn,
        bioTa: memberFormData.bioTa,
        isActive: memberFormData.isActive,
        order: Number(memberFormData.order)
      };

      if (editingMember) {
        const res = await api.updateTeamMember(editingMember.id, payload);
        if (res.success) {
          setSuccessMessage(`Team member ${res.member?.nameEn} updated successfully!`);
          setIsTeamModalOpen(false);
          fetchAdminData();
        }
      } else {
        const res = await api.createTeamMember(payload);
        if (res.success) {
          setSuccessMessage(`New team member ${res.member?.nameEn} added successfully!`);
          setIsTeamModalOpen(false);
          fetchAdminData();
        }
      }
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save team member');
    }
  };

  const handleToggleMemberActive = async (member: TeamMember) => {
    try {
      const res = await api.updateTeamMember(member.id, { isActive: !member.isActive });
      if (res.success) {
        setSuccessMessage(`Member status changed to ${!member.isActive ? 'Active' : 'Inactive'}`);
        setTimeout(() => setSuccessMessage(''), 3000);
        fetchAdminData();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update member status');
    }
  };

  const handleDeleteTeamMember = async (id: string, name?: string) => {
    const memberName = name || 'this team scholar';
    if (!window.confirm(`Are you sure you want to remove ${memberName} from the astrology team?`)) {
      return;
    }
    try {
      const res = await api.deleteTeamMember(id);
      if (res && res.success) {
        setTeamMembers(prev => prev.filter(m => m.id !== id));
        setSuccessMessage(`Team scholar ${memberName} removed successfully`);
        setTimeout(() => setSuccessMessage(''), 4000);
        fetchAdminData();
      } else {
        setErrorMessage(res?.message || 'Failed to remove team member');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove team member');
    }
  };

  const handleUpdateMessageStatus = async (id: string, status: 'NEW' | 'REVIEWED' | 'RESPONDED') => {
    try {
      const res = await api.updateAdminMessage(id, { status });
      if (res.success) {
        setSuccessMessage(`Inquiry marked as ${status}`);
        setTimeout(() => setSuccessMessage(''), 3000);
        fetchAdminData();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update message');
    }
  };

  const handleDeleteMessage = async (id: string, name: string) => {
    if (!window.confirm(`Delete inquiry message from ${name}?`)) return;
    try {
      const res = await api.deleteAdminMessage(id);
      if (res.success) {
        setSuccessMessage('Inquiry message removed');
        setTimeout(() => setSuccessMessage(''), 3000);
        fetchAdminData();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete message');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Authenticating Astro Sivam Admin Gateway...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLogin
        onNavigate={onNavigate}
        onLoginSuccess={() => {
          fetchAdminData();
        }}
      />
    );
  }

  const groupedOrderUnits: any = (() => {
    const groupsMap = new Map<string, Order[]>();
    const singleOrders: Order[] = [];

    // Group all orders by groupId
    orders.forEach(o => {
      if (o.groupId) {
        if (!groupsMap.has(o.groupId)) {
          groupsMap.set(o.groupId, []);
        }
        groupsMap.get(o.groupId)!.push(o);
      } else {
        singleOrders.push(o);
      }
    });

    const units: Array<{
      isGroup: boolean;
      groupId?: string;
      orders: Order[];
      mainOrder: Order;
      totalAmount: number;
      currency: string;
      paymentReference?: string;
      paymentMethod: any;
      status: string;
      emailStatus: string;
      isAllCompleted?: boolean;
      isAllCancelled?: boolean;
      /** One orders row with people/reports (multi-person checkout). */
      isMultiPerson?: boolean;
      createdAt: string;
      userName: string;
      userEmail: string;
      country: string;
      ipAddress?: string;
    }> = [];

    // Build Family Group Units
    groupsMap.forEach((gOrders, gId) => {
      gOrders.sort((a, b) => (a.groupOrderIndex ?? 0) - (b.groupOrderIndex ?? 0));
      const main = gOrders[0];
      const totalAmount = gOrders.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const allCompleted = gOrders.every(item => (item.status || '').toUpperCase() === 'COMPLETED');
      const allCancelled = gOrders.every(item => (item.status || '').toUpperCase() === 'CANCELLED');
      const anyPending = gOrders.some(item => {
        const s = (item.status || '').toUpperCase();
        return s === 'PENDING' || s === 'PENDING_APPROVAL';
      });

      let combinedStatus = 'PENDING';
      if (allCompleted) combinedStatus = 'COMPLETED';
      else if (allCancelled) combinedStatus = 'CANCELLED';
      else if (anyPending) combinedStatus = 'PENDING';
      else combinedStatus = main.status;

      const emailStatus = gOrders.some(item => item.emailStatus === 'SENT')
        ? 'SENT'
        : gOrders.some(item => (item.emailStatus || '').toUpperCase() === 'FAILED' || (item.emailStatus || '').toUpperCase() === 'ERROR')
        ? 'FAILED'
        : main.emailStatus;

      units.push({
        isGroup: true,
        groupId: gId,
        orders: gOrders,
        mainOrder: main,
        totalAmount,
        currency: main.currency || 'FJD',
        paymentReference: main.paymentReference || gOrders.find(o => o.paymentReference)?.paymentReference,
        paymentMethod: main.paymentMethod,
        status: combinedStatus,
        emailStatus,
        isAllCompleted: allCompleted,
        isAllCancelled: allCancelled,
        createdAt: main.createdAt,
        userName: main.userName || main.inputPayload?.name || 'Family User Group',
        userEmail: main.userEmail,
        country: main.country,
        ipAddress: main.ipAddress
      });
    });

    // Build Single Order Units
    singleOrders.forEach(order => {
      units.push({
        isGroup: false,
        isMultiPerson: order.serviceType === 'MULTI_PERSON' || (Array.isArray(order.items) && order.items.length > 0),
        orders: [order],
        mainOrder: order,
        totalAmount: Number(order.amount) || 0,
        currency: order.currency || 'FJD',
        paymentReference: order.paymentReference,
        paymentMethod: order.paymentMethod,
        status: order.status,
        emailStatus: order.emailStatus,
        createdAt: order.createdAt,
        userName: order.userName || order.inputPayload?.name || 'User',
        userEmail: order.userEmail,
        country: order.country,
        ipAddress: order.ipAddress
      });
    });

    // Sort units newest first
    units.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Filter by filterStatus & searchQuery
    return units.filter(unit => {
      const unitStatus = (unit.status || '').toUpperCase();
      const matchesStatus =
        filterStatus === 'ALL' ||
        unitStatus === filterStatus ||
        (filterStatus === 'PENDING' && (unitStatus === 'PENDING' || unitStatus === 'PENDING_APPROVAL'));

      if (!matchesStatus) return false;

      if (!searchQuery) return true;

      const q = (searchQuery || '').toLowerCase();
      const matchGroup = unit.groupId?.toLowerCase().includes(q);
      const matchMain =
        unit.mainOrder?.orderNumber?.toLowerCase().includes(q) ||
        unit.userName?.toLowerCase().includes(q) ||
        unit.userEmail?.toLowerCase().includes(q) ||
        unit.country?.toLowerCase().includes(q) ||
        unit.paymentReference?.toLowerCase().includes(q);

      const matchMembers = unit.orders.some(o =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.userName?.toLowerCase().includes(q) ||
        o.inputPayload?.name?.toLowerCase().includes(q) ||
        o.serviceType?.toLowerCase().includes(q) ||
        o.inputPayload?.birthPlace?.toLowerCase().includes(q)
      );

      return !!(matchGroup || matchMain || matchMembers);
    });
  })();

  const filteredOrders = orders.filter(o => {
    const matchesStatus = filterStatus === 'ALL' || o.status === filterStatus;
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      o.orderNumber?.toLowerCase().includes(q) ||
      o.userName?.toLowerCase().includes(q) ||
      o.userEmail?.toLowerCase().includes(q) ||
      o.serviceType?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  /**
   * One row per ORDER, expanding to its PEOPLE and each person's REPORTS.
   * Preview and Send are per report and share the same cached result, so what
   * the admin previews is exactly what the customer receives.
   */
  const renderMultiPersonItems = (order: Order) => {
    const people = order.persons || [];
    const allItems = order.items || [];
    const usedItemIds = new Set<number>();
    const groups: Array<{ key: string; seq: number; title: string; meta: string; items: OrderItem[] }> = people.map(person => {
      const personItems = allItems.filter(item =>
        (person.id && item.personId ? item.personId === person.id : item.personSeq === person.seq)
      );
      personItems.forEach(item => usedItemIds.add(item.id));
      return {
        key: `${order.id}-person-${person.seq}`,
        seq: person.seq,
        title: person.fullName,
        meta: [
          person.gender,
          person.dob ? `DOB ${person.dob}` : '',
          person.tob ? `Tob ${person.tob}` : '',
          person.place ? `${person.place}${person.country ? `, ${person.country}` : ''}` : ''
        ].filter(Boolean).join(' · '),
        items: personItems
      };
    });
    const leftovers = allItems.filter(item => !usedItemIds.has(item.id));
    if (leftovers.length > 0) {
      groups.push({
        key: `${order.id}-person-other`,
        seq: groups.length + 1,
        title: 'Other reports',
        meta: '',
        items: leftovers
      });
    }

    const sendingAll = isProcessing(`email-${order.id}`);
    return (
      <div className="px-4 sm:px-6 pb-4 pt-1">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-amber-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {people.length} {people.length === 1 ? 'Person' : 'People'} · {allItems.length} {allItems.length === 1 ? 'Report' : 'Reports'} · {(Number(order.amount) || 0).toFixed(2)} {order.currency}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {itemSendProgress && (
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">{itemSendProgress}</span>
              )}
              <button
                type="button"
                onClick={() => handleDownloadOrderInvoice(order)}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Receipt className="w-3 h-3 text-amber-500" />
                <span>Order Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendAllOrderItems(order)}
                disabled={sendingAll || allItems.length === 0}
                title="Email every report plus the ONE order invoice to the customer"
                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                <Send className={`w-3 h-3 ${sendingAll ? 'animate-spin' : ''}`} />
                <span>{sendingAll ? 'Sending…' : 'Send All Reports + Invoice'}</span>
              </button>
            </div>
          </div>

          {groups.length === 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              No people/report rows are stored for this order yet. If it was placed before the multi-person rollout, run
              <code className="mx-1 font-mono">api/migrations/003_multi_person_orders.sql</code> in phpMyAdmin and refresh.
            </p>
          )}

          {groups.map(group => (
            <div key={group.key} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">#{group.seq}</span>
                <span className="font-bold text-xs text-slate-900 dark:text-white">{group.title}</span>
                {group.meta && <span className="text-[11px] text-slate-500 dark:text-slate-400">{group.meta}</span>}
              </div>

              <div className="space-y-1.5">
                {group.items.map(item => {
                  const previewing = isProcessing(`item-preview-${item.id}`);
                  const sending = isProcessing(`item-send-${item.id}`);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 px-2.5 py-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{serviceDisplayName(item.serviceCode)}</span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {Number(item.unitPrice || 0).toFixed(2)} {order.currency}
                        </span>
                        {getItemStatusBadge(item.reportStatus)}
                        {item.calculatedResult ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            CACHED
                          </span>
                        ) : null}
                        {item.language && (
                          <span className="text-[9px] font-mono uppercase text-slate-400">{item.language}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePreviewOrderItem(order, item)}
                          disabled={previewing || sending}
                          title="Preview this report (uses the same cached result the customer will receive)"
                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-amber-500" />
                          <span>{previewing ? 'Loading…' : 'Preview'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendOrderItem(order, item)}
                          disabled={previewing || sending}
                          title="Email THIS report plus the order invoice to the customer"
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-[11px] flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          <Send className={`w-3 h-3 ${sending ? 'animate-spin' : ''}`} />
                          <span>
                            {sending ? 'Sending…' : (item.reportStatus === 'SENT' || item.reportStatus === 'FAILED' ? 'Resend' : 'Send')}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {group.items.length === 0 && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">No reports stored for this person.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 select-none">
      <SEO
        title="Admin Management Portal | ASTRO SIVAM"
        description="Secure administration portal for ASTRO SIVAM order processing, astrologer review, and financial metrics."
        noindex={true}
      />
      
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="relative w-14 h-14 rounded-full overflow-hidden shadow-lg border-2 border-amber-400/60 bg-black p-1 shrink-0 flex items-center justify-center">
            <img
              src={logoImg}
              alt="ASTRO SIVAM Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              <span>ASTRO SIVAM Administration Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Administrative Control Center
            </h1>
            <p className="text-xs text-slate-400">
              Manage daily 9:00 AM – 11:00 AM IST priest preparation approvals, India astrology team members, Free Beta &amp; paid order verifications, and pricing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={fetchAdminData}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Records</span>
          </button>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-2xl text-xs flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Orders</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats?.totalOrders ?? orders.length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold text-amber-500">Pending Review</div>
          <div className="text-2xl font-black text-amber-500 mt-1">
            {stats?.pendingOrders ?? orders.filter(o => o.status === 'PENDING' || o.status === 'PENDING_APPROVAL').length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-500">Generated / Sent</div>
          <div className="text-2xl font-black text-emerald-500 mt-1">
            {stats?.completedOrders ?? orders.filter(o => o.status === 'GENERATED' || o.status === 'COMPLETED').length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold text-sky-500">Astrology Team</div>
          <div className="text-2xl font-black text-sky-500 mt-1">
            {teamMembers.length} Scholars
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold text-purple-500">Service Mode</div>
          <div className="text-sm font-black text-purple-400 mt-1.5 truncate">
            {settings?.serviceMode === 'FREE_BETA' ? '★ Free Beta' : 'Paid Service'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-500">Email System</div>
          <div className="text-xs font-black text-slate-900 dark:text-emerald-300 mt-1.5 truncate flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />
            <span>Ready for Delivery</span>
          </div>
        </div>
      </div>

      {/* Quick System Health Status Bar */}
      {(() => {
        const isEmailOk = Boolean(settings?.emailSettings?.smtpHost && settings?.emailSettings?.senderEmail);
        const isMPaisaOk = Boolean(settings?.vodafoneMPaisaNumber && settings.vodafoneMPaisaNumber.trim().length >= 6);
        const isPayPalOk = Boolean(settings?.paypalEmail || settings?.paypalClientId);
        const isPriceOk = Boolean((settings?.fijiPriceFJD || 0) > 0 && (settings?.intlPriceUSD || 0) > 0);

        return (
          <div className="bg-slate-900/90 dark:bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <span>System Health Status</span>
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Live Diagnostics
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Programmatic status of core integrations and checkout gateways
                </div>
              </div>
            </div>

            {/* Micro Chips for Email, M-Paisa, PayPal, Prices */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Email */}
              <button
                type="button"
                onClick={() => setActiveSection('checklist')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all border ${
                  isEmailOk
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                <span>{isEmailOk ? '✓' : '✕'}</span>
                <span>Email SMTP</span>
              </button>

              {/* M-Paisa */}
              <button
                type="button"
                onClick={() => setActiveSection('checklist')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all border ${
                  isMPaisaOk
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                <span>{isMPaisaOk ? '✓' : '✕'}</span>
                <span>M-PAiSA</span>
              </button>

              {/* PayPal */}
              <button
                type="button"
                onClick={() => setActiveSection('checklist')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all border ${
                  isPayPalOk
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                <span>{isPayPalOk ? '✓' : '✕'}</span>
                <span>PayPal</span>
              </button>

              {/* Prices */}
              <button
                type="button"
                onClick={() => setActiveSection('checklist')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all border ${
                  isPriceOk
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                <span>{isPriceOk ? '✓' : '✕'}</span>
                <span>Prices</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('checklist')}
                className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors shadow-xs ml-auto md:ml-0"
              >
                <span>Full Checklist</span>
                <ShieldCheck className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveSection('orders')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'orders'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Orders & Approvals ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('analytics')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'analytics'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          <span>Analytics Dashboard</span>
        </button>

        <button
          onClick={() => setActiveSection('financial')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'financial'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          <span>Financial Reports</span>
        </button>

        <button
          onClick={() => setActiveSection('payments')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'payments'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-amber-500" />
          <span>Payment Gateways</span>
        </button>

        <button
          onClick={() => setActiveSection('emails')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'emails'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-blue-500" />
          <span>Email & SMTP</span>
        </button>

        <button
          onClick={() => setActiveSection('alerts')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'alerts'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
          <span>WhatsApp & Viber Alerts</span>
        </button>

        <button
          onClick={() => setActiveSection('database')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'database'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-purple-400" />
          <span>Database & Backup</span>
        </button>

        <button
          onClick={() => setActiveSection('checklist')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'checklist'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>System Health & Checklist</span>
        </button>

        <button
          onClick={() => setActiveSection('team')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'team'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Astrology Team ({teamMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('settings')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'settings'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Service Mode & Pricing</span>
        </button>


        <button
          id="tab-google-setup"
          onClick={() => setActiveSection('google')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'google'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          <span>Google Setup</span>
        </button>

        <button
          onClick={() => setActiveSection('messages')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'messages'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Messages ({messagesList.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('users')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'users'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('logs')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'logs'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>

        <button
          id="tab-security-banned-ips"
          onClick={() => setActiveSection('security')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'security'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <span>Security & Banned IPs ({bannedIps.length})</span>
        </button>
        <button onClick={() => { setActiveSection('errors'); api.getAdminClientErrors().then(r => r.success && setClientErrors(r.errors || [])).catch(() => {}); }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeSection === 'errors' ? 'bg-red-600 text-white' : 'bg-white dark:bg-slate-900 border border-red-200 text-red-700'}`}>
          <ShieldAlert className="w-3.5 h-3.5" /><span>Request Errors</span>
        </button>
      </div>

      {/* SECTION 1: ORDERS & APPROVALS */}
      {activeSection === 'orders' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Daily Priest Review &amp; Approval Workflow:</strong> When you click <strong>Approve</strong>, ASTRO SIVAM instantly generates both the official Report PDF and Tax Invoice PDF with our India priest team verification, archives the records, and automatically emails both documents together to the customer.
              </span>
            </div>
          </div>

          {/* Filters & Search & Batch Actions */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Filter Tabs with Live Counts */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/70 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
              {[
                { id: 'ALL', label: 'All Orders', count: orders.length },
                { id: 'PENDING', label: 'Pending', count: orders.filter(o => { const s = (o.status || '').toUpperCase(); return s === 'PENDING' || s === 'PENDING_APPROVAL'; }).length },
                { id: 'GENERATED', label: 'Generated', count: orders.filter(o => (o.status || '').toUpperCase() === 'GENERATED').length },
                { id: 'COMPLETED', label: 'Completed', count: orders.filter(o => (o.status || '').toUpperCase() === 'COMPLETED').length },
                { id: 'CANCELLED', label: 'Cancelled', count: orders.filter(o => (o.status || '').toUpperCase() === 'CANCELLED').length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    filterStatus === tab.id
                      ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    filterStatus === tab.id
                      ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              {/* Batch Approve & Send All Button */}
              {orders.some(o => { const s = (o.status || '').toUpperCase(); return s === 'PENDING' || s === 'PENDING_APPROVAL'; }) && (
                <button
                  type="button"
                  onClick={handleBatchApproveAndSendAllPending}
                  disabled={!!batchProgress?.isProcessing}
                  className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  title="Automatically generate PDFs and send emails for all pending orders without waiting on each one manually"
                >
                  <Send className={`w-3.5 h-3.5 ${batchProgress?.isProcessing ? 'animate-spin' : ''}`} />
                  <span>
                    {batchProgress?.isProcessing
                      ? `Processing ${batchProgress.current}/${batchProgress.total}...`
                      : `⚡ Send All Pending (${orders.filter(o => { const s = (o.status || '').toUpperCase(); return s === 'PENDING' || s === 'PENDING_APPROVAL'; }).length})`}
                  </span>
                </button>
              )}

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-amber-400 focus:outline-none shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Family (group order) render progress banner: one report at a time */}
          {familyRenderProgress && (
            <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 rounded-2xl space-y-2 shadow-sm">
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-purple-900 dark:text-purple-200">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping"></span>
                  Family Order {familyRenderProgress.groupId} — rendering report {familyRenderProgress.index} of {familyRenderProgress.total}
                  {familyRenderProgress.memberName ? ` (${familyRenderProgress.memberName})` : ''}
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="rounded-full bg-purple-600/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                    Report {familyRenderProgress.index}/{familyRenderProgress.total}
                  </span>
                  {familyRenderProgress.bytes
                    ? `${(familyRenderProgress.bytes / 1048576).toFixed(1)} MB`
                    : ''}
                  {Math.round((familyRenderProgress.index / Math.max(1, familyRenderProgress.total)) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-purple-200 dark:bg-purple-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 transition-all duration-300 rounded-full"
                  style={{ width: `${(familyRenderProgress.index / Math.max(1, familyRenderProgress.total)) * 100}%` }}
                />
              </div>
              <div className="text-[11px] font-semibold text-purple-800 dark:text-purple-300">
                {familyRenderProgress.phase === 'rendering'
                  ? `Rendering report ${familyRenderProgress.index}/${familyRenderProgress.total} — ${familyRenderProgress.message}`
                  : familyRenderProgress.message}
              </div>
            </div>
          )}

          {/* Batch Progress Banner */}
          {batchProgress?.isProcessing && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl space-y-2 shadow-sm animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Processing Order #{batchProgress.currentOrderNum} ({batchProgress.current} of {batchProgress.total})...
                </span>
                <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Orders Section: Mobile Responsive Modern Card List + Desktop Modern Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            
            {groupedOrderUnits.length === 0 ? (
              <div className="px-5 py-14 text-center text-slate-400">
                <div className="max-w-xs mx-auto space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      No {filterStatus !== 'ALL' ? filterStatus.toLowerCase() : ''} orders found
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {searchQuery
                        ? `No orders matching "${searchQuery}". Try a different keyword.`
                        : filterStatus === 'PENDING'
                        ? 'All incoming orders have been processed and emailed successfully!'
                        : 'There are currently no orders in this list.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 1. MOBILE CARDS VIEW (Clean, Modern, Responsive for Mobile Screens) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
                  {groupedOrderUnits.map(unit => {
                    const normalizedStatus = (unit.status || '').toString().trim().toUpperCase();
                    const isCompleted = normalizedStatus === 'COMPLETED';
                    const isCancelled = normalizedStatus === 'CANCELLED';
                    const isPending = normalizedStatus === 'PENDING' || normalizedStatus === 'PENDING_APPROVAL';
                    const isGroup = unit.isGroup;
                    const groupId = unit.groupId || '';
                    const isExpanded = !!expandedGroupIds[groupId];

                    const getLanguageBadge = (lang?: string) => {
                      const l = (lang || 'ta').toLowerCase();
                      if (l === 'ta' || l === 'tamil') {
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60">
                            Tamil
                          </span>
                        );
                      }
                      if (l === 'hi' || l === 'hindi') {
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-300/70 dark:border-orange-700/60">
                            Hindi
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300/70 dark:border-blue-700/60">
                          English
                        </span>
                      );
                    };

                    const getStatusBadge = (st: string) => {
                      const s = st.toUpperCase();
                      if (s === 'COMPLETED') {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-black bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                            <span>COMPLETED</span>
                          </span>
                        );
                      }
                      if (s === 'GENERATED') {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-black bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400"></span>
                            <span>GENERATED</span>
                          </span>
                        );
                      }
                      if (s === 'PENDING' || s === 'PENDING_APPROVAL') {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-black bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 animate-pulse shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 animate-ping"></span>
                            <span>PENDING</span>
                          </span>
                        );
                      }
                      if (s === 'CANCELLED') {
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-black bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400"></span>
                            <span>CANCELLED</span>
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {st}
                        </span>
                      );
                    };

                    if (isGroup) {
                      const isApprovingGroup = isProcessing(`family-approve-${groupId}`);
                      const isEmailingGroup = isProcessing(`family-email-${groupId}`);
                      const isCancellingGroup = isProcessing(`family-cancel-${groupId}`);
                      const isDownloadingInv = isProcessing(`family-inv-${groupId}`);

                      return (
                        <div key={groupId} className="p-4 space-y-3.5 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5 border-l-4 border-l-amber-500 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                          {/* 1. Header: Family Group Badge & Status */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-500 text-slate-950 shadow-xs">
                                <Users className="w-3.5 h-3.5" />
                                <span>Family Order ({unit.orders.length} People)</span>
                              </span>
                              <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/70 px-2 py-0.5 rounded-md border border-amber-300/70 dark:border-amber-700/60">
                                {groupId}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {getStatusBadge(unit.status)}
                              {((unit.emailStatus || '').toUpperCase() === 'FAILED' || (unit.emailStatus || '').toUpperCase() === 'ERROR') && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40" title="Email delivery failed">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  <span>Email Failed</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2. Family Summary Info */}
                          <div className="bg-slate-800/70 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-extrabold text-[#fffdfa] tracking-tight">
                                {unit.userName}
                              </span>
                              {unit.country && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-700/80 text-amber-300 border border-slate-600">
                                  {unit.country}
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-amber-400" />
                              <span className="truncate">{unit.userEmail}</span>
                            </div>

                            {/* Total Paid & Payment Ref */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-700/60 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-medium">Total Paid:</span>
                                <span className="font-black text-amber-400 text-sm">
                                  ${unit.totalAmount.toFixed(2)} {unit.currency}
                                </span>
                              </div>
                              {unit.paymentReference && (
                                <div className="font-mono text-[11px] text-slate-300">
                                  <span className="text-slate-400 uppercase text-[9px] font-bold">Ref: </span>
                                  <strong className="text-amber-300 font-bold">{unit.paymentReference}</strong>
                                </div>
                              )}
                            </div>

                            {/* IP Address with Quick Copy */}
                            {unit.ipAddress && (
                              <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-400 pt-1 border-t border-slate-700/60">
                                <span className="text-[9.5px] uppercase font-bold text-slate-400">IP:</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyIp(unit.ipAddress!)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700/80 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
                                  title="Click to copy IP for Block List"
                                >
                                  <span className="font-semibold">{unit.ipAddress}</span>
                                  {copiedIp === unit.ipAddress ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-400" />
                                  )}
                                </button>
                                {copiedIp === unit.ipAddress && (
                                  <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>
                                )}
                                {bannedIps.some(b => b.ipAddress === unit.ipAddress) && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                    BANNED
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 3a. Live render progress for THIS family order */}
                          {familyRenderProgress?.groupId === groupId && (
                            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-400/40 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 dark:text-purple-300">
                                <span className="flex items-center gap-1.5">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Rendering report {familyRenderProgress.index}/{familyRenderProgress.total}
                                  {familyRenderProgress.memberName ? ` — ${familyRenderProgress.memberName}` : ''}
                                </span>
                                {familyRenderProgress.bytes ? (
                                  <span>{(familyRenderProgress.bytes / 1048576).toFixed(1)} MB</span>
                                ) : null}
                              </div>
                              <div className="w-full h-1.5 bg-purple-200/60 dark:bg-purple-900/60 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-500 transition-all duration-300 rounded-full"
                                  style={{ width: `${(familyRenderProgress.index / Math.max(1, familyRenderProgress.total)) * 100}%` }}
                                />
                              </div>
                              <div className="text-[10.5px] font-semibold text-purple-700/90 dark:text-purple-300/90">
                                {familyRenderProgress.message}
                              </div>
                            </div>
                          )}

                          {/* 3. Family Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {/* Expand/Collapse Member Breakdown Button */}
                            <button
                              type="button"
                              onClick={() => toggleGroupExpand(groupId)}
                              className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-500" />}
                              <span>{isExpanded ? 'Hide Horoscopes' : `View ${unit.orders.length} Horoscopes`}</span>
                            </button>

                            {/* View Invoice live preview */}
                            <button
                              type="button"
                              onClick={() => handlePreviewFamilyInvoice(unit.orders, groupId)}
                              title="View official family tax invoice"
                              className="flex-1 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-amber-400/50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Invoice</span>
                            </button>

                            {/* Approve & Send Combined Email Button (Only when pending) */}
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleApproveFamilyGroup(groupId, unit.orders)}
                                disabled={isApprovingGroup}
                                title={`Approve all ${unit.orders.length} family charts and deliver every preview-quality report plus one consolidated invoice; large bundles may arrive in multiple emails`}
                                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                              >
                                <Send className={`w-3.5 h-3.5 ${isApprovingGroup ? 'animate-spin' : ''}`} />
                                <span>{isApprovingGroup ? 'Processing...' : `Approve (${unit.orders.length})`}</span>
                              </button>
                            )}

                            {/* Cancel Family Order if pending */}
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleCancelFamilyOrder(groupId)}
                                disabled={isCancellingGroup}
                                title="Cancel entire family order"
                                className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-40 cursor-pointer border border-rose-200 dark:border-rose-900/50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            )}

                            {/* Resend Email ONLY if email delivery failed */}
                            {unit.isAllCompleted && ((unit.emailStatus || '').toUpperCase() === 'FAILED' || (unit.emailStatus || '').toUpperCase() === 'ERROR') && (
                              <button
                                type="button"
                                onClick={() => handleResendFamilyEmail(groupId, unit.orders)}
                                disabled={isEmailingGroup}
                                title={`Email delivery failed. Click to resend family reports to ${unit.userEmail}`}
                                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                              >
                                <RotateCcw className={`w-3.5 h-3.5 ${isEmailingGroup ? 'animate-spin' : ''}`} />
                                <span>{isEmailingGroup ? 'Resending...' : 'Resend Email'}</span>
                              </button>
                            )}
                          </div>

                          {/* 4. Expanded Sub-items List (Individual Family Members) */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2.5 animate-in fade-in">
                              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5" />
                                <span>Individual User Calculations ({unit.orders.length}):</span>
                              </div>
                              <div className="space-y-2">
                                {unit.orders.map((mOrder, idx) => (
                                  <div key={mOrder.id} className="p-3 bg-slate-900/90 border border-slate-700/70 rounded-xl space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-extrabold text-xs text-white">
                                        #{idx + 1}. {mOrder.userName || mOrder.inputPayload?.name || 'User'}
                                      </span>
                                      {getLanguageBadge(mOrder.language)}
                                    </div>
                                    <div className="text-[11px] font-semibold text-amber-400">
                                      {mOrder.serviceType === 'BIRTH_JATHAGAM'
                                        ? '🪐 Janma Jathagam'
                                        : mOrder.serviceType === 'MARRIAGE_COMPATIBILITY'
                                        ? '💍 Marriage Compatibility'
                                        : mOrder.serviceType === 'BABY_NAMING'
                                        ? '👶 Baby Naming'
                                        : mOrder.serviceType === 'MUHURTHAM'
                                        ? '📅 Subha Muhurtham'
                                        : mOrder.serviceType}
                                    </div>
                                    {(mOrder.inputPayload?.dob || mOrder.inputPayload?.birthPlace) && (
                                      <div className="text-[10.5px] text-slate-400 flex flex-wrap gap-2">
                                        {mOrder.inputPayload?.dob && <span>DOB: <strong className="text-slate-200">{mOrder.inputPayload.dob}</strong></span>}
                                        {mOrder.inputPayload?.tob && <span>Time: <strong className="text-slate-200">{mOrder.inputPayload.tob}</strong></span>}
                                        {mOrder.inputPayload?.birthPlace && <span>Place: <strong className="text-slate-200">{mOrder.inputPayload.birthPlace}</strong></span>}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedOrder(mOrder)}
                                        className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 border border-slate-700 cursor-pointer"
                                      >
                                        <Eye className="w-3 h-3 text-amber-400" />
                                        <span>View Chart</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Single Order Mobile Card
                    const order = unit.mainOrder;
                    const isSendingEmail = isProcessing(`email-${order.id}`);
                    const isCancelling = isProcessing(order.id);
                    const orderItems = order.items || [];
                    const isMultiPerson = isMultiPersonUnit(order);
                    const isItemsExpanded = !!expandedItemOrderIds[order.id];

                    return (
                      <div key={order.id} className="p-4 space-y-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        {/* 1. Header: Order #, Language, Status */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-700/60 px-2.5 py-1 rounded-lg shadow-2xs">
                              #{order.orderNumber || order.id}
                            </span>
                            {getLanguageBadge(order.language)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {getStatusBadge(order.status)}
                            {((order.emailStatus || '').toUpperCase() === 'FAILED' || (order.emailStatus || '').toUpperCase() === 'ERROR') && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40" title="Email delivery failed">
                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                <span>Email Failed</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Customer & Service Details */}
                        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-extrabold text-[#fffdfa] tracking-tight">
                              {order.userName || order.inputPayload?.name || 'User'}
                            </span>
                            {order.country && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-700/80 text-amber-300 border border-slate-600">
                                {order.country}
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-bold text-amber-400">
                            {isMultiPerson
                              ? `👪 Multi-Person Order (${orderItems.length} report${orderItems.length === 1 ? '' : 's'})`
                              : serviceDisplayName(order.serviceType)}
                          </div>

                          {/* Micro birth details */}
                          {(order.inputPayload?.dob || order.inputPayload?.birthPlace) && (
                            <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 pt-0.5 font-sans">
                              {order.inputPayload?.dob && (
                                <span>
                                  <span className="text-[9.5px] uppercase font-bold text-slate-400">DOB:</span>{' '}
                                  <strong className="font-bold text-slate-200">{order.inputPayload.dob}</strong>
                                </span>
                              )}
                              {order.inputPayload?.tob && (
                                <span>
                                  <span className="text-[9.5px] uppercase font-bold text-slate-400">Time:</span>{' '}
                                  <strong className="font-bold text-slate-200">{order.inputPayload.tob}</strong>
                                </span>
                              )}
                              {order.inputPayload?.birthPlace && (
                                <span className="truncate max-w-[200px]">
                                  <span className="text-[9.5px] uppercase font-bold text-slate-400">Place:</span>{' '}
                                  <strong className="font-bold text-slate-200">{order.inputPayload.birthPlace}</strong>
                                </span>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-slate-300 font-mono flex items-center gap-1.5 pt-0.5">
                            <span className="truncate">{order.userEmail}</span>
                          </div>
                        </div>

                        {/* 3. Date & Payment Details Bar */}
                        <div className="flex flex-col gap-1 text-[11px] text-slate-400 px-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400">Ordered:</span>{' '}
                              <strong className="font-bold text-slate-200">
                                {order.createdAt
                                  ? new Date(order.createdAt).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : 'N/A'}
                              </strong>
                            </div>
                            {order.paymentReference && (
                              <div className="font-mono text-[11px] text-slate-400">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Ref:</span>{' '}
                                <strong className="font-bold text-amber-300">{order.paymentReference}</strong>
                              </div>
                            )}
                          </div>

                          {order.ipAddress && (
                            <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-400">
                              <span className="text-[9.5px] uppercase font-bold text-slate-500">IP:</span>
                              <button
                                type="button"
                                onClick={() => handleCopyIp(order.ipAddress!)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-700/80 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
                                title="Click to copy IP for Block List"
                              >
                                <span className="font-semibold">{order.ipAddress}</span>
                                {copiedIp === order.ipAddress ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                              {copiedIp === order.ipAddress && (
                                <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>
                              )}
                              {bannedIps.some(b => b.ipAddress === order.ipAddress) && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                  BANNED
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 4. Action Buttons (View available for all, Approve/Cancel only when pending, Resend Email only when email failed) */}
                        <div className="flex items-center gap-2 pt-0.5">
                          {/* View button to review horoscope calculations, report & invoice */}
                          <button
                            type="button"
                            onClick={() => isMultiPerson ? toggleItemsExpand(order.id) : setSelectedOrder(order)}
                            title={isMultiPerson ? 'Show every person and preview/send their reports individually' : 'View full horoscope calculations, report and invoice'}
                            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs border border-slate-200/60 dark:border-slate-700/60"
                          >
                            {isMultiPerson && isItemsExpanded
                              ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" />
                              : <Eye className="w-3.5 h-3.5 text-amber-500" />}
                            <span>{isMultiPerson ? (isItemsExpanded ? 'Hide Reports' : `${orderItems.length} Reports`) : 'View'}</span>
                          </button>

                          {/* Approve & Send (Only when pending) */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleDirectSendCustomerEmail(order)}
                              disabled={isSendingEmail}
                              title={`Approve, generate PDF report & tax invoice, and email directly to ${order.userEmail}`}
                              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                            >
                              <Send className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
                              <span>{isSendingEmail ? 'Processing...' : (isMultiPerson ? 'Approve All' : 'Approve')}</span>
                            </button>
                          )}

                          {/* Cancel button: STRICTLY ONLY when order is pending approval */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={isCancelling}
                              title="Cancel this order"
                              className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-40 cursor-pointer border border-rose-200 dark:border-rose-900/50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          )}

                          {/* Resend Email: STRICTLY ONLY if order is completed and email delivery failed */}
                          {isCompleted && ((order.emailStatus || '').toUpperCase() === 'FAILED' || (order.emailStatus || '').toUpperCase() === 'ERROR') && (
                            <button
                              type="button"
                              onClick={() => handleDirectSendCustomerEmail(order)}
                              disabled={isSendingEmail}
                              title={`Email delivery failed. Click to retry sending PDF report and tax invoice to ${order.userEmail}`}
                              className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
                              <span>{isSendingEmail ? 'Resending...' : (isMultiPerson ? 'Resend All' : 'Resend Email')}</span>
                            </button>
                          )}

                          {/* Consolidated order invoice (one document for all reports) */}
                          {isMultiPerson && (
                            <button
                              type="button"
                              onClick={() => handleDownloadOrderInvoice(order)}
                              disabled={isProcessing(`inv-${order.id}`)}
                              title="Download the ONE consolidated tax invoice for this order"
                              className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1 transition-colors border border-amber-200 dark:border-amber-800 cursor-pointer"
                            >
                              <Receipt className="w-3.5 h-3.5 text-amber-500" />
                              <span>Invoice</span>
                            </button>
                          )}
                        </div>

                        {/* People & reports: preview/send each report on its own */}
                        {isMultiPerson && isItemsExpanded && renderMultiPersonItems(order)}
                      </div>
                    );
                  })}
                </div>

                {/* 2. DESKTOP COMPUTER VIEW (Redesigned Modern Dashboard Order List for screens >= md) */}
                <div className="hidden md:block">
                  {/* Table Header Bar */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-800 tracking-wider">
                    <div className="col-span-3">Order & Language</div>
                    <div className="col-span-3">User & Astro Service</div>
                    <div className="col-span-2">Contact & Origin</div>
                    <div className="col-span-2">Payment & Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {/* Order Rows */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {groupedOrderUnits.map(unit => {
                      const normalizedStatus = (unit.status || '').toString().trim().toUpperCase();
                      const isCompleted = normalizedStatus === 'COMPLETED';
                      const isCancelled = normalizedStatus === 'CANCELLED';
                      const isPending = normalizedStatus === 'PENDING' || normalizedStatus === 'PENDING_APPROVAL';
                      const isGroup = unit.isGroup;
                      const groupId = unit.groupId || '';
                      const isExpanded = !!expandedGroupIds[groupId];
                      const isEmailFailed = (unit.emailStatus || '').toUpperCase() === 'FAILED' || (unit.emailStatus || '').toUpperCase() === 'ERROR';

                      const getLanguageDisplay = (lang?: string) => {
                        const l = (lang || 'ta').toLowerCase();
                        if (l === 'ta' || l === 'tamil') {
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60">
                              Tamil
                            </span>
                          );
                        }
                        if (l === 'hi' || l === 'hindi') {
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-300/70 dark:border-orange-700/60">
                              Hindi
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300/70 dark:border-blue-700/60">
                            English
                          </span>
                        );
                      };

                      const getStatusBadge = (st: string) => {
                        const s = st.toUpperCase();
                        if (s === 'COMPLETED') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Completed</span>
                            </span>
                          );
                        }
                        if (s === 'GENERATED') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                              <span>Generated</span>
                            </span>
                          );
                        }
                        if (s === 'PENDING' || s === 'PENDING_APPROVAL') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                              <span>Pending</span>
                            </span>
                          );
                        }
                        if (s === 'CANCELLED') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              <span>Cancelled</span>
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {st}
                          </span>
                        );
                      };

                      // --- 2A. FAMILY ORDER ROW ---
                      if (isGroup) {
                        const isApprovingGroup = isProcessing(`family-approve-${groupId}`);
                        const isEmailingGroup = isProcessing(`family-email-${groupId}`);
                        const isCancellingGroup = isProcessing(`family-cancel-${groupId}`);

                        return (
                          <div key={groupId} className="bg-amber-500/[0.03] dark:bg-amber-500/[0.04] hover:bg-amber-500/[0.07] dark:hover:bg-amber-500/[0.08] transition-all border-l-4 border-l-amber-500">
                            <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                              {/* 1. Order & Language */}
                              <div className="col-span-3 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-xs bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-2xs">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Family ({unit.orders.length})</span>
                                  </span>
                                  {getLanguageDisplay(unit.mainOrder.language)}
                                </div>
                                <div className="font-mono text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <span>ID:</span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{groupId}</span>
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span>
                                    {unit.createdAt
                                      ? new Date(unit.createdAt).toLocaleDateString('en-GB', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric'
                                        })
                                      : 'N/A'}
                                  </span>
                                </div>
                              </div>

                              {/* 2. User & Astro Service */}
                              <div className="col-span-3 space-y-1">
                                <div className="font-bold text-slate-900 dark:text-white text-sm">
                                  {unit.userName}
                                </div>
                                <div className="text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                                  <span>Bundle of {unit.orders.length} Users:</span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {unit.orders.map(o => o.userName || o.inputPayload?.name).filter(Boolean).join(', ')}
                                </div>

                                {familyRenderProgress?.groupId === groupId && (
                                  <div className="mt-2 space-y-1 p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-300">
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      <span>
                                        Rendering {familyRenderProgress.index}/{familyRenderProgress.total}
                                        {familyRenderProgress.memberName ? ` (${familyRenderProgress.memberName})` : ''}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-purple-200 dark:bg-purple-900 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-purple-600 transition-all duration-300 rounded-full"
                                        style={{ width: `${(familyRenderProgress.index / Math.max(1, familyRenderProgress.total)) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 3. Contact & Origin */}
                              <div className="col-span-2 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 truncate" title={unit.userEmail}>
                                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{unit.userEmail}</span>
                                </div>
                                {unit.country && (
                                  <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <Globe className="w-3 h-3 text-amber-500" />
                                    <span>{unit.country}</span>
                                  </div>
                                )}
                                {unit.ipAddress && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                                    <span>IP:</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyIp(unit.ipAddress!)}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                                      title="Copy IP"
                                    >
                                      <span>{unit.ipAddress}</span>
                                      {copiedIp === unit.ipAddress ? (
                                        <Check className="w-2.5 h-2.5 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-2.5 h-2.5 text-slate-400" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* 4. Payment & Status */}
                              <div className="col-span-2 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-sm text-slate-900 dark:text-amber-400">
                                    ${unit.totalAmount.toFixed(2)} {unit.currency}
                                  </span>
                                  {getStatusBadge(unit.status)}
                                </div>
                                {unit.paymentReference && (
                                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                    Ref: <span className="font-semibold text-slate-700 dark:text-slate-200">{unit.paymentReference}</span>
                                  </div>
                                )}
                                {isEmailFailed && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800" title="Email delivery failed">
                                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                                    <span>Email Failed</span>
                                  </span>
                                )}
                              </div>

                              {/* 5. Actions */}
                              <div className="col-span-2">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {/* Expand/Collapse Chevron Button */}
                                  <button
                                    type="button"
                                    onClick={() => toggleGroupExpand(groupId)}
                                    title={isExpanded ? 'Hide member charts' : 'View member charts'}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    <span>{isExpanded ? 'Hide' : `${unit.orders.length} Charts`}</span>
                                  </button>

                                  {/* Consolidated Invoice Preview */}
                                  <button
                                    type="button"
                                    onClick={() => handlePreviewFamilyInvoice(unit.orders, groupId)}
                                    title="View Consolidated Family Invoice"
                                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-1 transition-colors border border-amber-200 dark:border-amber-800 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Invoice</span>
                                  </button>

                                  {/* Approve All when pending */}
                                  {isPending && (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveFamilyGroup(groupId, unit.orders)}
                                      disabled={isApprovingGroup}
                                      title={`Approve all ${unit.orders.length} charts, generate PDFs, and send email`}
                                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                                    >
                                      <Send className={`w-3.5 h-3.5 ${isApprovingGroup ? 'animate-spin' : ''}`} />
                                      <span>{isApprovingGroup ? 'Processing...' : `Approve All (${unit.orders.length})`}</span>
                                    </button>
                                  )}

                                  {/* Resend Email button ONLY when completed and email delivery failed */}
                                  {unit.isAllCompleted && isEmailFailed && (
                                    <button
                                      type="button"
                                      onClick={() => handleResendFamilyEmail(groupId, unit.orders)}
                                      disabled={isEmailingGroup}
                                      title={`Email delivery failed. Click to resend family reports to ${unit.userEmail}`}
                                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                                    >
                                      <RotateCcw className={`w-3.5 h-3.5 ${isEmailingGroup ? 'animate-spin' : ''}`} />
                                      <span>{isEmailingGroup ? 'Resending...' : 'Resend Email'}</span>
                                    </button>
                                  )}

                                  {/* Cancel Family Order Button if pending */}
                                  {isPending && (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelFamilyOrder(groupId)}
                                      disabled={isCancellingGroup}
                                      title="Cancel this family package"
                                      className="px-2 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1 transition-colors border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>Cancel</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Expanded Nested Member Cards */}
                            {isExpanded && (
                              <div className="px-6 pb-4 pt-1 bg-slate-50/70 dark:bg-slate-900/70 border-t border-amber-200/40 dark:border-amber-900/40">
                                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
                                  <div className="text-xs font-bold text-slate-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <Package className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Included Member Horoscopes ({unit.orders.length}):</span>
                                  </div>
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                                    {unit.orders.map((mOrder, idx) => (
                                      <div key={mOrder.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">#{idx + 1}.</span>
                                            <span className="font-bold text-slate-900 dark:text-white text-xs">{mOrder.userName || mOrder.inputPayload?.name || 'User'}</span>
                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                              ({mOrder.serviceType === 'BIRTH_JATHAGAM'
                                                ? '🪐 Janma Jathagam'
                                                : mOrder.serviceType === 'MARRIAGE_COMPATIBILITY'
                                                ? '💍 Marriage Compatibility'
                                                : mOrder.serviceType === 'BABY_NAMING'
                                                ? '👶 Baby Naming'
                                                : mOrder.serviceType === 'MUHURTHAM'
                                                ? '📅 Subha Muhurtham'
                                                : mOrder.serviceType})
                                            </span>
                                          </div>
                                          {(mOrder.inputPayload?.dob || mOrder.inputPayload?.birthPlace) && (
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 pl-4 flex-wrap">
                                              {mOrder.inputPayload?.dob && <span>DOB: <strong className="text-slate-700 dark:text-slate-200">{mOrder.inputPayload.dob}</strong></span>}
                                              {mOrder.inputPayload?.tob && <span>Time: <strong className="text-slate-700 dark:text-slate-200">{mOrder.inputPayload.tob}</strong></span>}
                                              {mOrder.inputPayload?.birthPlace && <span>Place: <strong className="text-slate-700 dark:text-slate-200">{mOrder.inputPayload.birthPlace}</strong></span>}
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedOrder(mOrder)}
                                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs shrink-0"
                                        >
                                          <Eye className="w-3 h-3 text-amber-500" />
                                          <span>View Chart</span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // --- 2B. SINGLE ORDER ROW ---
                      const order = unit.mainOrder;
                      const isSendingEmail = isProcessing(`email-${order.id}`);
                      const isCancelling = isProcessing(order.id);
                      const orderItems = order.items || [];
                      const isMultiPerson = isMultiPersonUnit(order);
                      const isItemsExpanded = !!expandedItemOrderIds[order.id];
                      const singleEmailFailed = ((order.emailStatus || '').toUpperCase() === 'FAILED' || (order.emailStatus || '').toUpperCase() === 'ERROR');

                      return (
                        <div key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all">
                          <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                            {/* 1. Order & Language */}
                            <div className="col-span-3 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-extrabold text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-md shadow-2xs">
                                  #{order.orderNumber || order.id}
                                </span>
                                {getLanguageDisplay(order.language)}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>
                                  {order.createdAt
                                    ? new Date(order.createdAt).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })
                                    : 'N/A'}
                                  {order.createdAt
                                    ? ` · ${new Date(order.createdAt).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                      })}`
                                    : ''}
                                </span>
                              </div>
                            </div>

                            {/* 2. User & Astro Service */}
                            <div className="col-span-3 space-y-1">
                              <div className="font-bold text-slate-900 dark:text-white text-sm">
                                {order.userName || order.inputPayload?.name || 'User'}
                              </div>
                              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                {isMultiPerson
                                  ? `👪 Multi-Person Order (${orderItems.length} report${orderItems.length === 1 ? '' : 's'})`
                                  : serviceDisplayName(order.serviceType)}
                              </div>
                              {(order.inputPayload?.dob || order.inputPayload?.birthPlace) && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                                  {order.inputPayload?.dob && (
                                    <span>
                                      DOB: <strong className="text-slate-700 dark:text-slate-200">{order.inputPayload.dob}</strong>
                                    </span>
                                  )}
                                  {order.inputPayload?.tob && (
                                    <span>
                                      Time: <strong className="text-slate-700 dark:text-slate-200">{order.inputPayload.tob}</strong>
                                    </span>
                                  )}
                                  {order.inputPayload?.birthPlace && (
                                    <span className="truncate max-w-[150px]" title={order.inputPayload.birthPlace}>
                                      Place: <strong className="text-slate-700 dark:text-slate-200">{order.inputPayload.birthPlace}</strong>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* 3. Contact & Origin */}
                            <div className="col-span-2 space-y-1">
                              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 truncate" title={order.userEmail}>
                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{order.userEmail}</span>
                              </div>
                              {order.country && (
                                <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                  <Globe className="w-3 h-3 text-amber-500" />
                                  <span>{order.country}</span>
                                </div>
                              )}
                              {order.ipAddress && (
                                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                                  <span>IP:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyIp(order.ipAddress!)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                                    title="Copy IP"
                                  >
                                    <span>{order.ipAddress}</span>
                                    {copiedIp === order.ipAddress ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5 text-slate-400" />
                                    )}
                                  </button>
                                  {bannedIps.some(b => b.ipAddress === order.ipAddress) && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500/20 text-rose-500 border border-rose-500/40">
                                      BANNED
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* 4. Payment & Status */}
                            <div className="col-span-2 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-slate-900 dark:text-amber-400">
                                  ${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'} {order.currency || 'USD'}
                                </span>
                                {getStatusBadge(order.status)}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                Ref: <span className="font-semibold text-slate-700 dark:text-slate-200">{order.paymentReference || order.orderNumber || order.id || 'N/A'}</span>
                              </div>
                              {singleEmailFailed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800" title="Email delivery failed">
                                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                                  <span>Email Failed</span>
                                </span>
                              )}
                            </div>

                            {/* 5. Actions */}
                            <div className="col-span-2">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {/* View Button (Available for all orders) */}
                                <button
                                  type="button"
                                  onClick={() => isMultiPerson ? toggleItemsExpand(order.id) : setSelectedOrder(order)}
                                  title={isMultiPerson ? 'Show every person and preview/send their reports individually' : 'View full horoscope details, predictions, report and invoice'}
                                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs border border-slate-200 dark:border-slate-700"
                                >
                                  {isMultiPerson && isItemsExpanded
                                    ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" />
                                    : <Eye className="w-3.5 h-3.5 text-amber-500" />}
                                  <span>{isMultiPerson ? (isItemsExpanded ? 'Hide Reports' : `${orderItems.length} Reports`) : 'View'}</span>
                                </button>

                                {/* Approve Button (Shown when pending) */}
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => handleDirectSendCustomerEmail(order)}
                                    disabled={isSendingEmail}
                                    title={`Approve, generate Vedic PDF report and invoice, emailing to ${order.userEmail}`}
                                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                                  >
                                    <Send className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
                                    <span>{isSendingEmail ? 'Processing...' : (isMultiPerson ? 'Approve All' : 'Approve')}</span>
                                  </button>
                                )}

                                {/* Resend Email button ONLY when completed and email delivery failed */}
                                {isCompleted && singleEmailFailed && (
                                  <button
                                    type="button"
                                    onClick={() => handleDirectSendCustomerEmail(order)}
                                    disabled={isSendingEmail}
                                    title={`Email delivery failed. Click to retry emailing official PDF report & invoice to ${order.userEmail}`}
                                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                                  >
                                    <RotateCcw className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
                                    <span>{isSendingEmail ? 'Resending...' : (isMultiPerson ? 'Resend All' : 'Resend Email')}</span>
                                  </button>
                                )}

                                {/* Cancel Button (Shown only when pending) */}
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelOrder(order.id)}
                                    disabled={isCancelling}
                                    title="Cancel this order"
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1 transition-colors border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Cancel</span>
                                  </button>
                                )}

                                {/* Consolidated order invoice (one document for all reports) */}
                                {isMultiPerson && (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadOrderInvoice(order)}
                                    disabled={isProcessing(`inv-${order.id}`)}
                                    title="Download the ONE consolidated tax invoice for this order"
                                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-1 transition-colors border border-amber-200 dark:border-amber-800 cursor-pointer"
                                  >
                                    <Receipt className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Invoice</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* People & reports: preview/send each report on its own */}
                          {isMultiPerson && isItemsExpanded && renderMultiPersonItems(order)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SECTION: ANALYTICS DASHBOARD */}
      {activeSection === 'errors' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Request error alerts</h2><p className="text-sm text-slate-500">Failed and unanswered API requests reported by visitors. Alerts remain open until you resolve them.</p></div>
            <button onClick={() => api.getAdminClientErrors().then(r => r.success && setClientErrors(r.errors || []))} className="px-3 py-2 rounded-lg border flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Refresh</button></div>
          {clientErrors.length === 0 ? <div className="rounded-xl border p-8 text-center text-slate-500">No request errors have been reported.</div> : <div className="space-y-3">{clientErrors.map((e: any) => <article key={e.id} className={`rounded-xl border p-4 ${e.resolvedAt ? 'opacity-60 bg-slate-50' : 'border-red-200 bg-red-50/50'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{e.resolvedAt ? 'Resolved' : 'Open'}{e.status ? ` · HTTP ${e.status}` : ''}</div><p className="mt-1 text-sm">{e.message}</p><code className="text-xs text-slate-500 break-all">{e.endpoint}</code><div className="mt-1 text-xs text-slate-500">Reported {new Date(e.createdAt).toLocaleString()}</div></div>
            {!e.resolvedAt && <button onClick={async () => { await api.resolveAdminClientError(e.id); const r = await api.getAdminClientErrors(); if (r.success) setClientErrors(r.errors || []); }} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm flex items-center gap-2"><Check className="w-4 h-4"/>Mark resolved</button>}</div></article>)}</div>}
        </section>
      )}

      {activeSection === 'analytics' && (
        <AdminAnalyticsDashboard
          onRefreshOrders={fetchAdminData}
          onNavigateTab={tab => setActiveSection(tab as any)}
        />
      )}

      {/* SECTION: FINANCIAL DASHBOARD */}
      {activeSection === 'financial' && (
        <FinancialDashboard onRefreshOrders={fetchAdminData} />
      )}

      {/* SECTION: PAYMENT GATEWAY CONFIGURATION */}
      {activeSection === 'payments' && (
        <PaymentConfigPanel
          settings={settings}
          onUpdateSettings={handleUpdateSettingsGeneric}
        />
      )}

      {/* SECTION: EMAIL & SMTP CONFIGURATION */}
      {activeSection === 'emails' && (
        <EmailConfigPanel
          settings={settings}
          onUpdateSettings={handleUpdateSettingsGeneric}
        />
      )}

      {/* SECTION: WHATSAPP & VIBER CHAT ALERTS */}
      {activeSection === 'alerts' && (
        <ChatAlertConfigPanel
          settings={settings}
          onUpdateSettings={handleUpdateSettingsGeneric}
        />
      )}

      {/* SECTION: DATABASE BACKUP & RESTORE */}
      {activeSection === 'database' && (
        <DatabaseBackupPanel onDataImported={fetchAdminData} />
      )}

      {/* SECTION: ADMIN SETUP CHECKLIST */}
      {activeSection === 'checklist' && (
        <SetupChecklistPanel
          settings={settings}
          teamMembers={teamMembers}
          onNavigateTab={tab => setActiveSection(tab as any)}
        />
      )}

      {/* SECTION 2: ASTROLOGY TEAM MANAGEMENT */}
      {activeSection === 'team' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                India-Based Astrology & Sivachariyar Team Members
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add, edit, or manage 10 or more/less team scholars. Active members are displayed on the public ASTRO SIVAM website.
              </p>
            </div>

            <button
              onClick={handleOpenAddTeamModal}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Team Member</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Member & Photo</th>
                    <th className="px-4 py-3">Designation / Title</th>
                    <th className="px-4 py-3">Education & Credentials</th>
                    <th className="px-4 py-3">Experience</th>
                    <th className="px-4 py-3">Specializations</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {teamMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No team members configured yet. Click &ldquo;Add New Team Member&rdquo; above.
                      </td>
                    </tr>
                  ) : (
                    teamMembers.map(member => {
                      const name = member.nameEn || member.fullName || 'Team Member';
                      const title = member.titleEn || member.vedicEducation || 'Astrologer';
                      const edu = member.educationEn || member.education || member.vedicEducation || '-';
                      const exp = member.experienceYears ?? member.yearsOfExperience ?? 15;
                      const specs = Array.isArray(member.specializations)
                        ? member.specializations
                        : typeof member.specialization === 'string'
                        ? member.specialization.split(',').map(s => s.trim()).filter(Boolean)
                        : [];

                      return (
                        <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-amber-500/30 shrink-0 p-1 flex items-center justify-center">
                                <img
                                  src={member.photoUrl && !member.photoUrl.includes('unsplash.com') ? member.photoUrl : logoImg}
                                  alt={name}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{name}</div>
                                {member.nameTa && <div className="text-[10px] text-amber-600 dark:text-amber-400">{member.nameTa}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{title}</div>
                            {member.titleTa && <div className="text-[10px] text-slate-400">{member.titleTa}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-700 dark:text-slate-300">{edu}</div>
                            {member.educationTa && <div className="text-[10px] text-slate-400">{member.educationTa}</div>}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {exp} Years
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <div className="flex flex-wrap gap-1">
                              {specs.map((spec, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleMemberActive(member)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                              member.isActive
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>{member.isActive ? 'Active' : 'Hidden'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditTeamModal(member)}
                              title="Edit Member"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTeamMember(member.id, member.fullName || member.nameEn || member.name)}
                              title="Delete Member"
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: SETTINGS & PRICING */}
      {activeSection === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            System Operating Mode & Pricing Settings
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Service Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                Active Service Mode:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setServiceMode('FREE_BETA')}
                  className={`p-4 rounded-2xl border text-left space-y-1 ${
                    serviceMode === 'FREE_BETA'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>★ FREE BETA TESTING</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    1 free report per customer (per IP address): the first chart of a customer's first order is free — in a family order only member 1 is free and the rest pay the standard price. Later orders from the same IP are paid.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setServiceMode('PAID')}
                  className={`p-4 rounded-2xl border text-left space-y-1 ${
                    serviceMode === 'PAID'
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-200'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>PAID SERVICE MODE</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Enforce payment verification via GPay, M-PAiSA, or PayPal.
                  </p>
                </button>
              </div>
            </div>

            {/* Base Pricing fields */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Default Base Rates (by Country / Currency):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setServicePricing({
                      BIRTH_JATHAGAM: { fjd: Number(fijiPrice), usd: Number(intlPrice), inr: Number(indiaPrice) },
                      MARRIAGE_COMPATIBILITY: { fjd: Number(fijiPrice), usd: Number(intlPrice), inr: Number(indiaPrice) },
                      BABY_NAMING: { fjd: Number(fijiPrice), usd: Number(intlPrice), inr: Number(indiaPrice) },
                      MUHURTHAM: { fjd: Number(fijiPrice), usd: Number(intlPrice), inr: Number(indiaPrice) }
                    });
                    setSuccessMessage('Base rates applied to all 4 astrological services! Click Save Settings below.');
                    setTimeout(() => setSuccessMessage(''), 4000);
                  }}
                  className="text-xs px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold cursor-pointer w-fit"
                >
                  ⚡ Apply Base Rates To All Services
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Fiji Resident (FJ$):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={fijiPrice}
                    onChange={e => setFijiPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <span className="text-[10px] text-slate-400">Vodafone M-PAiSA</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    India Domestic (₹ INR):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={indiaPrice}
                    onChange={e => setIndiaPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                  />
                  <span className="text-[10px] text-slate-400">Google Pay / UPI</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    International (US$):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={intlPrice}
                    onChange={e => setIntlPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <span className="text-[10px] text-slate-400">PayPal International</span>
                </div>
              </div>
            </div>

            {/* Individual Service Pricing Override Matrix */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    <span>Per-Service Individual Pricing Setup</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Fix the price for each astrological service separately across Fiji (FJ$), India (₹ INR), and International (US$).
                  </p>
                </div>
              </div>

              {/* Service 1: Birth Jathagam */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>1. Birth Jathagam (Complete Life Horoscope)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">3 Pages</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Fiji (FJ$)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.BIRTH_JATHAGAM?.fjd ?? 35}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        BIRTH_JATHAGAM: { ...servicePricing.BIRTH_JATHAGAM, fjd: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">India (₹ INR)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.BIRTH_JATHAGAM?.inr ?? 499}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        BIRTH_JATHAGAM: { ...servicePricing.BIRTH_JATHAGAM, inr: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">International (US$)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.BIRTH_JATHAGAM?.usd ?? 18}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        BIRTH_JATHAGAM: { ...servicePricing.BIRTH_JATHAGAM, usd: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Service 2: Marriage Compatibility */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>2. Marriage Compatibility (10 Poruthams)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold">1 Page</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Fiji (FJ$)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.MARRIAGE_COMPATIBILITY?.fjd ?? 45}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        MARRIAGE_COMPATIBILITY: { ...servicePricing.MARRIAGE_COMPATIBILITY, fjd: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">India (₹ INR)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.MARRIAGE_COMPATIBILITY?.inr ?? 699}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        MARRIAGE_COMPATIBILITY: { ...servicePricing.MARRIAGE_COMPATIBILITY, inr: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">International (US$)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.MARRIAGE_COMPATIBILITY?.usd ?? 22}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        MARRIAGE_COMPATIBILITY: { ...servicePricing.MARRIAGE_COMPATIBILITY, usd: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Service 3: Baby Naming */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>3. Baby Naming (Vedic Namakaran)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">1 Page</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Fiji (FJ$)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.BABY_NAMING?.fjd ?? 30}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        BABY_NAMING: { ...servicePricing.BABY_NAMING, fjd: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">India (₹ INR)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.BABY_NAMING?.inr ?? 399}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        BABY_NAMING: { ...servicePricing.BABY_NAMING, inr: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">International (US$)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.BABY_NAMING?.usd ?? 15}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        BABY_NAMING: { ...servicePricing.BABY_NAMING, usd: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Service 4: Subha Muhurtham */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>4. Subha Muhurtham (6-Month Dates)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">2 Pages</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Fiji (FJ$)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.MUHURTHAM?.fjd ?? 40}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        MUHURTHAM: { ...servicePricing.MUHURTHAM, fjd: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">India (₹ INR)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.MUHURTHAM?.inr ?? 599}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        MUHURTHAM: { ...servicePricing.MUHURTHAM, inr: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">International (US$)</label>
                    <input
                      type="number"
                      min="0"
                      value={servicePricing.MUHURTHAM?.usd ?? 20}
                      onChange={e => setServicePricing({
                        ...servicePricing,
                        MUHURTHAM: { ...servicePricing.MUHURTHAM, usd: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Automated Email delivery toggle */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="autoEmailToggle"
                checked={autoEmail}
                onChange={e => setAutoEmail(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="autoEmailToggle" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                Automatically email PDF report to customer upon admin approval
              </label>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              Save System Settings
            </button>
          </form>

          {/* Shortcuts to Payment Gateways & Social Setup */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 gap-4">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    3 Payment Systems — Offline &amp; Online Mode Control
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Switch India GPay, International PayPal, and Fiji Vodafone M-PAiSA between Offline and Online modes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('payments')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  Open Payment Gateways &rarr;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">1. India GPay</span>
                  <span className={`px-2 py-0.5 rounded font-extrabold uppercase text-[10px] ${
                    settings?.indiaGpayPaymentMode === 'online'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  }`}>
                    {settings?.indiaGpayPaymentMode === 'online' ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">2. PayPal</span>
                  <span className={`px-2 py-0.5 rounded font-extrabold uppercase text-[10px] ${
                    settings?.paypalPaymentMode === 'online'
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  }`}>
                    {settings?.paypalPaymentMode === 'online' ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">3. M-PAiSA</span>
                  <span className={`px-2 py-0.5 rounded font-extrabold uppercase text-[10px] ${
                    settings?.vodafoneMPaisaPaymentMode === 'online'
                      ? 'bg-red-500/20 text-red-600 dark:text-red-300'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  }`}>
                    {settings?.vodafoneMPaisaPaymentMode === 'online' ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/50">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Google Sign-In Setup
                </p>
                <p className="text-[11px] text-slate-500">
                  Configure Google Web Client ID.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('google')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Configure &rarr;
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SECTION: GOOGLE SIGN-IN SETUP & CLOUD GUIDE */}
      {activeSection === 'google' && (
        <GoogleSetupPanel />
      )}

      {/* SECTION 4: USER ACCOUNTS */}
      {activeSection === 'users' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">User Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Saved Birth Profile</th>
                  <th className="px-4 py-3">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(usersList || []).map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {u.mobile || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        u.role === 'ADMIN' || u.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.birthProfile ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          ✓ {u.birthProfile.birthPlace} ({u.birthProfile.dob})
                        </span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: CONTACT INQUIRIES & MESSAGES */}
      {activeSection === 'messages' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-500" />
                <span>Public Inquiries & Contact Messages ({messagesList.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Messages submitted via the public contact portal. Automatically dispatched to administrative email (admin@astrosivam.com / Mohanwalaja@gmail.com).
              </p>
            </div>
            <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1 rounded-full font-bold self-start sm:self-auto">
              Auto Email Routing Active
            </div>
          </div>

          {messagesList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold">No contact inquiries yet</p>
              <p className="text-xs text-slate-500">Messages sent via the Contact page will appear here instantly.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messagesList.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3 transition-all hover:border-purple-400/50 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm">
                        {msg.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{msg.name}</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            msg.status === 'NEW'
                              ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                              : msg.status === 'REVIEWED'
                              ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                          }`}>
                            {msg.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{msg.email}</span>
                          <span>•</span>
                          <span>{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <a
                        href={`mailto:${msg.email}?subject=Re:%20FIJIASTRO%20-%20${encodeURIComponent(msg.subject)}`}
                        onClick={() => handleUpdateMessageStatus(msg.id, 'RESPONDED')}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <Send className="w-3 h-3" />
                        <span>Reply to User</span>
                      </a>
                      {msg.status !== 'REVIEWED' && msg.status !== 'RESPONDED' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateMessageStatus(msg.id, 'REVIEWED')}
                          className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Mark Reviewed
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id, msg.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Delete inquiry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-900 dark:text-amber-400">
                      Subject: {msg.subject}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900/80 p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                      {msg.message}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1">
                    {msg.autoEmailDispatched ? (
                      <>
                        <span className="text-emerald-500 font-semibold">✓ Accepted by Admin Email:</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">{msg.dispatchedTo}</span>
                        {msg.emailDispatchedAt && <span>({new Date(msg.emailDispatchedAt).toLocaleString()})</span>}
                      </>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">Saved in Admin Inbox — email notification was not sent.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: AUDIT LOGS */}
      {activeSection === 'logs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            System Event & Security Audit Trail
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-[11px]">
            {(auditLogs || []).map((log, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between"
              >
                <div className="space-x-2">
                  <span className="text-purple-600 dark:text-purple-400 font-bold">[{log.action}]</span>
                  <span className="text-slate-700 dark:text-slate-300">{log.details}</span>
                </div>
                <div className="text-slate-400 text-[10px] shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 6: SECURITY & BANNED IPS */}
      {activeSection === 'security' && (
        <SecurityBannedIpPanel
          bannedIps={bannedIps}
          onRefresh={fetchAdminData}
          onSetSuccess={(msg) => {
            setSuccessMessage(msg);
            setTimeout(() => setSuccessMessage(''), 5000);
          }}
          onSetError={(msg) => {
            setErrorMessage(msg);
            setTimeout(() => setErrorMessage(''), 6000);
          }}
        />
      )}

      {/* Order Inspection Modal */}
      {selectedOrder && (
        <OrderReportModal
          order={selectedOrder}
          isOpen={true}
          familyOrders={
            selectedOrder.groupId
              ? orders.filter(o => o.groupId === selectedOrder.groupId)
              : undefined
          }
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={(updated) => {
            setSelectedOrder(updated);
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
          }}
        />
      )}

      {/* Per-REPORT preview of a multi-person order: same cached result as Send */}
      {reportItemView && (
        <OrderReportModal
          order={reportItemView.chartOrder}
          isOpen={true}
          orderItemSend={{
            orderId: reportItemView.header.id,
            itemId: reportItemView.item.id,
            header: reportItemView.header
          }}
          onClose={() => setReportItemView(null)}
          onItemSent={(itemId) => {
            setOrders(prev => prev.map(o => o.id === reportItemView.header.id ? {
              ...o,
              items: (o.items || []).map(candidate => candidate.id === itemId
                ? { ...candidate, reportStatus: 'SENT' as any }
                : candidate)
            } : o));
          }}
          onOrderUpdated={(updated) => {
            setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
          }}
        />
      )}

      {/* Direct High-Resolution Live PDF Preview Modal for Testing */}
      {previewOrderForPdf && (
        <LivePdfPreviewModal
          isOpen={Boolean(previewOrderForPdf)}
          onClose={() => setPreviewOrderForPdf(null)}
          serviceType={previewOrderForPdf.serviceType}
          order={previewOrderForPdf}
          familyOrders={
            previewOrderForPdf.groupId
              ? orders.filter(o => o.groupId === previewOrderForPdf.groupId)
              : undefined
          }
          result={previewOrderForPdf.calculatedResult}
          initialLang={previewOrderForPdf.language}
          title={`ADMIN LIVE PDF PREVIEW: ${previewOrderForPdf.orderNumber} (${previewOrderForPdf.userName})`}
          sourceContext="admin_testing"
          onOrderUpdated={(updated) => {
            setPreviewOrderForPdf(updated);
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
          }}
        />
      )}

      {/* High-Quality Consolidated Family Tax Invoice — Live Preview */}
      {familyInvoicePreview && (
        <LivePdfPreviewModal
          isOpen={Boolean(familyInvoicePreview)}
          onClose={() => setFamilyInvoicePreview(null)}
          serviceType="INVOICE"
          order={familyInvoicePreview.orders[0]}
          familyOrders={familyInvoicePreview.orders}
          initialLang={familyInvoicePreview.orders[0]?.language || 'en'}
          title={`FAMILY TAX INVOICE — GROUP ${familyInvoicePreview.groupId} (${familyInvoicePreview.orders.length} MEMBERS)`}
          sourceContext="order_inspection"
          onOrderUpdated={(updated) => {
            setOrders(prev => prev.map(o => o.groupId === familyInvoicePreview.groupId ? { ...o, status: updated.status, emailStatus: updated.emailStatus } : o));
          }}
        />
      )}

      {/* Add / Edit Team Member Modal */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingMember ? 'Edit Astrology Team Member' : 'Add Astrology Team Member'}
                </h3>
              </div>
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeamMember} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={memberFormData.nameEn}
                    onChange={e => setMemberFormData({ ...memberFormData, nameEn: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    placeholder="e.g. Astrologer S. Sivaprakash"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Name (Tamil)
                  </label>
                  <input
                    type="text"
                    value={memberFormData.nameTa}
                    onChange={e => setMemberFormData({ ...memberFormData, nameTa: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    placeholder="சிவாச்சாரியார் ஆர். வெங்கடேச குருக்கள்"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Name (Hindi)
                  </label>
                  <input
                    type="text"
                    value={memberFormData.nameHi}
                    onChange={e => setMemberFormData({ ...memberFormData, nameHi: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    placeholder="शिवाचार्य आर. वेंकटेश गुरुकल"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Title / Designation (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={memberFormData.titleEn}
                    onChange={e => setMemberFormData({ ...memberFormData, titleEn: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Title / Designation (Tamil)
                  </label>
                  <input
                    type="text"
                    value={memberFormData.titleTa}
                    onChange={e => setMemberFormData({ ...memberFormData, titleTa: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Photo URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={memberFormData.photoUrl}
                    onChange={e => setMemberFormData({ ...memberFormData, photoUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Experience (Years) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={memberFormData.experienceYears}
                    onChange={e => setMemberFormData({ ...memberFormData, experienceYears: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Education & Credentials (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={memberFormData.educationEn}
                    onChange={e => setMemberFormData({ ...memberFormData, educationEn: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Education & Credentials (Tamil)
                  </label>
                  <input
                    type="text"
                    value={memberFormData.educationTa}
                    onChange={e => setMemberFormData({ ...memberFormData, educationTa: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Specializations (Comma separated) *
                </label>
                <input
                  type="text"
                  required
                  value={memberFormData.specializations}
                  onChange={e => setMemberFormData({ ...memberFormData, specializations: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  placeholder="Birth Jathagam, 10 Poruthams, Baby Naming, Subha Muhurtham, Sade Sati Remedies"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Bio Summary (English)
                  </label>
                  <textarea
                    rows={2}
                    value={memberFormData.bioEn}
                    onChange={e => setMemberFormData({ ...memberFormData, bioEn: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Bio Summary (Tamil)
                  </label>
                  <textarea
                    rows={2}
                    value={memberFormData.bioTa}
                    onChange={e => setMemberFormData({ ...memberFormData, bioTa: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberFormData.isActive}
                      onChange={e => setMemberFormData({ ...memberFormData, isActive: e.target.checked })}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                    />
                    <span>Active & Visible on Website</span>
                  </label>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>Order:</span>
                    <input
                      type="number"
                      value={memberFormData.order}
                      onChange={e => setMemberFormData({ ...memberFormData, order: Number(e.target.value) })}
                      className="w-16 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTeamModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md"
                  >
                    {editingMember ? 'Update Member' : 'Add Member'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
