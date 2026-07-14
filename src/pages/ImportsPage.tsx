import React, { useState, useCallback } from 'react';
import { useStore } from '../store/StoreContext';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { dbApi } from '../database/db';
import { format } from 'date-fns';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { processTransactionWithRules } from '../lib/ruleEngine';
import { normalizeMerchantName } from '../lib/merchantManager';
import { Transaction } from '../models/types';
import { ParsedRow, processCsvData } from '../lib/importUtils';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'success';

interface ImportsPageProps {
  onNavigate: (view: string) => void;
}

export function ImportsPage({ onNavigate }: ImportsPageProps) {
  const { accounts, rules, refreshData } = useStore();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
  // Mapping state
  const [dateCol, setDateCol] = useState('');
  const [descCol, setDescCol] = useState('');
  const [amountCol, setAmountCol] = useState('');
  
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRawData(results.data);
          
          // Auto-guess columns
          const fields = results.meta.fields || [];
          const guessField = (keywords: string[]) => fields.find(f => keywords.some(k => f.toLowerCase().includes(k))) || '';
          
          setDateCol(guessField(['date', 'posted']));
          setDescCol(guessField(['description', 'payee', 'merchant', 'name']));
          setAmountCol(guessField(['amount', 'value']));
          
          setStep('mapping');
        }
      });
    }
  };

  const processMapping = () => {
    const rows = processCsvData(rawData, { dateCol, descCol, amountCol });
    setParsedRows(rows);
    setStep('preview');
  };

  const [errorDialog, setErrorDialog] = useState<{isOpen: boolean; message: string}>({ isOpen: false, message: '' });

  const confirmImport = async () => {
    if (!selectedAccountId) {
      setErrorDialog({ isOpen: true, message: 'Please select a destination account.' });
      return;
    }

    const validRows = parsedRows.filter(r => r.isValid);
    
    // Simulate insertion
    const newTx: Transaction[] = validRows.map((r, i) => {
      const initialTx: Transaction = {
        id: `imp_${Date.now()}_${i}`,
        accountId: selectedAccountId,
        postedDate: r.date,
        originalDescription: r.description,
        merchantName: normalizeMerchantName(r.description),
        amountCents: r.amountCents,
        excludedFromReports: false,
        isTransfer: false,
        createdAt: new Date().toISOString()
      };

      // Apply rules
      const { transaction } = processTransactionWithRules(initialTx, rules);
      return transaction;
    });

    await dbApi.putTransactions(newTx);
    
    // Update account last imported date
    const acc = accounts.find(a => a.id === selectedAccountId);
    if (acc) {
      acc.lastImportedDate = format(new Date(), 'yyyy-MM-dd');
      await dbApi.putAccount(acc);
    }
    
    await refreshData();
    setStep('success');
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      <PageHeader title="Import Transactions">
        <div className="flex items-center gap-1.5 ml-4">
          <div className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${step === 'upload' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>1. Upload</div>
          <div className="w-4 h-[1px] bg-outline-variant"></div>
          <div className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${step === 'mapping' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>2. Map</div>
          <div className="w-4 h-[1px] bg-outline-variant"></div>
          <div className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${step === 'preview' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>3. Review</div>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto pb-8">
        {step === 'upload' && (
          <div className="card-raised rounded-xl p-16 flex flex-col items-center justify-center border-dashed border-2 border-outline-variant hover:border-primary hover:bg-surface-container-low transition-colors text-center space-y-4 cursor-pointer"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              const droppedFile = e.dataTransfer.files[0];
              if (droppedFile) handleFileUpload({ target: { files: [droppedFile] } } as any);
            }}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center text-on-surface-variant mb-2">
              <UploadCloud size={32} />
            </div>
            <h3 className="text-lg font-bold text-on-surface">Drag & drop your CSV file here</h3>
            <p className="text-sm text-on-surface-variant max-w-sm">
              We support standard bank exports. <br/>
              <span className="font-semibold flex items-center justify-center gap-1 mt-2">
                Processed locally. Never leaves your device.
              </span>
            </p>
            <input id="file-upload" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </div>
        )}

        {step === 'mapping' && (
          <div className="card-raised rounded-xl p-8 space-y-8">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Destination Account</label>
              <select 
                id="import-account"
                className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-md p-2.5 text-sm shadow-sm"
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
              >
                <option value="">Select an account...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            
            <hr className="border-surface-variant" />
            
            <div>
              <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <h3 className="text-base font-bold text-on-surface">Map Columns</h3>
                <button
                  onClick={() => {
                    sessionStorage.setItem('guide_section_anchor', 'understand-mapping');
                    onNavigate('guide');
                  }}
                  className="px-2.5 py-1 text-xs text-on-surface-variant hover:text-on-surface bg-surface hover:bg-surface-container rounded-md flex items-center gap-1.5 transition-all border border-outline-variant font-semibold"
                  title="View column mapping details"
                >
                  <HelpCircle size={13} />
                  <span>Mapping Guide</span>
                </button>
              </div>
              <p className="text-sm text-on-surface-variant mb-6">We found {rawData.length} rows. Match your CSV columns to LedgerLocal fields.</p>
              
              <div className="space-y-4 max-w-xl">
                {['Date', 'Description', 'Amount'].map((field) => {
                  const csvFields = Object.keys(rawData[0] || {});
                  const val = field === 'Date' ? dateCol : field === 'Description' ? descCol : amountCol;
                  const setVal = field === 'Date' ? setDateCol : field === 'Description' ? setDescCol : setAmountCol;
                  
                  return (
                    <div key={field} className="flex items-center gap-6 p-4 rounded-lg border border-outline-variant bg-surface-container-low">
                      <div className="w-32 text-sm font-semibold text-on-surface">{field} <span className="text-error">*</span></div>
                      <select 
                        id={`map-${field.toLowerCase()}`}
                        className="flex-1 bg-surface-bright border border-outline-variant rounded p-2 text-sm shadow-sm"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                      >
                        <option value="">-- Select Column --</option>
                        {csvFields.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-6 border-t border-surface-variant">
              <button 
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
              >
                Back
              </button>
              <button 
                onClick={processMapping}
                disabled={!dateCol || !descCol || !amountCol || !selectedAccountId}
                className="btn-physical px-6 py-2 rounded-lg text-primary text-sm font-bold disabled:opacity-50"
              >
                Preview Data
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="card-raised flex flex-col h-[600px] overflow-hidden">
            <div className="p-6 border-b border-surface-variant flex justify-between items-center shrink-0">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-on-surface">Review Import</h3>
                  <button
                    onClick={() => {
                      sessionStorage.setItem('guide_section_anchor', 'review-duplicates');
                      onNavigate('guide');
                    }}
                    className="px-2 py-0.5 text-[11px] text-on-surface-variant hover:text-on-surface bg-surface hover:bg-surface-container rounded-md flex items-center gap-1 transition-all border border-outline-variant font-semibold"
                    title="View duplicate and error rules guide"
                  >
                    <HelpCircle size={12} />
                    <span>Review Guide</span>
                  </button>
                </div>
                <p className="text-sm text-on-surface-variant mt-1">
                  {parsedRows.filter(r => r.isValid).length} ready to import, {parsedRows.filter(r => !r.isValid).length} issues
                </p>
              </div>
              <div className="flex gap-4 items-center">
                <button onClick={() => setStep('mapping')} className="text-sm font-semibold text-on-surface-variant hover:text-on-surface">
                  Back
                </button>
                <button onClick={confirmImport} className="btn-physical px-6 py-2 rounded-lg text-primary text-sm font-bold">
                  Import {parsedRows.filter(r => r.isValid).length} Transactions
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-surface-container-low sticky top-0 shadow-[0_1px_0_var(--color-surface-container)] z-10">
                  <tr className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    <th className="py-3 px-4 w-16">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {parsedRows.map((row, i) => (
                    <tr key={i} className={`h-10 ${!row.isValid ? 'bg-error-container/10' : 'hover:bg-surface-container-low'}`}>
                      <td className="py-2 px-4">
                        {row.isValid ? 
                          <CheckCircle2 size={16} className="text-primary" /> : 
                          <AlertCircle size={16} className="text-error" title={row.error} />
                        }
                      </td>
                      <td className="py-2 px-4 tabular-nums text-on-surface-variant">{row.date || 'Invalid'}</td>
                      <td className="py-2 px-4 font-medium truncate max-w-sm">{row.description}</td>
                      <td className={`py-2 px-4 text-right tabular-nums ${row.amountCents < 0 ? 'text-on-surface' : 'text-primary font-medium'}`}>
                        {row.isValid ? (row.amountCents / 100).toFixed(2) : 'Invalid'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="card-raised rounded-xl p-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-primary-container/20 rounded-full flex items-center justify-center text-primary mb-2">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-on-surface">Import Complete</h3>
            <p className="text-sm text-on-surface-variant mb-6 max-w-sm">
              Successfully added {parsedRows.filter(r => r.isValid).length} transactions. They are now securely stored on your device.
            </p>
            <div className="flex gap-4 mt-6">
              <button 
                onClick={() => {
                  setFile(null);
                  setStep('upload');
                }}
                className="px-6 py-2 rounded-lg bg-surface-container text-on-surface font-semibold border border-outline-variant"
              >
                Import Another
              </button>
              <button 
                onClick={() => onNavigate('transactions')}
                className="btn-physical px-6 py-2 rounded-lg text-primary font-bold"
              >
                View Transactions
              </button>
            </div>
          </div>
        )}
      </div>
      
      <ConfirmDialog 
        isOpen={errorDialog.isOpen}
        title="Validation Error"
        message={errorDialog.message}
        isDestructive={true}
        confirmLabel="OK"
        onConfirm={() => setErrorDialog(prev => ({ ...prev, isOpen: false }))}
        onCancel={() => setErrorDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
