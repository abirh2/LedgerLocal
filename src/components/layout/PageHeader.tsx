import React from 'react';
import { Database } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
  onImportClick?: () => void;
}

export function PageHeader({ title, children, onImportClick }: PageHeaderProps) {
  return (
    <header className="h-16 flex items-center justify-between shrink-0 mb-6">
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-on-surface truncate">{title}</h1>
        {children && (
          <div className="flex items-center gap-3 overflow-x-auto flex-1">
            {children}
          </div>
        )}
      </div>
      
      {onImportClick && (
        <div className="flex items-center gap-3 ml-6 shrink-0">
          <button 
            onClick={onImportClick}
            className="btn-physical px-4 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2"
          >
            <Database size={16} />
            Import CSV
          </button>
        </div>
      )}
    </header>
  );
}