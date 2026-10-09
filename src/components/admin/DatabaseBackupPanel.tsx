import React, { useState } from 'react';
import { Database, Download, Upload, RefreshCw, CheckCircle2, AlertCircle, FileSpreadsheet, ShieldAlert, Archive, FileCode, Package, Server } from 'lucide-react';
import { api } from '../../services/api';

interface DatabaseBackupPanelProps {
  onDataImported?: () => void;
}

export const DatabaseBackupPanel: React.FC<DatabaseBackupPanelProps> = ({ onDataImported }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importCollection, setImportCollection] = useState<string>('all');
  const [jsonInput, setJsonInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handleExport = async (collection?: string, format: 'json' | 'csv' = 'json') => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const res = await api.exportDatabase(collection);
      if (res.success && res.data) {
        if (format === 'json') {
          const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `AstroSivam_Database_Backup_${collection || 'ALL'}_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          // Flatten to CSV
          let csvRows = '';
          const targetArray = Array.isArray(res.data) ? res.data : Object.values(res.data).flat();
          if (targetArray.length > 0) {
            const headers = Object.keys(targetArray[0] as any).join(',');
            const rows = targetArray.map(item =>
              Object.values(item as any)
                .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
                .join(',')
            );
            csvRows = [headers, ...rows].join('\n');
          }
          const blob = new Blob([csvRows], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `AstroSivam_Export_${collection || 'ALL'}_${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }

        setStatusMessage({
          success: true,
          text: `Database ${collection ? collection.toUpperCase() : 'FULL'} exported successfully!`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        success: false,
        text: err.message || 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonInput.trim()) {
      setStatusMessage({ success: false, text: 'Please paste JSON data to import.' });
      return;
    }

    setIsImporting(true);
    setStatusMessage(null);
    try {
      const parsed = JSON.parse(jsonInput);
      const res = await api.importDatabase(parsed, { mode: importMode, collection: importCollection });
      if (res.success) {
        setStatusMessage({
          success: true,
          text: `${res.message} Records merged/replaced successfully.`
        });
        setJsonInput('');
        if (onDataImported) onDataImported();
      } else {
        setStatusMessage({
          success: false,
          text: res.message || 'Import rejected'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        success: false,
        text: `Invalid JSON syntax: ${err.message}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      setJsonInput(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Database className="w-3.5 h-3.5" />
            <span>Database Management</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Export, Import & Disaster Recovery Backups
          </h2>
          <p className="text-xs text-slate-500">
            Export orders, profiles, team members, and audit logs to JSON / CSV, or restore backup archives.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 ${statusMessage.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Export Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Download Full Database or Specific Collection</span>
          </h3>
          <span className="text-[11px] text-slate-400">Instant offline snapshot</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Full System Archive</h4>
              <p className="text-[11px] text-slate-500">Everything: orders, profiles, settings, team</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleExport(undefined, 'json')}
                disabled={isExporting}
                className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Orders & Transactions</h4>
              <p className="text-[11px] text-slate-500">All customer astrological orders</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleExport('orders', 'json')}
                disabled={isExporting}
                className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
              >
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('orders', 'csv')}
                disabled={isExporting}
                className="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
              >
                <span>CSV</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Customer Profiles</h4>
              <p className="text-[11px] text-slate-500">User accounts & birth details</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleExport('users', 'json')}
                disabled={isExporting}
                className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
              >
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('users', 'csv')}
                disabled={isExporting}
                className="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
              >
                <span>CSV</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Astrology Team</h4>
              <p className="text-[11px] text-slate-500">Priest and scholar roster</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleExport('team', 'json')}
                disabled={isExporting}
                className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
              >
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import & Restore Section */}
      <form onSubmit={handleImport} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-purple-500" />
            <span>Restore / Import Data into ASTRO SIVAM</span>
          </h3>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer text-xs font-bold text-purple-600 hover:underline flex items-center gap-1">
              <Archive className="w-3.5 h-3.5" />
              <span>Choose File</span>
              <input type="file" accept=".json,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Import Mode</label>
            <select
              value={importMode}
              onChange={e => setImportMode(e.target.value as any)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold"
            >
              <option value="merge">Merge with Existing Records (Safest - updates matches)</option>
              <option value="replace">Replace Entire Database (Caution: overrides existing data)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Collection</label>
            <select
              value={importCollection}
              onChange={e => setImportCollection(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
            >
              <option value="all">Full Backup (All collections)</option>
              <option value="orders">Orders Only</option>
              <option value="users">Users & Birth Profiles Only</option>
              <option value="team">Team Members Only</option>
              <option value="settings">System Settings Only</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Paste JSON Data or Load from Backup File
          </label>
          <textarea
            rows={6}
            value={jsonInput}
            onChange={e => setJsonInput(e.target.value)}
            placeholder='{"orders": [...], "users": [...]}'
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isImporting}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isImporting ? 'Importing Data...' : 'Import Data into Database'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
