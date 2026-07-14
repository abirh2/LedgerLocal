import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store/StoreContext';
import { dbApi } from '../database/db';
import { PageHeader } from '../components/layout/PageHeader';
import { 
  BookOpen, 
  Search, 
  Check, 
  CheckCircle2, 
  ArrowRight, 
  Copy, 
  Plus, 
  Database, 
  HelpCircle, 
  RefreshCw, 
  Download, 
  Upload, 
  Shield, 
  Info, 
  Lock, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  AlertTriangle,
  FileCode,
  UserCheck,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Landmark,
  List,
  ArrowLeftRight,
  PieChart,
  BarChart2,
  TrendingUp
} from 'lucide-react';
import { cn } from '../lib/utils';

interface OnboardingStep {
  id: string;
  number: number;
  title: string;
  description: string;
  pageId: string;
  isCompleted: boolean;
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  summary: string;
}

export function GuidePage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { accounts, transactions, settings, updateSettings, refreshData } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('about');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['about']));
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // FAQ open state
  const [openFaqs, setOpenFaqs] = useState<Record<string, boolean>>({});

  // Understood sections state (local state + localStorage persistence)
  const [understoodSections, setUnderstoodSections] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ledgerlocal_understood_sections');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load section anchor from sessionStorage if redirected contextually
  useEffect(() => {
    const anchor = sessionStorage.getItem('guide_section_anchor');
    if (anchor) {
      sessionStorage.removeItem('guide_section_anchor');
      setActiveSection(anchor);
      setExpandedSections(prev => {
        const next = new Set(prev);
        next.add(anchor);
        return next;
      });
      // Scroll to element after render
      setTimeout(() => {
        const el = document.getElementById(`section-${anchor}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  }, []);

  // Update understood sections in localStorage
  const toggleUnderstood = (id: string) => {
    setUnderstoodSections(prev => {
      const updated = prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id];
      localStorage.setItem('ledgerlocal_understood_sections', JSON.stringify(updated));
      return updated;
    });
  };

  const resetGuideProgress = () => {
    localStorage.removeItem('ledgerlocal_understood_sections');
    setUnderstoodSections([]);
  };

  // Stepper calculations based on actual app data
  const hasAccount = accounts.length > 0;
  const hasTransactions = transactions.length > 0;
  const hasImportedTx = transactions.some(t => t.importId !== undefined);
  const hasCategorizedTx = transactions.some(t => t.categoryId && t.categoryId !== 'Uncategorized' && t.categoryId !== '');
  const hasBackup = settings.lastBackupDate !== undefined;

  const steps: OnboardingStep[] = useMemo(() => [
    {
      id: 'step-accounts',
      number: 1,
      title: 'Create financial accounts',
      description: 'Set up your cash, savings, card, or asset profiles before importing records.',
      pageId: 'accounts',
      isCompleted: hasAccount
    },
    {
      id: 'step-download',
      number: 2,
      title: 'Download CSV',
      description: 'Log into your institution and download recent transaction files.',
      pageId: 'imports',
      isCompleted: hasTransactions // Checking if there are transactions as a proxy, or if they started
    },
    {
      id: 'step-import',
      number: 3,
      title: 'Import and map file',
      description: 'Upload your CSV, specify layout columns, and preview parsed line rows.',
      pageId: 'imports',
      isCompleted: hasImportedTx
    },
    {
      id: 'step-review',
      number: 4,
      title: 'Review duplicates',
      description: 'Identify matches and filter out exact transaction overlaps safely.',
      pageId: 'imports',
      isCompleted: hasImportedTx // Since preview/import handles duplicates
    },
    {
      id: 'step-categorize',
      number: 5,
      title: 'Categorize spending',
      description: 'Group merchants into classes or create automated matching criteria.',
      pageId: 'transactions',
      isCompleted: hasCategorizedTx
    },
    {
      id: 'step-backup',
      number: 6,
      title: 'Create a backup',
      description: 'Export structured ledger snapshots regularly to prevent data loss.',
      pageId: 'settings',
      isCompleted: hasBackup
    }
  ], [hasAccount, hasTransactions, hasImportedTx, hasCategorizedTx, hasBackup]);

  const completedStepsCount = steps.filter(s => s.isCompleted).length;

  // Handles copying fictional CSV content
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  // Direct Backup action
  const handleDirectExport = async () => {
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
      
      await updateSettings({ lastBackupDate: new Date().toISOString() });
      await refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Restore action
  const handleDirectRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          
          if (!data.accounts || !data.transactions) {
            throw new Error('Invalid backup file');
          }

          if (confirm(`Restore backup from ${new Date(data.timestamp).toLocaleString()}? This will overwrite your current profile data.`)) {
            setIsRestoring(true);
            const restoredSettings = await dbApi.restoreData(content, 'replace');
            if (restoredSettings) {
              await updateSettings(restoredSettings);
            }
            await refreshData();
            alert('Backup successfully restored!');
          }
        } catch (err) {
          alert('Failed to restore backup. File is invalid or corrupted.');
        } finally {
          setIsRestoring(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const sections: GuideSection[] = [
    { id: 'about', title: '1. About LedgerLocal', icon: BookOpen, summary: 'Understand our design philosophy: local-first offline finance tracking without bank APIs, accounts, or AI.' },
    { id: 'create-accounts', title: '2. Create Your Accounts', icon: Landmark, summary: 'Set up your financial profiles (Checking, Savings, Credit Cards, etc.) before performing imports.' },
    { id: 'download-csv', title: '3. Download a CSV', icon: Download, summary: 'Learn how to export transaction tables from your institution as standard data documents.' },
    { id: 'import-csv', title: '4. Import a CSV', icon: Database, summary: 'A step-by-step walkthrough of the upload, formatting, and file ingestion workflow.' },
    { id: 'understand-mapping', title: '5. Understand Column Mapping', icon: FileCode, summary: 'Configure date and balance structures to read varying statement layouts perfectly.' },
    { id: 'review-duplicates', title: '6. Review Duplicates and Errors', icon: AlertTriangle, summary: 'Distinguish exact file repeats from genuine parallel card purchases.' },
    { id: 'organize-transactions', title: '7. Organize Transactions', icon: List, summary: 'Filter rows, rewrite merchant text, and build precise deterministic rules.' },
    { id: 'transfers-refunds', title: '8. Transfers, Card Payments, and Refunds', icon: ArrowLeftRight, summary: 'Handle non-expense balance moves and spending reversals accurately.' },
    { id: 'budgets-recurring', title: '9. Budgets and Recurring Activity', icon: PieChart, summary: 'Establish category thresholds, track rollover, and capture repeated spending patterns.' },
    { id: 'reports-net-worth', title: '10. Reports and Net Worth', icon: BarChart2, summary: 'Aggregate net assets and explore category dynamics over custom reporting ranges.' },
    { id: 'investments', title: '11. Investments', icon: TrendingUp, summary: 'Log cost basis, track holdings manually, and review valuation snap dates.' },
    { id: 'backup-restore', title: '12. Backup and Restore', icon: Shield, summary: 'Safeguard your data. Regularly download JSON logs to maintain offline safety.' },
    { id: 'privacy-data', title: '13. Privacy and Data Storage', icon: Lock, summary: 'Examine IndexedDB limits, private browsing traits, and local storage scopes.' }
  ];

  // Filtering based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery) return sections;
    const lower = searchQuery.toLowerCase();
    return sections.filter(s => 
      s.title.toLowerCase().includes(lower) || 
      s.summary.toLowerCase().includes(lower)
    );
  }, [searchQuery]);

  const toggleSectionExpanded = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFaq = (key: string) => {
    setOpenFaqs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Sample data text
  const signedCsvSample = `Date,Description,Amount
2026-07-01,AMZN MKTP US,-45.99
2026-07-02,Employer Direct Dep,2500.00
2026-07-03,LOCAL GROCERS,-82.15`;

  const splitCsvSample = `Posted Date,Payee,Debit,Credit
07/01/2026,STARBUCKS COFFEE,4.75,
07/02/2026,CREDIT CARD PYMT,,150.00
07/03/2026,SHELL OIL,34.50,`;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Compact Header */}
      <PageHeader title="How to Use LedgerLocal">
        <div className="flex gap-2">
          <button 
            onClick={() => onNavigate('accounts')}
            className="px-3.5 py-1.5 rounded-md bg-surface-container border border-outline-variant hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-all flex items-center gap-1.5"
          >
            <Plus size={14} className="text-primary" />
            Create Account
          </button>
          <button 
            onClick={() => onNavigate('imports')}
            className="btn-physical px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5"
          >
            <Database size={14} />
            Import First CSV
          </button>
        </div>
      </PageHeader>

      {/* Main Guide Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-hidden min-h-0 pb-8">
        
        {/* Table of Contents - Left Column (Sticky on Wide Screens) */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-5 h-[calc(100vh-10rem)] sticky top-0 overflow-y-auto">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-2 mb-2">Guide Progress</h4>
            <div className="px-2 py-1 bg-surface rounded-lg border border-outline-variant">
              <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                <span className="text-on-surface">Understood:</span>
                <span className="text-primary">{understoodSections.length} / 13</span>
              </div>
              <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden track-inset">
                <div 
                  className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(understoodSections.length / 13) * 100}%` }}
                />
              </div>
            </div>
            {understoodSections.length > 0 && (
              <button 
                onClick={resetGuideProgress}
                className="w-full mt-2 py-1 px-2 rounded hover:bg-surface-container text-[10px] font-semibold text-on-surface-variant transition-colors flex items-center justify-center gap-1"
              >
                <RotateCcw size={10} />
                Reset Progress
              </button>
            )}
          </div>

          <hr className="border-outline-variant" />

          <div className="space-y-1 overflow-y-auto pr-1 flex-1">
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-2 mb-2">Sections</h4>
            {sections.map(s => {
              const isSectionActive = activeSection === s.id;
              const isSectionUnderstood = understoodSections.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSection(s.id);
                    setExpandedSections(prev => {
                      const next = new Set(prev);
                      next.add(s.id);
                      return next;
                    });
                    const el = document.getElementById(`section-${s.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-md transition-colors font-medium",
                    isSectionActive 
                      ? "bg-primary/5 text-primary border-l-2 border-primary pl-2 font-semibold" 
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                  )}
                >
                  <span className="truncate pr-2">{s.title.substring(3)}</span>
                  {isSectionUnderstood && (
                    <CheckCircle2 size={12} className="text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Content Panel - Right/Center Column */}
        <div className="flex-1 space-y-8 overflow-y-auto pr-2 max-w-4xl">
          
          {/* Privacy Banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 items-start">
            <Shield size={18} className="text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-primary uppercase tracking-wide">Privacy First & Secure</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                LedgerLocal processes your files locally. Your financial transactions, budgets, accounts, and history are never sent, shared, or uploaded to any external server. Everything is maintained on your current browser's sandbox.
              </p>
            </div>
          </div>

          {/* Quick Start Connected Sequence */}
          <section className="card-raised rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-on-surface">Quick-Start Checklist</h3>
                <p className="text-xs text-on-surface-variant mt-1 font-medium">Verify your offline setup steps. Checked markers update automatically as you configure the app.</p>
              </div>
              <div className="bg-surface border border-outline-variant rounded-lg px-2.5 py-1 text-center self-start sm:self-auto">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Checklist Progress</span>
                <span className="text-sm font-bold text-primary font-tabular">{completedStepsCount} / 6 Complete</span>
              </div>
            </div>

            {/* Steps Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {steps.map((st) => (
                <div 
                  key={st.id} 
                  className={cn(
                    "p-3.5 rounded-lg border flex gap-3 transition-colors",
                    st.isCompleted 
                      ? "bg-primary/5 border-primary/20" 
                      : "bg-surface border-outline-variant hover:border-outline"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm",
                    st.isCompleted 
                      ? "bg-primary text-on-primary" 
                      : "bg-surface-container text-on-surface-variant"
                  )}>
                    {st.isCompleted ? <Check size={14} /> : st.number}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className={cn("text-xs font-bold truncate", st.isCompleted ? "text-primary" : "text-on-surface")}>
                      {st.title}
                    </p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      {st.description}
                    </p>
                    <button 
                      onClick={() => onNavigate(st.pageId)}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 mt-1 transition-all"
                    >
                      Go to {st.pageId.charAt(0).toUpperCase() + st.pageId.slice(1)}
                      <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Search/Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <label htmlFor="guide-search" className="sr-only">Search guide sections</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-on-surface-variant" />
              </div>
              <input
                id="guide-search"
                type="text"
                placeholder="Search guide sections (e.g. mapping, backup, budgets)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-2 pl-9 pr-4 text-xs shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-on-surface"
              />
            </div>
            
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-primary hover:underline self-start sm:self-auto"
              >
                Clear Search
              </button>
            )}

            <div className="block lg:hidden">
              <span className="text-xs text-on-surface-variant font-medium">
                Understood: <strong className="text-primary font-bold">{understoodSections.length} / 13</strong>
              </span>
            </div>
          </div>

          {/* Main Content Sections */}
          <div className="space-y-6">
            {filteredSections.map(s => {
              const isExpanded = expandedSections.has(s.id);
              const isUnderstood = understoodSections.includes(s.id);

              return (
                <article 
                  id={`section-${s.id}`}
                  key={s.id} 
                  className={cn(
                    "card-raised rounded-xl overflow-hidden transition-all border",
                    activeSection === s.id ? "ring-1 ring-primary/30 border-primary/30" : ""
                  )}
                >
                  {/* Section Title Block */}
                  <div 
                    onClick={() => toggleSectionExpanded(s.id)}
                    className="p-5 flex items-start gap-4 hover:bg-surface-container-low cursor-pointer transition-colors"
                  >
                    <div className="p-2 rounded bg-surface-container text-primary shrink-0 shadow-sm">
                      <s.icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-on-surface">{s.title}</h3>
                        {isUnderstood && (
                          <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                            <Check size={8} /> Understood
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1 font-medium leading-relaxed">
                        {s.summary}
                      </p>
                    </div>
                    <button 
                      className="text-on-surface-variant p-1 hover:bg-surface-container rounded-md"
                      aria-label={isExpanded ? "Collapse section details" : "Expand section details"}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Expanded Content Detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-outline-variant pt-5 bg-surface-container-lowest/50 text-xs leading-relaxed text-on-surface-variant space-y-4">
                      
                      {/* Detailed Explanations for each specific section */}
                      {s.id === 'about' && (
                        <div className="space-y-3">
                          <p>
                            <strong>LedgerLocal</strong> is a privacy-first, manual-entry and CSV-import finance tracker. We designed it for users who want total control over their data and do not want to connect accounts directly to third-party bank screen-scrapers.
                          </p>
                          <ul className="list-disc list-inside space-y-1.5 pl-2">
                            <li><strong className="text-on-surface">No Bank Connections:</strong> LedgerLocal does not integrate with Plaid, Yodlee, or direct bank credential logins. All data ingestion is file-driven.</li>
                            <li><strong className="text-on-surface">No Server Syncing:</strong> Your records never leave your machine. There is no cloud storage, meaning no user account or login is required.</li>
                            <li><strong className="text-on-surface">No Artificial Intelligence (AI):</strong> Categorization and merchant mapping are completely deterministic. Your descriptions are matched using simple, clear rules you fully define and control.</li>
                            <li><strong className="text-on-surface">Database Sandbox:</strong> Your profile data is written to the browser’s local IndexedDB container. Be cautious: clearing browser history, cookies, or site storage can erase your financial ledger.</li>
                          </ul>
                          <div className="p-3 bg-error/5 border border-error/10 text-error rounded-lg flex gap-2">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span><strong>No Financial Advice:</strong> LedgerLocal provides raw balance tracking and budgeting. It does not provide portfolio counseling, tax projections, or advice.</span>
                          </div>
                        </div>
                      )}

                      {s.id === 'create-accounts' && (
                        <div className="space-y-3">
                          <p>
                            Before importing statements, you should establish corresponding account profiles. LedgerLocal associates every transaction row with a parent account to compile your overall financial ledger.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
                            <div className="p-3 bg-surface border border-outline-variant rounded-lg">
                              <p className="font-bold text-on-surface mb-1">Supported Types</p>
                              <p className="text-[11px] leading-relaxed">
                                Checking, Savings, Credit Cards (Liabilities), Brokerage, Retirement, Assets (Property/Vehicles), and Liabilities (Loans/Mortgages).
                              </p>
                            </div>
                            <div className="p-3 bg-surface border border-outline-variant rounded-lg">
                              <p className="font-bold text-on-surface mb-1">Net Worth Toggle</p>
                              <p className="text-[11px] leading-relaxed">
                                You can configure whether a specific account’s balances are consolidated into your overall Net Worth calculations (useful for excluding business or family helper profiles).
                              </p>
                            </div>
                          </div>
                          <div className="p-3 bg-surface-container rounded-lg font-mono text-[11px] text-on-surface border border-outline-variant">
                            <strong>Recommended Naming Example:</strong> Chase Freedom • Credit Card • ending in 1234
                          </div>
                          <div>
                            <button 
                              onClick={() => onNavigate('accounts')}
                              className="text-primary font-bold hover:underline inline-flex items-center gap-1"
                            >
                              Go set up accounts <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      )}

                      {s.id === 'download-csv' && (
                        <div className="space-y-3">
                          <p>
                            To populate LedgerLocal, log into your banking portals, credit card dashboards, or investment custodians to export recent activity.
                          </p>
                          <p>
                            Look for buttons labeled with action terms such as:
                          </p>
                          <div className="flex flex-wrap gap-2 pl-2">
                            {['Download Transactions', 'Export Activity', 'Download CSV', 'Account Activity', 'Transaction History'].map(t => (
                              <span key={t} className="px-2.5 py-1 bg-surface-container text-on-surface-variant font-semibold rounded text-[10px] border border-outline-variant">{t}</span>
                            ))}
                          </div>
                          <p>
                            <strong>Important Guidelines:</strong>
                          </p>
                          <ul className="list-disc list-inside space-y-1 pl-2">
                            <li>Always select the <strong className="text-on-surface">CSV</strong> format when available. Excel (.xls or .xlsx) is not directly readable.</li>
                            <li>Do not worry about downloading overlapping date windows. LedgerLocal’s duplicate engine will filter out transactions you already imported.</li>
                            <li>Do not modify bank CSV structures in Excel prior to upload. It might alter formatting dates or values, leading to mapping mismatches.</li>
                          </ul>
                        </div>
                      )}

                      {s.id === 'import-csv' && (
                        <div className="space-y-3">
                          <p>
                            Our CSV ingestion wizard safely parses your statement files in 5 clear visual phases:
                          </p>
                          <div className="space-y-2 relative pl-4 border-l border-primary/20 ml-2">
                            <div className="relative">
                              <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-primary" />
                              <strong className="text-on-surface block">1. File Selection:</strong> Select your CSV and specify which account it belongs to.
                            </div>
                            <div className="relative">
                              <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-primary" />
                              <strong className="text-on-surface block">2. Profile Detection:</strong> The wizard identifies saved mappings or requests a layout configuration.
                            </div>
                            <div className="relative">
                              <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-primary" />
                              <strong className="text-on-surface block">3. Field Mapping:</strong> Match bank columns (like 'Transaction Date', 'Payee Name', 'Amount') to LedgerLocal inputs.
                            </div>
                            <div className="relative">
                              <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-primary" />
                              <strong className="text-on-surface block">4. Sanitization & Review:</strong> Filter out invalid dates, missing fields, or exact duplicates.
                            </div>
                            <div className="relative">
                              <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-primary" />
                              <strong className="text-on-surface block">5. Final Ingestion:</strong> Commit the sanitized items into IndexedDB. You can undo any batch later from the Import History section.
                            </div>
                          </div>
                          <div>
                            <button 
                              onClick={() => onNavigate('imports')}
                              className="text-primary font-bold hover:underline inline-flex items-center gap-1"
                            >
                              Go to Imports <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      )}

                      {s.id === 'understand-mapping' && (
                        <div className="space-y-3">
                          <p>
                            Financial institutions layout statement rows in different ways. LedgerLocal utilizes Column Mapping so you can process any format.
                          </p>
                          <p className="font-semibold text-on-surface">Common Formats Explained:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                            <div className="p-3 bg-surface border border-outline-variant rounded-lg space-y-2">
                              <p className="font-bold text-on-surface">Signed Amount Column</p>
                              <p className="text-[11px]">All transactions share a single column. Debits are represented as negative numbers, credits as positive numbers.</p>
                              <div className="flex justify-between items-center bg-surface-container p-1 rounded">
                                <span className="font-mono text-[10px]">Example CSV structure:</span>
                                <button 
                                  onClick={() => handleCopy('csv-signed', signedCsvSample)}
                                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-bold"
                                >
                                  <Copy size={10} /> {copiedTextId === 'csv-signed' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                              <pre className="font-mono text-[9px] p-2 bg-surface-container rounded overflow-x-auto whitespace-pre">{signedCsvSample}</pre>
                            </div>
                            <div className="p-3 bg-surface border border-outline-variant rounded-lg space-y-2">
                              <p className="font-bold text-on-surface">Separate Debit & Credit Columns</p>
                              <p className="text-[11px]">Two distinct columns exist. Expense values are recorded in the 'Debit' column, payments/returns in the 'Credit' column.</p>
                              <div className="flex justify-between items-center bg-surface-container p-1 rounded">
                                <span className="font-mono text-[10px]">Example CSV structure:</span>
                                <button 
                                  onClick={() => handleCopy('csv-split', splitCsvSample)}
                                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-bold"
                                >
                                  <Copy size={10} /> {copiedTextId === 'csv-split' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                              <pre className="font-mono text-[9px] p-2 bg-surface-container rounded overflow-x-auto whitespace-pre">{splitCsvSample}</pre>
                            </div>
                          </div>
                          <ul className="list-disc list-inside space-y-1 pl-2">
                            <li><strong className="text-on-surface">Required Fields:</strong> In any layout, you must map the <strong className="text-on-surface">Posted Date</strong>, <strong className="text-on-surface">Description (or Merchant)</strong>, and <strong className="text-on-surface">Amount</strong> (or Debit & Credit).</li>
                            <li><strong className="text-on-surface">Optional Fields:</strong> Transaction Date, Category, Reference Number, or Balance.</li>
                            <li><strong className="text-on-surface">Reversing Signs:</strong> Sometimes credit cards export payments as negative and expenses as positive. Our mapping screen provides a toggle to flip signs if needed.</li>
                          </ul>
                        </div>
                      )}

                      {s.id === 'review-duplicates' && (
                        <div className="space-y-3">
                          <p>
                            To maintain an accurate ledger, LedgerLocal compares incoming rows against your existing database. Items fall into 4 primary states:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
                            <div className="p-3 bg-surface border border-outline-variant rounded-lg">
                              <p className="font-bold text-on-surface flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> New</p>
                              <p className="text-[11px] leading-relaxed mt-1">Transaction is unique. Ready for normal local ingestion.</p>
                            </div>
                            <div className="p-3 bg-surface border border-outline-variant rounded-lg">
                              <p className="font-bold text-on-surface flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stone-500" /> Exact Duplicate</p>
                              <p className="text-[11px] leading-relaxed mt-1">Shares identical date, merchant name, and cash value with a previously saved entry. Automatically skipped by default.</p>
                            </div>
                            <div className="p-3 bg-surface border border-outline-variant rounded-lg">
                              <p className="font-bold text-on-surface flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Possible Duplicate</p>
                              <p className="text-[11px] leading-relaxed mt-1">Has very similar parameters within a close 2-day threshold. Requires manual confirmation (e.g. if you bought two coffees for $4.50 on the same morning).</p>
                            </div>
                            <div className="p-3 bg-surface border border-outline-variant rounded-lg">
                              <p className="font-bold text-on-surface flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Invalid Row</p>
                              <p className="text-[11px] leading-relaxed mt-1">Missing dates, invalid currency formats, or broken symbols. Excluded from imports.</p>
                            </div>
                          </div>
                          <div className="p-3 bg-amber-500/5 border border-amber-500/20 text-on-surface-variant rounded-lg flex gap-2">
                            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                            <span><strong>Review Note:</strong> The duplicate engine assists in filtering out duplicates, but you should verify suspicious rows on the review screen to prevent ledger errors.</span>
                          </div>
                        </div>
                      )}

                      {s.id === 'organize-transactions' && (
                        <div className="space-y-3">
                          <p>
                            Once transaction rows are imported, use our organization tools to structure your ledger:
                          </p>
                          <ul className="list-disc list-inside space-y-1.5 pl-2">
                            <li><strong className="text-on-surface">Clean Names:</strong> Banks print messy terminal descriptors (e.g., <code>SQ *LOCAL CAFE CO#12</code>). LedgerLocal lets you clean these up manually or rename them to standard readable labels (e.g., <code>Local Cafe</code>).</li>
                            <li><strong className="text-on-surface">Filter & Search:</strong> Instantly filter by text, categories, cost boundaries, and date ranges.</li>
                            <li><strong className="text-on-surface">Bulk Actions:</strong> Categorize, tag, or exclude multiple transaction lines simultaneously.</li>
                            <li><strong className="text-on-surface">Categorization Rules:</strong> Automate repeated organizational steps. In LedgerLocal, rules are deterministic matching blocks you maintain yourself.</li>
                          </ul>
                          <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-1">
                            <p className="font-bold text-primary">Rules are not AI:</p>
                            <p className="text-on-surface-variant leading-relaxed">
                              <em>“Rules apply actions when transaction text or values match conditions you define.”</em>
                              <br />
                              For example, you can create a rule stating: <code>If Description contains 'AMZN', rename payee to 'Amazon' and assign to 'Shopping' category.</code> This maintains total, non-opaque control.
                            </p>
                          </div>
                          <div>
                            <button 
                              onClick={() => onNavigate('rules')}
                              className="text-primary font-bold hover:underline inline-flex items-center gap-1"
                            >
                              Go manage rules <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      )}

                      {s.id === 'transfers-refunds' && (
                        <div className="space-y-3">
                          <p>
                            Not every transaction is a direct expense or income. Properly classifying special types keeps reports accurate:
                          </p>
                          <div className="space-y-3 pl-2">
                            <div>
                              <strong className="text-on-surface block">1. Transfers</strong>
                              <p className="text-[11px]">Moving cash from checking to savings represents a Transfer. Checking shows a debit (-$100) and savings shows a credit (+$100). Mark both sides as a 'Transfer' so they exclude themselves from expense reports and do not inflate income calculations.</p>
                            </div>
                            <div>
                              <strong className="text-on-surface block">2. Credit-Card Payments</strong>
                              <p className="text-[11px]">Paying off a credit card balance from checking moves cash between two assets/liabilities. The checking debit and the card credit should both be categorized as Transfers. Your actual expenses were already recorded when you used the card for the original purchases.</p>
                            </div>
                            <div>
                              <strong className="text-on-surface block">3. Investment Transactions</strong>
                              <p className="text-[11px]">Funding a brokerage account should be marked as a Transfer. Growth, asset acquisitions, or dividend re-investments are calculated on the Investments board.</p>
                            </div>
                            <div>
                              <strong className="text-on-surface block">4. Refunds & Cashbacks</strong>
                              <p className="text-[11px]">If you return an item and receive $50 back into your account, assign the credit back to the original category (e.g., Shopping). This offsets the expense, restoring your budget limits accurately.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {s.id === 'budgets-recurring' && (
                        <div className="space-y-3">
                          <p>
                            Maintain clean guidelines around month-to-month cash allocation:
                          </p>
                          <ul className="list-disc list-inside space-y-1.5 pl-2">
                            <li><strong className="text-on-surface">Category Limits:</strong> Set spending targets per category. Progress bars show your spending relative to your limits.</li>
                            <li><strong className="text-on-surface">Rollover Budgets:</strong> Enabled on a category-by-category basis. If enabled, any unused budget surplus carries over to increase your budget next month. Likewise, overspending (deficits) reduces the following month's budget.</li>
                            <li><strong className="text-on-surface">Recurring Transactions:</strong> LedgerLocal automatically identifies potential subscriptions or repeat transactions. It searches for matching merchants, consistent dollar amounts, and repeated intervals (e.g. 1 month). These are displayed as estimated future events.</li>
                          </ul>
                          <div>
                            <button 
                              onClick={() => onNavigate('budgets')}
                              className="text-primary font-bold hover:underline inline-flex items-center gap-1"
                            >
                              Go to Budgets <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      )}

                      {s.id === 'reports-net-worth' && (
                        <div className="space-y-3">
                          <p>
                            LedgerLocal visualizes structural trends across your financial dataset:
                          </p>
                          <ul className="list-disc list-inside space-y-1.5 pl-2">
                            <li><strong className="text-on-surface">Spending Breakdown:</strong> Interactive charts sorting expense allocations by category. Filters on the screen let you isolate specific accounts or months.</li>
                            <li><strong className="text-on-surface">Net Worth Progression:</strong> Combines your asset account values (cash, savings, brokerage) and subtracts your liabilities (credit cards, loans).</li>
                            <li><strong className="text-on-surface">Balance History:</strong> Compiles historical trends using imported balance snapshots. Note that missing historical snapshots cannot be accurately reconstructed retroactively, so importing continuous CSV records or entering snapshots monthly is recommended.</li>
                          </ul>
                          <div>
                            <button 
                              onClick={() => onNavigate('reports')}
                              className="text-primary font-bold hover:underline inline-flex items-center gap-1"
                            >
                              Go to Reports <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      )}

                      {s.id === 'investments' && (
                        <div className="space-y-3">
                          <p>
                            Track investment performance manually:
                          </p>
                          <ul className="list-disc list-inside space-y-1 pl-2">
                            <li><strong className="text-on-surface">Manual Holdings:</strong> Create securities, purchase lots, quantities, and acquisition price values.</li>
                            <li><strong className="text-on-surface">Cost-Basis:</strong> Calculates returns based on initial acquisition cost versus current price snapshots.</li>
                            <li><strong className="text-on-surface">No Live Feeds:</strong> LedgerLocal does not fetch real-time stock ticker values. You must enter current security price updates manually to update valuation dashboards.</li>
                            <li><strong className="text-on-surface">No Recommendations:</strong> The board tracks what you input; it does not offer financial recommendations.</li>
                          </ul>
                          <div>
                            <button 
                              onClick={() => onNavigate('investments')}
                              className="text-primary font-bold hover:underline inline-flex items-center gap-1"
                            >
                              Go to Investments <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      )}

                      {s.id === 'backup-restore' && (
                        <div className="space-y-4">
                          <p>
                            Because LedgerLocal is entirely serverless, your data is saved solely in your browser's local sandbox. Regular backups are crucial to protect against data loss.
                          </p>
                          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2 text-xs uppercase tracking-wider">
                              <Download size={14} className="text-primary" /> Download JSON Ledger Snapshot
                            </h4>
                            <p className="text-[11px] leading-relaxed">
                              A backup exports a single structured JSON file containing all accounts, transaction logs, classification rules, budgets, and settings.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 pt-1">
                              <button
                                onClick={handleDirectExport}
                                disabled={isExporting}
                                className="px-4 py-2 rounded bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
                              >
                                {isExporting ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                                Export Backup File
                              </button>
                              <button
                                onClick={handleDirectRestore}
                                disabled={isRestoring}
                                className="px-4 py-2 rounded bg-surface hover:bg-surface-container text-on-surface border border-outline-variant font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
                              >
                                {isRestoring ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                                Import & Restore Backup
                              </button>
                            </div>
                            {settings.lastBackupDate && (
                              <p className="text-[10px] text-on-surface-variant font-medium">
                                Last successful backup: {new Date(settings.lastBackupDate).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="p-3 bg-red-500/5 border border-red-500/20 text-on-surface-variant rounded-lg space-y-1">
                            <p className="font-bold text-red-700">Backup Safety Information:</p>
                            <ul className="list-disc list-inside space-y-1 text-[11px]">
                              <li>Backups contain unencrypted, plain-text financial transaction records and account details. Keep files stored in a secure location (e.g. secure local folders or secure vaults).</li>
                              <li>Restoring a backup completely replaces all existing records in your active Local Profile.</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {s.id === 'privacy-data' && (
                        <div className="space-y-3">
                          <p>
                            Understand the boundaries of browser IndexedDB sandboxing:
                          </p>
                          <ul className="list-disc list-inside space-y-1.5 pl-2">
                            <li><strong className="text-on-surface">IndexedDB Storage:</strong> Data is written inside a client-side database native to your current browser software. Cleared site data, full history erases, or browser cleaners will permanently erase your ledger.</li>
                            <li><strong className="text-on-surface">No Multi-Device Syncing:</strong> Your datasets on your computer and mobile phone are separate. There is no automated background syncing. To move data, export a backup and import it on the other device.</li>
                            <li><strong className="text-on-surface">Private / Incognito Tabs:</strong> Private browsing sessions run temporary databases that are automatically deleted once the window is closed. Do not use incognito tabs for long-term tracking.</li>
                            <li><strong className="text-on-surface">Source Files:</strong> Uploaded CSV files are processed in-memory. They are never transmitted, nor are original files saved on our servers.</li>
                            <li><strong className="text-on-surface">No Local Encryption:</strong> LedgerLocal relies on your system and browser's built-in file sandbox permissions. It does not apply secondary encryption layers to the local IndexedDB database. Keep your device login credentials secure.</li>
                          </ul>
                        </div>
                      )}

                      {/* Understood Section Control */}
                      <div className="flex justify-between items-center pt-4 border-t border-outline-variant mt-4">
                        <button
                          onClick={() => toggleUnderstood(s.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border",
                            isUnderstood
                              ? "bg-primary/5 text-primary border-primary/25"
                              : "bg-surface hover:bg-surface-container text-on-surface-variant border-outline-variant hover:text-on-surface"
                          )}
                        >
                          <CheckCircle2 size={14} className={isUnderstood ? "fill-primary text-on-primary" : ""} />
                          {isUnderstood ? "Mark as Uncompleted" : "Mark as Understood"}
                        </button>
                        <span className="text-[10px] text-on-surface-variant font-mono">ID: {s.id}</span>
                      </div>

                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* FAQ Accordion Section */}
          <section className="card-raised rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <HelpCircle size={18} className="text-primary" /> Frequently Asked Questions
              </h3>
              <p className="text-xs text-on-surface-variant mt-1 font-medium">Find answers to common questions about LedgerLocal’s privacy, files, and architecture.</p>
            </div>

            <div className="divide-y divide-outline-variant border-t border-b border-outline-variant">
              {[
                {
                  q: "Does LedgerLocal connect to my bank?",
                  a: "No. LedgerLocal does not connect directly to banks or utilize automated credential APIs. All transaction ingestion is performed manually by exporting CSV spreadsheets from your bank and uploading them here."
                },
                {
                  q: "Does LedgerLocal use AI?",
                  a: "No. LedgerLocal relies on explicit deterministic conditions you specify in your rules. No third-party AI models receive your transaction text, keeping your workflow predictable, offline, and completely private."
                },
                {
                  q: "Where is my data stored?",
                  a: "Your data is stored strictly in your current web browser's local sandbox using the IndexedDB technology. No financial data is ever sent to or saved on an external server."
                },
                {
                  q: "Can LedgerLocal see my financial information?",
                  a: "No. Because all data is stored inside your browser's private directory and is never sent to a backend server, LedgerLocal developers or external servers have zero visibility into your assets, liabilities, transactions, or profiles."
                },
                {
                  q: "Can I use it without internet?",
                  a: "Yes! Once loaded, LedgerLocal runs entirely client-side. You do not need active internet connections to create accounts, map columns, categorize spending, edit rules, or review budgets."
                },
                {
                  q: "Why does my CSV need mapping?",
                  a: "Financial institutions do not follow a unified CSV standard. Some write positive amounts for expenses, others write negative amounts, and header column names differ. Mapping bridges these gaps so any template parses perfectly."
                },
                {
                  q: "Why was a transaction marked as a possible duplicate?",
                  a: "If an incoming transaction row matches the date (within a 2-day variance), merchant description, and amount of a recorded transaction, LedgerLocal flags it as a possible duplicate. This lets you inspect before importing, while still letting you accept multiple identical purchases (such as two coffees on the same day)."
                },
                {
                  q: "Can I import overlapping date ranges?",
                  a: "Yes. Our duplicate detection engine is designed to handle this. Exact duplicate matches will be safely skipped automatically during preview review."
                },
                {
                  q: "Can I use LedgerLocal on another computer?",
                  a: "Yes, but you must move your data manually. Go to the User Guide's Backup and Restore section, export a backup JSON file, transfer it to your other machine, and restore it in LedgerLocal there."
                },
                {
                  q: "What happens if I clear browser storage?",
                  a: "Clearing cookies, site data, or full browser application databases will erase your IndexedDB records. Always make a habit of downloading JSON backups regularly to safeguard against accidental storage clears."
                },
                {
                  q: "Does LedgerLocal fetch live investment prices?",
                  a: "No. LedgerLocal does not support live market pricing feeds. Security price snap valuations are updated manually on the Investments page."
                },
                {
                  q: "How should I back up my data?",
                  a: "We recommend exporting a backup file from the User Guide's Backup and Restore section or Settings Page weekly or after conducting major CSV imports, and saving that file to a secure, private backup location."
                }
              ].map((item, index) => {
                const isOpen = !!openFaqs[item.q];
                return (
                  <div key={index} className="py-3">
                    <button
                      onClick={() => toggleFaq(item.q)}
                      className="w-full flex items-center justify-between text-left font-bold text-on-surface text-xs hover:text-primary transition-colors py-1 outline-none"
                    >
                      <span>{item.q}</span>
                      {isOpen ? <ChevronUp size={14} className="text-on-surface-variant shrink-0" /> : <ChevronDown size={14} className="text-on-surface-variant shrink-0" />}
                    </button>
                    {isOpen && (
                      <p className="mt-2 text-[11px] text-on-surface-variant leading-relaxed pl-1 animate-in fade-in duration-150">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
