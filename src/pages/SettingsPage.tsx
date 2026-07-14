import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/StoreContext';
import { dbApi } from '../database/db';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { 
  Settings, Monitor, Database, Download, Upload, Shield, 
  Terminal, Trash2, Plus, Edit2, Check, X, ArrowLeftRight, 
  User, RefreshCw, AlertTriangle, Save, FileJson, FileType, 
  Table, Layout, Calendar, Globe, DollarSign, Type, Hash,
  HelpCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserSettings, UserProfile } from '../models/types';

type SettingSection = 'general' | 'display' | 'data' | 'imports' | 'backup' | 'profiles' | 'diagnostics';

export function SettingsPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { 
    settings, updateSettings, refreshData, resetDemoData,
    profiles, currentProfileId, changeProfile, createProfile, deleteProfile, renameProfile 
  } = useStore();
  
  const [activeSection, setActiveSection] = useState<SettingSection>('general');
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: false,
    onConfirm: () => {},
  });

  const fetchDiagnostics = useCallback(() => {
    dbApi.getDiagnostics().then(setDiagnostics);
  }, []);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await dbApi.exportData(settings);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      updateSettings({ lastBackupDate: new Date().toISOString() });
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          
          // Basic validation
          if (!data.accounts || !data.transactions) {
            throw new Error('Invalid backup file');
          }

          setConfirmDialog({
            isOpen: true,
            title: 'Restore Data',
            message: `Restore backup from ${new Date(data.timestamp).toLocaleString()}? This will replace all data in the current profile.`,
            isDestructive: true,
            onConfirm: async () => {
              setIsRestoring(true);
              const restoredSettings = await dbApi.restoreData(content, 'replace');
              if (restoredSettings) {
                await updateSettings(restoredSettings);
              }
              await refreshData();
              fetchDiagnostics();
              setIsRestoring(false);
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            }
          });
        } catch (err) {
          alert('Failed to restore backup. File is invalid or corrupted.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const navItems = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'display', label: 'Display', icon: Monitor },
    { id: 'data', label: 'Data Management', icon: Database },
    { id: 'imports', label: 'Imports', icon: Table },
    { id: 'profiles', label: 'Local Profiles', icon: User },
    { id: 'backup', label: 'Backup & Restore', icon: Download },
    { id: 'diagnostics', label: 'Diagnostics', icon: Terminal },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader title="Settings" />
      
      <div className="flex flex-1 overflow-hidden gap-8">
        {/* Sidebar Nav */}
        <div className="w-64 flex flex-col gap-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeSection === item.id 
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/20" 
                  : "hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
          <div className="mt-8 pt-4 border-t border-outline-variant">
            <button 
              onClick={() => onNavigate('privacy')}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-high w-full text-left"
            >
              <Shield size={18} />
              Privacy & Security
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-4">
          <div className="max-w-2xl space-y-8 pb-12">
            
            {activeSection === 'general' && (
              <section className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Globe size={20} className="text-primary" /> General
                </h3>
                <div className="card-raised p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <DollarSign size={18} className="text-on-surface-variant" />
                        <div>
                          <p className="text-sm font-bold">Currency</p>
                          <p className="text-xs text-on-surface-variant">Default currency for reports</p>
                        </div>
                      </div>
                      <select 
                        value={settings.currency}
                        onChange={e => updateSettings({ currency: e.target.value })}
                        className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-bold"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CAD">CAD ($)</option>
                      </select>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Calendar size={18} className="text-on-surface-variant" />
                        <div>
                          <p className="text-sm font-bold">First Day of Week</p>
                          <p className="text-xs text-on-surface-variant">Used in calendar views</p>
                        </div>
                      </div>
                      <select 
                        value={settings.firstDayOfWeek}
                        onChange={e => updateSettings({ firstDayOfWeek: parseInt(e.target.value) })}
                        className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-bold"
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                      </select>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <RefreshCw size={18} className="text-on-surface-variant" />
                        <div>
                          <p className="text-sm font-bold">Default Reporting Period</p>
                          <p className="text-xs text-on-surface-variant">Period shown on dashboard</p>
                        </div>
                      </div>
                      <select 
                        value={settings.defaultReportingPeriod}
                        onChange={e => updateSettings({ defaultReportingPeriod: e.target.value as any })}
                        className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-bold"
                      >
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                        <option value="last_30_days">Last 30 Days</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'display' && (
              <section className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Layout size={20} className="text-primary" /> Display
                </h3>
                <div className="card-raised p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold">Density</p>
                        <p className="text-xs text-on-surface-variant">Adjust UI spacing</p>
                      </div>
                      <div className="flex bg-surface-container rounded-xl p-1">
                        <button 
                          onClick={() => updateSettings({ density: 'comfortable' })}
                          className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", settings.density === 'comfortable' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant")}
                        >
                          Comfortable
                        </button>
                        <button 
                          onClick={() => updateSettings({ density: 'compact' })}
                          className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", settings.density === 'compact' ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant")}
                        >
                          Compact
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold">Reduced Motion</p>
                        <p className="text-xs text-on-surface-variant">Minimize animations</p>
                      </div>
                      <button 
                        onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                        className={cn("w-12 h-6 rounded-full transition-all relative", settings.reducedMotion ? "bg-primary" : "bg-outline-variant")}
                      >
                        <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", settings.reducedMotion ? "left-7" : "left-1")}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'profiles' && (
              <section className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <User size={20} className="text-primary" /> Local Profiles
                </h3>
                <div className="card-raised p-6 space-y-6">
                  <div className="space-y-4">
                    {profiles.map(profile => (
                      <div key={profile.id} className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all",
                        currentProfileId === profile.id ? "bg-primary/5 border-primary" : "bg-surface-container-low border-outline-variant/30"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg", currentProfileId === profile.id ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant")}>
                            {profile.name.charAt(0)}
                          </div>
                          <div>
                            {editingProfileId === profile.id ? (
                              <div className="flex items-center gap-2">
                                <input 
                                  value={editName} 
                                  onChange={e => setEditName(e.target.value)}
                                  className="bg-surface border border-primary px-2 py-1 rounded text-sm font-bold"
                                  autoFocus
                                />
                                <button onClick={() => { renameProfile(profile.id, editName); setEditingProfileId(null); }} className="text-primary"><Check size={16} /></button>
                                <button onClick={() => setEditingProfileId(null)} className="text-on-surface-variant"><X size={16} /></button>
                              </div>
                            ) : (
                              <p className="text-sm font-bold">{profile.name} {currentProfileId === profile.id && <span className="ml-2 text-[10px] bg-primary text-on-primary px-1.5 py-0.5 rounded uppercase">Active</span>}</p>
                            )}
                            <p className="text-[10px] text-on-surface-variant">Created: {new Date(profile.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {currentProfileId !== profile.id && (
                            <button onClick={() => changeProfile(profile.id)} className="btn-physical px-3 py-1.5 text-xs text-primary font-bold">Switch</button>
                          )}
                          <button onClick={() => { setEditingProfileId(profile.id); setEditName(profile.name); }} className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant"><Edit2 size={16} /></button>
                          {profile.id !== 'default' && (
                            <button onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Delete Profile',
                                message: `Are you sure you want to delete "${profile.name}"? All data for this profile will be permanently lost.`,
                                isDestructive: true,
                                onConfirm: async () => {
                                  await deleteProfile(profile.id);
                                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                }
                              });
                            }} className="p-2 hover:bg-error/10 rounded-lg text-error"><Trash2 size={16} /></button>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="pt-4 flex gap-2">
                      <input 
                        value={newProfileName}
                        onChange={e => setNewProfileName(e.target.value)}
                        placeholder="New profile name..."
                        className="flex-1 bg-surface-container border border-outline-variant rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button 
                        onClick={() => { if (newProfileName) { createProfile(newProfileName); setNewProfileName(''); } }}
                        className="btn btn-primary flex items-center gap-2"
                      >
                        <Plus size={16} /> Create
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'data' && (
              <section className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Database size={20} className="text-primary" /> Data Management
                </h3>
                <div className="card-raised p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
                      <h4 className="text-sm font-bold">Import History</h4>
                      <p className="text-xs text-on-surface-variant">Clear the log of past source files and raw import records.</p>
                      <button 
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Clear Import History',
                            message: 'This will remove all records of past imports. Individual transactions will remain.',
                            isDestructive: true,
                            onConfirm: async () => {
                              await dbApi.deleteImportHistory();
                              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                            }
                          });
                        }}
                        className="btn-physical mt-auto py-2 text-error text-xs font-bold"
                      >
                        Clear History
                      </button>
                    </div>

                    <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
                      <h4 className="text-sm font-bold">Reset Demo Data</h4>
                      <p className="text-xs text-on-surface-variant">Erase current profile data and reload initial sample dataset.</p>
                      <button 
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Reset to Demo',
                            message: 'This will OVERWRITE all data in the current profile with demo records.',
                            isDestructive: true,
                            onConfirm: async () => {
                              await resetDemoData();
                              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                            }
                          });
                        }}
                        className="btn-physical mt-auto py-2 text-primary text-xs font-bold"
                      >
                        Reset Demo
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-outline-variant">
                    <h4 className="text-sm font-bold text-error mb-4">Danger Zone</h4>
                    <button 
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'ERASE ALL DATA',
                          message: 'This will PERMANENTLY erase all accounts, transactions, and categories in the CURRENT profile. This action cannot be undone.',
                          isDestructive: true,
                          onConfirm: async () => {
                            await dbApi.clearAll();
                            await refreshData();
                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                      }}
                      className="w-full bg-error/10 hover:bg-error/20 text-error font-bold py-3 rounded-xl border border-error/30 transition-all"
                    >
                      Erase All Records in Profile
                    </button>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'backup' && (
              <section className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Download size={20} className="text-primary" /> Backup & Restore
                  </h3>
                  <button
                    onClick={() => {
                      sessionStorage.setItem('guide_section_anchor', 'backup-restore');
                      onNavigate('guide');
                    }}
                    className="px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface bg-surface border border-outline-variant hover:bg-surface-container rounded-md flex items-center gap-1.5 transition-colors shadow-sm font-semibold"
                    title="View backup and restore guide"
                  >
                    <HelpCircle size={14} />
                    <span>Backup Guide</span>
                  </button>
                </div>
                <div className="card-raised p-6 space-y-6">
                  <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <FileJson size={24} className="text-primary" />
                      <div>
                        <p className="text-sm font-bold">JSON Data Backup</p>
                        <p className="text-xs text-on-surface-variant">Includes all accounts, transactions, rules, and settings.</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleExport}
                      disabled={isExporting}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      {isExporting ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                      Export JSON
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-surface-container-low border border-outline-variant/30 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Upload size={24} className="text-on-surface-variant" />
                      <div>
                        <p className="text-sm font-bold">Restore from Backup</p>
                        <p className="text-xs text-on-surface-variant">Restore data from a previously exported JSON file.</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleRestore}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      <Upload size={16} />
                      Restore
                    </button>
                  </div>

                  {settings.lastBackupDate && (
                    <p className="text-[11px] text-on-surface-variant text-center">
                      Last successful backup: {new Date(settings.lastBackupDate).toLocaleString()}
                    </p>
                  )}
                </div>
              </section>
            )}

            {activeSection === 'diagnostics' && diagnostics && (
              <section className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Terminal size={20} className="text-primary" /> Diagnostics
                </h3>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 font-mono text-xs space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    <div className="flex justify-between border-b border-outline-variant/30 pb-1">
                      <span className="text-on-surface-variant">IndexedDB Status</span>
                      <span className="text-success font-bold">READY</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/30 pb-1">
                      <span className="text-on-surface-variant">Schema Version</span>
                      <span className="font-bold">{diagnostics.schemaVersion}</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/30 pb-1">
                      <span className="text-on-surface-variant">Profile ID</span>
                      <span className="font-bold">{currentProfileId}</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/30 pb-1">
                      <span className="text-on-surface-variant">Accounts</span>
                      <span className="font-bold">{diagnostics.accountsCount}</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/30 pb-1">
                      <span className="text-on-surface-variant">Transactions</span>
                      <span className="font-bold">{diagnostics.transactionsCount}</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/30 pb-1">
                      <span className="text-on-surface-variant">Categories</span>
                      <span className="font-bold">{diagnostics.categoriesCount}</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/30 pb-1">
                      <span className="text-on-surface-variant">Rules</span>
                      <span className="font-bold">{diagnostics.rulesCount}</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/30 pb-1">
                      <span className="text-on-surface-variant">Budgets</span>
                      <span className="font-bold">{diagnostics.budgetsCount}</span>
                    </div>
                  </div>
                  
                  <div className="pt-4 text-[10px] text-on-surface-variant border-t border-outline-variant/30">
                    <p>AGENT: Antigravity-v1.2</p>
                    <p>RUNTIME: browser-main-thread</p>
                    <p>TIMESTAMP: {new Date().toISOString()}</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
