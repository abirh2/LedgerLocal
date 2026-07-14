import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Shield, Database, Lock, ServerOff, UserCheck, HardDrive, RefreshCcw, Info } from 'lucide-react';
import { dbApi } from '../database/db';
import { useStore } from '../store/StoreContext';

export function PrivacyPage() {
  const { currentProfileId, profiles } = useStore();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    dbApi.getDiagnostics().then(setStats);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full space-y-8">
      <PageHeader title="Privacy & Storage" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-raised p-6 space-y-4">
          <div className="flex items-center gap-3 text-primary mb-2">
            <Shield size={24} />
            <h3 className="text-lg font-bold">Privacy Commitment</h3>
          </div>
          <ul className="space-y-4 text-sm text-on-surface-variant">
            <li className="flex gap-3">
              <Database className="shrink-0 text-primary" size={18} />
              <span><strong>Local Storage:</strong> All data is stored locally in your browser's IndexedDB. No financial data ever leaves your device.</span>
            </li>
            <li className="flex gap-3">
              <ServerOff className="shrink-0 text-primary" size={18} />
              <span><strong>No Cloud:</strong> No bank credentials are collected, no AI services are used, and no cloud account is required.</span>
            </li>
            <li className="flex gap-3">
              <Lock className="shrink-0 text-primary" size={18} />
              <span><strong>Local Processing:</strong> Files (CSV/JSON) are processed entirely in your browser. Nothing is uploaded to a server.</span>
            </li>
            <li className="flex gap-3">
              <UserCheck className="shrink-0 text-primary" size={18} />
              <span><strong>No Analytics:</strong> No telemetry, tracking, or analytics are sent to any remote servers.</span>
            </li>
          </ul>
        </div>

        <div className="card-raised p-6 space-y-4">
          <div className="flex items-center gap-3 text-primary mb-2">
            <HardDrive size={24} />
            <h3 className="text-lg font-bold">Storage Status</h3>
          </div>
          {stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-surface-container-low rounded-xl">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">IndexedDB</p>
                  <p className="text-sm font-bold text-success">Available</p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Current Profile</p>
                  <p className="text-sm font-bold text-primary">{profiles.find(p => p.id === currentProfileId)?.name}</p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Usage</p>
                  <p className="text-sm font-bold text-on-surface">{formatSize(stats.storageUsage)}</p>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Available Quota</p>
                  <p className="text-sm font-bold text-on-surface">{formatSize(stats.storageQuota)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Total Records</span>
                  <span className="font-bold">{stats.accountsCount + stats.transactionsCount + stats.categoriesCount}</span>
                </div>
                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full" 
                    style={{ width: `${Math.min(100, (stats.storageUsage / (stats.storageQuota || 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <RefreshCcw className="animate-spin text-on-surface-variant" size={20} />
            </div>
          )}
        </div>
      </div>

      <div className="card-raised p-6 bg-error-container/5 border-error-container/20">
        <div className="flex items-center gap-3 text-error mb-4">
          <Info size={24} />
          <h3 className="text-lg font-bold">Important Responsibility</h3>
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
          Because LedgerLocal is a <strong>private, local-only application</strong>, you are responsible for your own data. 
          Clearing your browser's site data or history for this domain may delete all your local records.
        </p>
        <p className="text-sm font-bold text-on-surface">
          We strongly recommend exporting regular backups to keep your data safe outside the browser.
        </p>
      </div>

      <div className="p-4 bg-surface-container-low rounded-2xl text-[11px] text-on-surface-variant font-mono">
        <p>STORAGE_MODEL: browser_indexed_db_v{stats?.schemaVersion || '5'}</p>
        <p>ENCRYPTION: local_browser_sandboxing (unencrypted on disk)</p>
        <p>PROFILE_ID: {currentProfileId}</p>
      </div>
    </div>
  );
}
