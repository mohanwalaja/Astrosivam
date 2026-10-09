import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Ban, 
  UserX, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Unlock,
  Trash2,
  Filter
} from 'lucide-react';
import { BannedIpEntry } from '../../types';
import { api } from '../../services/api';

interface SecurityBannedIpPanelProps {
  bannedIps: BannedIpEntry[];
  onRefresh: () => void;
  onSetSuccess: (msg: string) => void;
  onSetError: (msg: string) => void;
}

export const SecurityBannedIpPanel: React.FC<SecurityBannedIpPanelProps> = ({
  bannedIps,
  onRefresh,
  onSetSuccess,
  onSetError
}) => {
  const [ipInput, setIpInput] = useState('');
  const [reasonInput, setReasonInput] = useState('Repeated fake order submission without payment');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingIp, setActionLoadingIp] = useState<string | null>(null);

  const handleBanIpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipInput.trim()) {
      onSetError('Please enter a valid IP address to ban.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.banIp(ipInput.trim(), reasonInput.trim() || 'Manual IP ban by admin');
      if (res.success) {
        onSetSuccess(res.message || `IP ${ipInput.trim()} has been blocked.`);
        setIpInput('');
        setReasonInput('Repeated fake order submission without payment');
        onRefresh();
      } else {
        onSetError(res.message || 'Failed to ban IP.');
      }
    } catch (err: any) {
      onSetError(err.message || 'An error occurred while banning IP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnbanIp = async (ipAddress: string) => {
    if (!window.confirm(`Are you sure you want to unban and restore access for IP: ${ipAddress}?`)) {
      return;
    }

    setActionLoadingIp(ipAddress);
    try {
      const res = await api.unbanIp(ipAddress);
      if (res.success) {
        onSetSuccess(res.message || `IP ${ipAddress} unblocked.`);
        onRefresh();
      } else {
        onSetError(res.message || 'Failed to unban IP.');
      }
    } catch (err: any) {
      onSetError(err.message || 'An error occurred while unbanning IP.');
    } finally {
      setActionLoadingIp(null);
    }
  };

  const filteredIps = (bannedIps || []).filter(item => {
    if (!searchQuery.trim()) return true;
    const q = (searchQuery || '').toLowerCase();
    return (item.ipAddress || '').toLowerCase().includes(q) || (item.reason || '').toLowerCase().includes(q) || (item.bannedBy || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" id="security-banned-ip-panel">
      {/* Overview & Anti-Fraud Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-red-200 dark:border-red-900/40 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Blocked Addresses</span>
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{bannedIps?.length || 0}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Blacklisted from creating orders or accessing portal</p>
          </div>
          <div className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg">
            <Ban className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-amber-200 dark:border-amber-900/40 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Anti-Fraud Engine</span>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">Active & Guarding</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Blocks duplicate & bogus payment reference strings</p>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-blue-200 dark:border-blue-900/40 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Flood Protection</span>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">Max 3 Unpaid Orders</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rate limits unpaid pending orders per single IP</p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
            <Lock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Manual IP Ban Form */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Block New IP Address</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Banning an IP will immediately reject any new order submissions and block the user from generating reports or submitting fake transaction references.
        </p>

        <form onSubmit={handleBanIpSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              IP Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 103.21.244.0 or 192.168.1.1"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reason for Block
            </label>
            <input
              type="text"
              placeholder="e.g. Repeated fake UPI references, non-payment spam"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Blocking...</span>
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  <span>Ban IP Address</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Banned IPs Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              Active Blacklist ({filteredIps.length})
            </h3>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search banned IPs or reasons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button
              onClick={onRefresh}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh Blacklist"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filteredIps.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">No Banned IPs Found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {searchQuery ? 'No banned IPs match your search query.' : 'There are currently no blacklisted IP addresses. Automatic anti-fraud validation is actively protecting all order forms.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Banned IP Address</th>
                  <th className="py-3 px-4">Reason / Violation</th>
                  <th className="py-3 px-4">Banned On</th>
                  <th className="py-3 px-4">Banned By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                {filteredIps.map((item) => (
                  <tr key={item.id || item.ipAddress} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-red-600 dark:text-red-400">
                      <div className="flex items-center gap-2">
                        <Ban className="w-4 h-4 shrink-0 text-red-500" />
                        <span>{item.ipAddress}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <span className="inline-block px-2 py-0.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded text-xs">
                        {item.reason}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(item.bannedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {item.bannedBy || 'Administrator'}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleUnbanIp(item.ipAddress)}
                        disabled={actionLoadingIp === item.ipAddress}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {actionLoadingIp === item.ipAddress ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                        <span>Unban / Restore</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Anti-Fraud Explanatory & Operational Rules Guide */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-3">
        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Automated Security Rules Active Across All Order Endpoints</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <h5 className="font-bold text-slate-900 dark:text-slate-100 mb-1">1. Duplicate Transaction Prevention</h5>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Prevents users from reusing the same UPI reference number or M-PAiSA reference code across multiple orders. Each order requires a distinct transaction ID.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <h5 className="font-bold text-slate-900 dark:text-slate-100 mb-1">2. Fake Pattern & Length Checks</h5>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Automatically rejects common placeholder inputs (e.g. "123456", "000000", "test", "nil", repeating digits, or strings under 6 characters).
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <h5 className="font-bold text-slate-900 dark:text-slate-100 mb-1">3. One-Click Order IP Ban</h5>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              In the Orders tab, Admin can click the <strong>"Ban IP"</strong> button on any fraudulent order to instantly blacklist that IP address from placing any future orders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
