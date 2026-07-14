import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  List, 
  Landmark, 
  PieChart, 
  Repeat, 
  TrendingUp, 
  BarChart2, 
  Upload, 
  Filter, 
  Settings,
  Wallet,
  Lock,
  Tags,
  Store,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
  LogOut,
  ChevronDown,
  HelpCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/StoreContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { settings, updateSettings, profiles, currentProfileId, changeProfile } = useStore();
  const [showProfiles, setShowProfiles] = useState(false);
  
  const isCollapsed = settings.sidebarCollapsed;

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: List },
    { id: 'accounts', label: 'Accounts', icon: Landmark },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'recurring', label: 'Recurring', icon: Repeat },
    { id: 'investments', label: 'Investments', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: BarChart2 },
    { id: 'imports', label: 'Imports', icon: Upload },
    { id: 'categories', label: 'Categories', icon: Tags },
    { id: 'merchants', label: 'Merchants', icon: Store },
    { id: 'rules', label: 'Rules', icon: Filter },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const currentProfile = profiles.find(p => p.id === currentProfileId);

  return (
    <aside className={cn(
      "flex flex-col border-r border-outline-variant bg-surface shrink-0 z-20 sticky top-0 overflow-hidden transition-all duration-300",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
              <Wallet size={20} />
            </div>
            {!isCollapsed && <span className="text-xl font-semibold tracking-tight text-on-surface truncate">LedgerLocal</span>}
          </div>
          <button 
            onClick={() => updateSettings({ sidebarCollapsed: !isCollapsed })}
            className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
        <nav className="space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 transition-colors text-left rounded-md",
                currentView === item.id 
                  ? "bg-surface-bright shadow-sm border border-outline-variant text-primary font-medium" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-medium"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon size={16} className={currentView === item.id ? "text-primary" : "text-on-surface-variant"} />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
          <button
              onClick={() => onNavigate('privacy')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 transition-colors text-left rounded-md",
                currentView === 'privacy' 
                  ? "bg-surface-bright shadow-sm border border-outline-variant text-primary font-medium" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-medium"
              )}
              title={isCollapsed ? 'Privacy' : undefined}
            >
              <Shield size={16} className={currentView === 'privacy' ? "text-primary" : "text-on-surface-variant"} />
              {!isCollapsed && <span className="text-sm font-medium">Privacy</span>}
            </button>
          <button
              onClick={() => onNavigate('guide')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 transition-colors text-left rounded-md",
                currentView === 'guide' 
                  ? "bg-surface-bright shadow-sm border border-outline-variant text-primary font-medium" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-medium"
              )}
              title={isCollapsed ? 'How to Use' : undefined}
            >
              <HelpCircle size={16} className={currentView === 'guide' ? "text-primary" : "text-on-surface-variant"} />
              {!isCollapsed && <span className="text-sm font-medium">How to Use</span>}
            </button>
        </nav>
      </div>

      <div className="mt-auto p-4 space-y-4 shrink-0">
        <div className="relative">
          {showProfiles && !isCollapsed && (
            <div className="absolute bottom-full left-0 w-full mb-2 bg-surface border border-outline-variant rounded-xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2">
              <div className="p-2 border-b border-outline-variant bg-surface-container-low">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-2">Switch Profile</p>
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { changeProfile(p.id); setShowProfiles(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors",
                      currentProfileId === p.id ? "bg-primary/10 text-primary" : "hover:bg-surface-container-high text-on-surface"
                    )}
                  >
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px]", currentProfileId === p.id ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant")}>
                      {p.name.charAt(0)}
                    </div>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <button 
            onClick={() => setShowProfiles(!showProfiles)}
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-xl transition-all",
              showProfiles ? "bg-surface-container-high shadow-inner" : "hover:bg-surface-container"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-bold shadow-sm shrink-0">
              {currentProfile?.name.charAt(0) || 'P'}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-xs font-bold text-on-surface truncate">{currentProfile?.name || 'Profile'}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Local Profile</p>
                </div>
                <ChevronDown size={14} className={cn("text-on-surface-variant transition-transform", showProfiles && "rotate-180")} />
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-on-surface-variant uppercase tracking-widest font-bold px-2">
          <Lock size={10} />
          {!isCollapsed && <span>Local Data Only</span>}
        </div>
      </div>
    </aside>
  );
}
