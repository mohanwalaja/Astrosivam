import React, { useState, useEffect } from 'react';
import { DollarSign, Download, Calendar, ArrowUpRight, ArrowDownRight, FileText, CheckCircle2, AlertCircle, RefreshCw, QrCode } from 'lucide-react';
import { api } from '../../services/api';
import { FinancialSummaryReport } from '../../types';

interface FinancialDashboardProps {
  onRefreshOrders?: () => void;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = () => {
  const [report, setReport] = useState<FinancialSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportType, setReportType] = useState('ALL');

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminFinancialReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        reportType
      });
      if (res.success && res.report) {
        setReport(res.report);
      }
    } catch (err) {
      console.error('Failed to load financial report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header & Date Range Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Financial & Revenue Reports</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Revenue, Payment & Refund Dashboard
          </h2>
          <p className="text-xs text-slate-500">
            Real-time accounting of Vodafone M-PAiSA, Indian GPay/UPI, and PayPal transactions with refund logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
          />
          <button
            onClick={fetchReport}
            className="px-4 py-1.5 bg-slate-800 text-white hover:bg-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Apply</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-amber-600 text-white hover:bg-amber-500 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Print Summary</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gross Sales Revenue</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            FJD ${(report?.grossRevenueFJD ?? report?.totalPaymentsAmountFJD ?? 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 flex flex-wrap gap-2">
            <span>USD ${(report?.grossRevenueUSD ?? report?.totalPaymentsAmountUSD ?? 0).toFixed(2)}</span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">₹{(report?.grossRevenueINR ?? report?.totalPaymentsAmountINR ?? 0).toFixed(2)} INR</span>
          </div>
        </div>

        {/* Net Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Net Settled Revenue</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            FJD ${(report?.netRevenueFJD ?? 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>USD ${(report?.netRevenueUSD ?? 0).toFixed(2)} • ₹{(report?.netRevenueINR ?? 0).toFixed(2)} INR</span>
          </div>
        </div>

        {/* Refunds Total */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-rose-500">Refunds Processed</div>
          <div className="text-2xl font-black text-rose-600">
            FJD ${(report?.totalRefundsFJD ?? 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">
            {report?.refundsCount || report?.totalRefundsCount || 0} pre-approval cancellations
          </div>
        </div>

        {/* Total Orders Completed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-purple-500">Total Orders</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {report?.totalOrdersCount ?? report?.orders?.length ?? 0}
          </div>
          <div className="text-[11px] text-slate-400">
            {report?.paidOrdersCount ?? report?.approvedPaymentsCount ?? 0} Paid • {report?.betaOrdersCount ?? report?.betaUsageCount ?? 0} Free Beta
          </div>
        </div>
      </div>

      {/* Payment Gateway Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* M-PAiSA Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Vodafone M-PAiSA</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
              Fiji Wallet
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              FJD ${(report?.byPaymentMethod?.MPAISA?.amount ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-slate-500">
              {report?.byPaymentMethod?.MPAISA?.count ?? 0} Transactions verified
            </div>
          </div>
        </div>

        {/* Indian GPay / UPI Card */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Indian GPay / UPI</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              India QR / ₹
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{((report?.byPaymentMethod?.GPAY?.inrAmount || report?.byPaymentMethod?.GPAY?.amount) ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>{report?.byPaymentMethod?.GPAY?.count ?? 0} Transactions</span>
              {(report?.byPaymentMethod?.GPAY?.fjdAmount ?? 0) > 0 && (
                <span className="text-[11px] text-slate-400">
                  (FJD ${(report?.byPaymentMethod?.GPAY?.fjdAmount ?? 0).toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PayPal Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">PayPal / Card</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              International
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              USD ${(report?.byPaymentMethod?.PAYPAL?.amount ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-slate-500">
              {report?.byPaymentMethod?.PAYPAL?.count ?? 0} Transactions verified
            </div>
          </div>
        </div>
      </div>

      {/* Service-by-Service Revenue Distribution */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Service Type Revenue Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="text-xs font-semibold text-slate-500">Birth Jathagam</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              FJD ${(report?.byServiceType?.BIRTH_JATHAGAM?.amount ?? report?.revenueByService?.BIRTH_JATHAGAM?.fjd ?? 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400">
              {report?.byServiceType?.BIRTH_JATHAGAM?.count ?? report?.revenueByService?.BIRTH_JATHAGAM?.count ?? 0} Requests
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="text-xs font-semibold text-slate-500">Marriage Compatibility</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              FJD ${(report?.byServiceType?.MARRIAGE_COMPATIBILITY?.amount ?? report?.revenueByService?.MARRIAGE_COMPATIBILITY?.fjd ?? 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400">
              {report?.byServiceType?.MARRIAGE_COMPATIBILITY?.count ?? report?.revenueByService?.MARRIAGE_COMPATIBILITY?.count ?? 0} Match Requests
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="text-xs font-semibold text-slate-500">Baby Naming</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              FJD ${(report?.byServiceType?.BABY_NAMING?.amount ?? report?.revenueByService?.BABY_NAMING?.fjd ?? 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400">
              {report?.byServiceType?.BABY_NAMING?.count ?? report?.revenueByService?.BABY_NAMING?.count ?? 0} Consultations
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="text-xs font-semibold text-slate-500">Subha Muhurtham</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              FJD ${(report?.byServiceType?.MUHURTHAM?.amount ?? report?.revenueByService?.MUHURTHAM?.fjd ?? 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400">
              {report?.byServiceType?.MUHURTHAM?.count ?? report?.revenueByService?.MUHURTHAM?.count ?? 0} Muhurtham Requests
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
