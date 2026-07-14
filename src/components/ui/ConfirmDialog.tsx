import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            {isDestructive && (
              <div className="w-10 h-10 shrink-0 rounded-full bg-error-container/20 flex items-center justify-center text-error">
                <AlertCircle size={20} />
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-on-surface mb-2">{title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-surface-container-low flex justify-end gap-3 border-t border-surface-container">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              isDestructive 
                ? 'bg-error text-on-error hover:bg-error/90' 
                : 'bg-primary text-on-primary hover:bg-primary/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
