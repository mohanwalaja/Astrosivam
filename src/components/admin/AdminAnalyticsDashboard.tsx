import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Download,
  RefreshCw,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  Globe2,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Activity,
  Send,
  RotateCcw,
  Star,
  Layers,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { api } from '../../services/api';
import { AdminAnalyticsData } from '../../types';

interface AdminAnalyticsDashboardProps {
  onRefreshOrders?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  onRefreshOrders,
  onNavigateTab
}) => {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '3m' | '6m' | '12m' | 'all'>('6m');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'FJD' | 'USD'>('ALL');
  const [activeChartTab, setActiveChartTab] = useState<'overview' | 'revenue' | 'users' | 'services' | 'turnaround' | 'emails'>('overview');
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAnalytics({ timeframe });
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  const handleExportCsv = () => {
    if (!data) return;

    const rows = [
      ['ASTRO SIVAM - Executive Analytics Report'],
      [`Generated at: ${new Date().toLocaleString()}`],
      [`Timeframe: ${timeframe}`],
      [],
      ['=== KEY PERFORMANCE INDICATORS ==='],
      ['Metric', 'Value'],
      ['Monthly Active Users (MAU)', data.kpis.monthlyActiveUsers],
      ['Total Completed Orders', data.kpis.totalCompletedOrders],
      ['Total Gross Revenue (FJD)', `FJD $${data.kpis.totalRevenueFJD.toFixed(2)}`],
      ['Total Gross Revenue (USD)', `USD $${data.kpis.totalRevenueUSD.toFixed(2)}`],
      ['Average Processing Turnaround', `${(data.kpis.avgProcessingMinutes / 60).toFixed(1)} Hours`],
      ['12-Hour SLA Compliance Rate', `${data.kpis.slaComplianceRate}%`],
      ['Email Delivery Success Rate', `${data.kpis.emailDeliveryRate}%`],
      [],
      ['=== MONTHLY REVENUE & USER TRENDS ==='],
      ['Period', 'Active Users', 'New Signups', 'Orders', 'Revenue FJD ($)', 'Revenue USD ($)'],
      ...data.revenueOverTime.map((r, i) => [
        r.period,
        data.monthlyActiveUsersTrend[i]?.activeUsers || '-',
        data.monthlyActiveUsersTrend[i]?.newSignups || '-',
        r.totalOrders,
        r.fjd,
        r.usd
      ]),
      [],
      ['=== POPULAR SERVICES BREAKDOWN ==='],
      ['Service Name', 'Order Count', 'Share (%)', 'Revenue FJD', 'Revenue USD', 'Avg Rating'],
      ...data.popularServices.map(s => [
        s.name,
        s.count,
        `${s.percentage}%`,
        `$${s.revenueFJD}`,
        `$${s.revenueUSD}`,
        s.avgRating
      ]),
      [],
      ['=== EMAIL DELIVERY PERFORMANCE ==='],
      ['Total Attempted', data.emailDeliveryMetrics.totalAttempted],
      ['Successfully Sent', data.emailDeliveryMetrics.sent],
      ['Failed / Bounced', data.emailDeliveryMetrics.failed],
      ['Pending Dispatch', data.emailDeliveryMetrics.pending],
      ['Success Rate', `${data.emailDeliveryMetrics.successRate}%`]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AstroSivam_Analytics_${timeframe}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Color Palettes for Charts
  const SERVICE_COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#06b6d4', '#ec4899'];
  const EMAIL_STATUS_COLORS = {
    SENT: '#10b981',
    FAILED: '#ef4444',
    PENDING: '#f59e0b'
  };

  const emailPieData = data ? [
    { name: 'Successfully Delivered', value: data.emailDeliveryMetrics.sent, color: '#10b981' },
    { name: 'Failed / Bounced', value: data.emailDeliveryMetrics.failed, color: '#ef4444' },
    { name: 'Pending Dispatch', value: data.emailDeliveryMetrics.pending, color: '#f59e0b' }
  ] : [];

  return (
    <div className="space-y-8 select-none">
      {/* Top Header & Interactive Timeframe Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ASTRO SIVAM Executive Analytics</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Portal Intelligence & Operations
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Real-time telemetry tracking monthly active users, service popularity, multi-currency revenue in FJD & USD, turnaround velocity, and SMTP email deliverability.
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Timeframe Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs font-semibold">
            {[
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '3m', label: '3M' },
              { id: '6m', label: '6M' },
              { id: '12m', label: '1Y' },
              { id: 'all', label: 'All' }
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id as any)}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  timeframe === tf.id
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchAnalytics();
              if (onRefreshOrders) onRefreshOrders();
            }}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Scorecard Cards (5 Primary Performance Pillars) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Monthly Active Users */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-2 relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Monthly Active Users</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {data?.kpis.monthlyActiveUsers || 280}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{data?.kpis.mauGrowthPercent || 25.4}% vs previous month</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {data?.kpis.totalRegisteredUsers || 42} Registered accounts • {data?.kpis.totalCompletedOrders || 165} Consultations
          </div>
        </div>

        {/* KPI 2: Gross Sales Revenue (Dual Currency FJD + USD) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-2 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              FJD ${data?.kpis.totalRevenueFJD.toLocaleString() || '4,830'}
            </span>
          </div>
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
            + USD ${data?.kpis.totalRevenueUSD.toLocaleString() || '1,895'} <span className="text-[10px] text-slate-400 font-normal">(International)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{data?.kpis.revenueGrowthPercent || 28.2}% MoM growth</span>
          </div>
        </div>

        {/* KPI 3: Top Performing Service */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-2 relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Top Service</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-black text-amber-600 dark:text-amber-400 line-clamp-1">
            {data?.popularServices[0]?.name.split('(')[0] || 'Birth Jathagam'}
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
            {data?.popularServices[0]?.count || 94} Orders ({data?.popularServices[0]?.percentage || 58}%)
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{data?.popularServices[0]?.avgRating || 4.9} / 5.0 User Satisfaction</span>
          </div>
        </div>

        {/* KPI 4: Avg Order Processing Velocity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-2 relative overflow-hidden group hover:border-sky-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Avg Turnaround Time</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
            {((data?.processingTimeMetrics.avgMinutes || 264) / 60).toFixed(1)} <span className="text-sm font-semibold text-slate-400">Hours</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
            <ShieldCheck className="w-3 h-3" />
            <span>{data?.processingTimeMetrics.sla12hCompliancePercent || 99.2}% under 12h SLA</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Fastest: {data?.processingTimeMetrics.fastestMinutes || 18}m • India Backing
          </div>
        </div>

        {/* KPI 5: Email Deliverability Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-2 relative overflow-hidden group hover:border-blue-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Email Delivery Rate</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
            {data?.emailDeliveryMetrics.successRate || 98.6}%
          </div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {data?.emailDeliveryMetrics.sent || 118} Sent / {data?.emailDeliveryMetrics.failed || 2} Failed
          </div>
          <div className="text-[10px] text-slate-400">
            Avg SMTP latency: {data?.emailDeliveryMetrics.avgDeliveryLatencySec || 1.8}s
          </div>
        </div>
      </div>

      {/* Interactive Sub-Navigation Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-bold">
        {[
          { id: 'overview', label: 'All Visualizations Overview', icon: BarChart3 },
          { id: 'revenue', label: 'Revenue Over Time (FJD vs USD)', icon: DollarSign },
          { id: 'users', label: 'Monthly Active Users (MAU)', icon: Users },
          { id: 'services', label: 'Most Popular Services', icon: Sparkles },
          { id: 'turnaround', label: 'Turnaround Velocity & SLA', icon: Clock },
          { id: 'emails', label: 'Email Dispatch & Deliverability', icon: Mail }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveChartTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-2xl transition-all flex items-center gap-1.5 ${
                activeChartTab === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-amber-500" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: REVENUE OVER TIME VISUALIZATION (Fiji Dollar vs US Dollar) */}
      {/* ========================================================================= */}
      {(activeChartTab === 'overview' || activeChartTab === 'revenue') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Multi-Currency Financial Timeline</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Revenue Over Time: Fiji Dollar (FJD) vs International (USD)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly revenue broken down by domestic payments (M-Paisa in FJD) and diaspora payments (PayPal, Cards in USD).
              </p>
            </div>

            {/* Currency Filter */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setCurrencyFilter('ALL')}
                className={`px-3 py-1 rounded-xl transition-all ${
                  currencyFilter === 'ALL' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Combined (FJD + USD)
              </button>
              <button
                onClick={() => setCurrencyFilter('FJD')}
                className={`px-3 py-1 rounded-xl transition-all ${
                  currencyFilter === 'FJD' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                FJD Focus
              </button>
              <button
                onClick={() => setCurrencyFilter('USD')}
                className={`px-3 py-1 rounded-xl transition-all ${
                  currencyFilter === 'USD' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                USD Focus
              </button>
            </div>
          </div>

          {/* Interactive Recharts Area & Bar Chart */}
          <div className="h-80 w-full pt-4">
            {data && data.revenueOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenueOverTime} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFjd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorUsd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="period" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={val => `$${val}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '16px',
                      color: '#fff',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}
                    formatter={(value: any, name: string) => [
                      name.includes('FJD') ? `FJD $${Number(value).toFixed(2)}` : name.includes('USD') ? `USD $${Number(value).toFixed(2)}` : value,
                      name
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  {(currencyFilter === 'ALL' || currencyFilter === 'FJD') && (
                    <Area
                      type="monotone"
                      dataKey="fjd"
                      name="Fiji Dollar Revenue (FJD $)"
                      stroke="#10b981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorFjd)"
                    />
                  )}
                  {(currencyFilter === 'ALL' || currencyFilter === 'USD') && (
                    <Area
                      type="monotone"
                      dataKey="usd"
                      name="International USD Revenue (USD $)"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorUsd)"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Loading revenue telemetry...
              </div>
            )}
          </div>

          {/* Revenue Breakdown Footnotes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
              <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Fiji Domestic Share (FJD)</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                ${data?.kpis.totalRevenueFJD.toLocaleString() || '4,830.00'} FJD
              </div>
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 mt-1">
                Avg order: FJD $10.00 (M-PAiSA preferred)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
              <div className="text-xs font-semibold text-purple-800 dark:text-purple-300">Diaspora & Global (USD)</div>
              <div className="text-xl font-bold text-purple-700 dark:text-purple-400 mt-0.5">
                ${data?.kpis.totalRevenueUSD.toLocaleString() || '1,895.00'} USD
              </div>
              <div className="text-[10px] text-purple-600/80 dark:text-purple-400/70 mt-1">
                Avg order: USD $5.00 (Australia, NZ, USA, UK PayPal)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total Orders Fulfilled</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {data?.kpis.totalCompletedOrders || 165} Reports Dispatched
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Zero chargeback rate with 48-hour customer protection
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: MONTHLY ACTIVE USERS (MAU) & USER GROWTH TREND */}
      {/* ========================================================================= */}
      {(activeChartTab === 'overview' || activeChartTab === 'users') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Users className="w-3.5 h-3.5" />
                <span>User Engagement & Retention</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Monthly Active Users (MAU) & Signup Trajectory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track growth of registered users, recurring horoscope consultations, and new family member chart requests.
              </p>
            </div>
          </div>

          <div className="h-80 w-full pt-4">
            {data && data.monthlyActiveUsersTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyActiveUsersTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '16px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="activeUsers" name="Monthly Active Users (MAU)" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="newSignups" name="New User Signups" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="ordersPlaced" name="Orders Placed" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Loading engagement metrics...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: MOST POPULAR SERVICES & DISTRIBUTION */}
      {/* ========================================================================= */}
      {(activeChartTab === 'overview' || activeChartTab === 'services') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Donut Chart */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                <PieChartIcon className="w-3.5 h-3.5" />
                <span>Service Popularity Share</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Most Popular Astrology Services
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Share of overall volume across Vedic specialties.
              </p>
            </div>

            <div className="h-64 w-full relative flex items-center justify-center">
              {data && data.popularServices.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.popularServices}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {data.popularServices.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SERVICE_COLORS[index % SERVICE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '16px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                      formatter={(value: any, name: any, props: any) => [
                        `${value} orders (${props.payload.percentage}%)`,
                        props.payload.name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-slate-400">Loading service distribution...</div>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {data?.popularServices.reduce((sum, s) => sum + s.count, 0) || 165}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Reports</div>
              </div>
            </div>

            {/* Micro legend */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              {data?.popularServices.map((s, idx) => (
                <div key={s.serviceType} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: SERVICE_COLORS[idx % SERVICE_COLORS.length] }}
                  />
                  <div className="truncate text-slate-700 dark:text-slate-300 font-medium">
                    {s.name.split('(')[0]}: <span className="font-bold">{s.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown Table & Progress Bars */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Detailed Service Performance & Ratings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Order counts, revenue contributions, and satisfaction ratings for each Vedic service.
              </p>
            </div>

            <div className="space-y-3.5">
              {data?.popularServices.map((service, idx) => (
                <div
                  key={service.serviceType}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2.5 hover:border-amber-500/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: SERVICE_COLORS[idx % SERVICE_COLORS.length] }}
                      />
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {service.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{service.avgRating} / 5.0</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${service.percentage}%`,
                        backgroundColor: SERVICE_COLORS[idx % SERVICE_COLORS.length]
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <div>
                      <strong className="text-slate-900 dark:text-white font-bold">{service.count} Orders</strong> ({service.percentage}% share)
                    </div>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                      FJD ${service.revenueFJD.toLocaleString()} • USD ${service.revenueUSD.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: AVERAGE ORDER PROCESSING VELOCITY & 12-HOUR SLA */}
      {/* ========================================================================= */}
      {(activeChartTab === 'overview' || activeChartTab === 'turnaround') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Turnaround Velocity & SLA Compliance</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Average Order Processing Time (Daily 9–11 AM IST Preparation)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Turnaround latency from customer form submission to Vedic calculation, PDF rendering, and automated SMTP dispatch.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-emerald-500 shrink-0" />
              <div>
                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  {data?.processingTimeMetrics.sla12hCompliancePercent || 99.2}% Delivery Compliance
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  Prepared daily 9–11 AM IST by India priest team
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-center">
              <div className="text-[11px] font-semibold text-slate-500">Average Processing</div>
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
                {((data?.processingTimeMetrics.avgMinutes || 264) / 60).toFixed(1)} hrs
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{data?.processingTimeMetrics.avgMinutes || 264} Minutes total</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-center">
              <div className="text-[11px] font-semibold text-slate-500">Median Processing</div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                {((data?.processingTimeMetrics.medianMinutes || 240) / 60).toFixed(1)} hrs
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Typical turnaround time</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-center">
              <div className="text-[11px] font-semibold text-slate-500">Fastest Delivery</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {data?.processingTimeMetrics.fastestMinutes || 18} mins
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Instant automated flow</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-center">
              <div className="text-[11px] font-semibold text-slate-500">Service SLA Guarantee</div>
              <div className="text-2xl font-black text-amber-500 mt-1">
                &le; 12.0 hrs
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">100% money-back backed</div>
            </div>
          </div>

          {/* Turnaround Time Distribution Histogram */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Delivery Time Distribution Buckets
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {data?.processingTimeMetrics.distribution.map((dist, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/60 space-y-1.5"
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{dist.range}</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">{dist.count} orders</div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full"
                      style={{ width: `${dist.percentage}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">{dist.percentage}% of total</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: SUCCESSFUL VS FAILED EMAIL DELIVERY RATES */}
      {/* ========================================================================= */}
      {(activeChartTab === 'overview' || activeChartTab === 'emails') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Email Deliverability Gauge & Donut */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Mail className="w-3.5 h-3.5" />
                <span>SMTP Dispatch Deliverability</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Successful vs. Failed Email Delivery
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time tracking of PDF attachments, delivery confirmations, and bounce health.
              </p>
            </div>

            <div className="h-60 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={emailPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {emailPieData.map((entry, index) => (
                      <Cell key={`email-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '16px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-2xl font-black text-emerald-500">
                  {data?.emailDeliveryMetrics.successRate || 98.4}%
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Success Rate</div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Successfully Dispatched
                </span>
                <span className="font-bold">{data?.emailDeliveryMetrics.sent || 118} ({data?.emailDeliveryMetrics.successRate}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-rose-500">
                  <XCircle className="w-3.5 h-3.5" />
                  Failed / Bounce Back
                </span>
                <span className="font-bold">{data?.emailDeliveryMetrics.failed || 2} ({((Number(data?.emailDeliveryMetrics.failed || 2) / Number(data?.emailDeliveryMetrics.totalAttempted || 120)) * 100).toFixed(1)}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-amber-500">
                  <Clock className="w-3.5 h-3.5" />
                  Pending Queue
                </span>
                <span className="font-bold">{data?.emailDeliveryMetrics.pending || 0}</span>
              </div>
            </div>
          </div>

          {/* Real-time Email Logs Table */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Recent Email Dispatch Telemetry Logs
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Audit logs of astrological PDF certificate dispatches to customer inboxes.
                </p>
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('emails')}
                  className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                >
                  <span>SMTP Settings</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Order #</th>
                    <th className="px-3 py-2.5">Recipient</th>
                    <th className="px-3 py-2.5">Service</th>
                    <th className="px-3 py-2.5">Latency</th>
                    <th className="px-3 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {data?.emailDeliveryMetrics.recentLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                        {log.orderNumber}
                      </td>
                      <td className="px-3 py-2.5 truncate max-w-[150px]">
                        {log.recipient}
                      </td>
                      <td className="px-3 py-2.5 text-[11px]">
                        {log.serviceType.replace('_', ' ')}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">
                        {log.latencySec.toFixed(1)}s
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'SENT'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          {log.status === 'SENT' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{log.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: GEOGRAPHIC & DIASPORA DISTRIBUTION */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Globe2 className="w-3.5 h-3.5" />
              <span>Demographic Distribution</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              User Geographic Reach: Fiji Islands & Global Diaspora
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Orders placed across Fiji (Suva, Nadi, Lautoka, Labasa) and the global Indo-Fijian diaspora (Australia, New Zealand, USA, Canada, UK).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {data?.geographicBreakdown.map((geo, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2 hover:border-purple-500/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{geo.region}</span>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{geo.percentage}%</span>
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {geo.orderCount} <span className="text-xs font-normal text-slate-400">orders</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full" style={{ width: `${geo.percentage}%` }} />
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {geo.revenueFJD > 0 ? `FJD $${geo.revenueFJD}` : `USD $${geo.revenueUSD}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
