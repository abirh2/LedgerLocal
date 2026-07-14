import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { dbApi } from '../database/db';
import { Plus, Edit2, Trash2, GripVertical, Play, Eye, Copy, Save, X, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Rule, RuleCondition, RuleAction, RuleGroup, Transaction, RuleConditionField, RuleConditionOperator } from '../models/types';
import { cn } from '../lib/utils';
import { evaluateGroup, applyRuleActions, processTransactionWithRules } from '../lib/ruleEngine';

const FIELD_OPTIONS: { value: RuleConditionField, label: string }[] = [
  { value: 'description', label: 'Description' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'account', label: 'Account' },
  { value: 'category', label: 'Category' },
  { value: 'amount', label: 'Amount' },
  { value: 'type', label: 'Transaction Type' },
  { value: 'date', label: 'Date' },
  { value: 'debit_credit', label: 'Debit/Credit' },
];

const OPERATOR_OPTIONS: { value: RuleConditionOperator, label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'equals', label: 'Equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
  { value: 'matches', label: 'Matches Regex' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

const ACTION_OPTIONS = [
  { value: 'rename_merchant', label: 'Rename Merchant' },
  { value: 'assign_category', label: 'Assign Category' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'remove_tag', label: 'Remove Tag' },
  { value: 'mark_transfer', label: 'Mark as Transfer' },
  { value: 'mark_refund', label: 'Mark as Refund' },
  { value: 'exclude_reports', label: 'Exclude from Reports' },
  { value: 'include_reports', label: 'Include in Reports' },
  { value: 'add_note_prefix', label: 'Add Note Prefix' },
];

export function RulesPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { rules, transactions, categories, accounts, refreshData } = useStore();
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewRule, setPreviewRule] = useState<Rule | null>(null);

  // Editor State
  const [ruleName, setRuleName] = useState('');
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const [priority, setPriority] = useState(0);

  const handleCreateRule = () => {
    setEditingRule(null);
    setRuleName('New Rule');
    setLogic('AND');
    setConditions([{ field: 'description', operator: 'contains', value: '' }]);
    setActions([{ type: 'assign_category', value: '' }]);
    setPriority(rules.length);
    setShowEditor(true);
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setLogic(rule.logic);
    setConditions(rule.conditions.filter(c => 'field' in c) as RuleCondition[]);
    setActions(rule.actions);
    setPriority(rule.priority);
    setShowEditor(true);
  };

  const handleSaveRule = async () => {
    const newRule: Rule = {
      id: editingRule?.id || `r_${Date.now()}`,
      name: ruleName,
      priority,
      enabled: editingRule?.enabled ?? true,
      conditions,
      actions,
      logic,
      matchCount: editingRule?.matchCount || 0,
      createdAt: editingRule?.createdAt || new Date().toISOString()
    };
    await dbApi.putRule(newRule);
    setShowEditor(false);
    refreshData();
  };

  const handleDeleteRule = async (id: string) => {
    if (confirm('Delete this rule?')) {
      await dbApi.deleteRule(id);
      refreshData();
    }
  };

  const handleRunRules = async (onAll: boolean) => {
    const txsToProcess = onAll 
      ? transactions 
      : transactions.filter(t => !t.categoryId || t.categoryId === 'uncategorized');
    
    let affectedCount = 0;
    const updatedTxs: Transaction[] = [];

    for (const tx of txsToProcess) {
      const { transaction, appliedRuleId } = processTransactionWithRules(tx, rules);
      if (appliedRuleId) {
        updatedTxs.push(transaction);
        affectedCount++;
      }
    }

    if (affectedCount > 0) {
      if (confirm(`Applying rules will update ${affectedCount} transactions. Continue?`)) {
        await dbApi.putTransactions(updatedTxs);
        alert(`Successfully updated ${affectedCount} transactions.`);
        refreshData();
      }
    } else {
      alert('No transactions matched the current rules.');
    }
  };

  const previewMatches = useMemo(() => {
    if (!previewRule) return [];
    return transactions.filter(tx => {
      if (tx.manualEdit) return false;
      return previewRule.logic === 'AND' 
        ? previewRule.conditions.every(c => evaluateGroup(tx, c))
        : previewRule.conditions.some(c => evaluateGroup(tx, c));
    });
  }, [previewRule, transactions]);

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader title="Categorization Rules">
        <div className="flex gap-2">
          <button
            onClick={() => {
              sessionStorage.setItem('guide_section_anchor', 'organize-transactions');
              onNavigate('guide');
            }}
            className="px-3.5 py-1.5 text-xs text-on-surface-variant hover:text-on-surface bg-surface border border-outline-variant hover:bg-surface-container rounded-md flex items-center gap-1.5 transition-colors shadow-sm font-semibold"
            title="View categorization and rules guide"
          >
            <HelpCircle size={14} />
            <span>Help Guide</span>
          </button>
          <button onClick={() => handleRunRules(false)} className="btn btn-secondary flex items-center gap-2">
            <Play size={16} />
            Run on Uncategorized
          </button>
          <button onClick={handleCreateRule} className="btn btn-primary flex items-center gap-2">
            <Plus size={16} />
            Create Rule
          </button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="card-raised overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-surface-container">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Rule Name</th>
                <th className="px-6 py-4">Conditions</th>
                <th className="px-6 py-4">Actions</th>
                <th className="px-6 py-4">Matches</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {rules.map((rule, idx) => (
                <tr key={rule.id} className={cn("hover:bg-surface-container-lowest transition-colors group", !rule.enabled && "opacity-50 grayscale")}>
                  <td className="px-6 py-4 text-outline group-hover:text-on-surface-variant cursor-grab">
                    <GripVertical size={16} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-on-surface">{rule.name}</div>
                    <div className="text-[10px] text-on-surface-variant">Priority {rule.priority}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium">
                    <div className="max-w-xs truncate">
                      {rule.logic}: {rule.conditions.length} conditions
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {rule.actions.map((a, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded font-bold uppercase tracking-tighter text-[9px]">
                          {a.type.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{rule.matchCount}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setPreviewRule(rule); setShowPreview(true); }} className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant" title="Preview Matches">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleEditRule(rule)} className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDeleteRule(rule.id)} className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rules.length === 0 && (
            <div className="p-12 text-center text-on-surface-variant space-y-4">
              <p>No rules created yet.</p>
              <button onClick={handleCreateRule} className="btn btn-primary inline-flex items-center gap-2">
                <Plus size={16} /> Create Your First Rule
              </button>
            </div>
          )}
        </div>
      </div>

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl border border-outline-variant my-8">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between sticky top-0 bg-surface-container-lowest z-10 rounded-t-3xl">
              <h3 className="text-xl font-bold">{editingRule ? 'Edit Rule' : 'New Rule'}</h3>
              <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-surface-container rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Name & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="rule-name" className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Rule Name</label>
                  <input id="rule-name" value={ruleName} onChange={e => setRuleName(e.target.value)} className="input-physical w-full" placeholder="Rule Name" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="rule-priority" className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Priority</label>
                  <input id="rule-priority" type="number" value={priority} onChange={e => setPriority(parseInt(e.target.value))} className="input-physical w-full" />
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-on-surface">Conditions</h4>
                  <select value={logic} onChange={e => setLogic(e.target.value as any)} className="bg-surface-container px-3 py-1 rounded-lg text-sm font-bold border border-outline-variant">
                    <option value="AND">ALL match (AND)</option>
                    <option value="OR">ANY match (OR)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  {conditions.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30">
                      <select id={`condition-field-${i}`} value={c.field} onChange={e => {
                        const next = [...conditions];
                        next[i].field = e.target.value as any;
                        setConditions(next);
                      }} className="bg-surface px-2 py-1.5 rounded-lg text-sm border border-outline-variant flex-1">
                        {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <select id={`condition-operator-${i}`} value={c.operator} onChange={e => {
                        const next = [...conditions];
                        next[i].operator = e.target.value as any;
                        setConditions(next);
                      }} className="bg-surface px-2 py-1.5 rounded-lg text-sm border border-outline-variant flex-1">
                        {OPERATOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input id={`condition-value-${i}`} value={c.value} onChange={e => {
                        const next = [...conditions];
                        next[i].value = e.target.value;
                        setConditions(next);
                      }} className="bg-surface px-3 py-1.5 rounded-lg text-sm border border-outline-variant flex-1" placeholder="Value" />
                      <button onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))} className="p-1.5 text-error hover:bg-error/10 rounded-md">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setConditions([...conditions, { field: 'description', operator: 'contains', value: '' }])} className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                    <Plus size={14} /> Add Condition
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <h4 className="font-bold text-on-surface">Actions</h4>
                <div className="space-y-3">
                  {actions.map((a, i) => (
                    <div key={i} className="flex gap-2 items-center bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30">
                      <select id={`action-type-${i}`} value={a.type} onChange={e => {
                        const next = [...actions];
                        next[i].type = e.target.value as any;
                        setActions(next);
                      }} className="bg-surface px-2 py-1.5 rounded-lg text-sm border border-outline-variant flex-1">
                        {ACTION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      {a.type === 'assign_category' ? (
                        <select id={`action-value-${i}`} value={a.value} onChange={e => {
                          const next = [...actions];
                          next[i].value = e.target.value;
                          setActions(next);
                        }} className="bg-surface px-2 py-1.5 rounded-lg text-sm border border-outline-variant flex-1">
                          <option value="">Select Category</option>
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                      ) : (
                        <input 
                          id={`action-value-${i}`}
                          value={a.value} 
                          onChange={e => {
                            const next = [...actions];
                            next[i].value = e.target.value;
                            setActions(next);
                          }} 
                          className="bg-surface px-3 py-1.5 rounded-lg text-sm border border-outline-variant flex-1" 
                          placeholder={a.type === 'rename_merchant' ? "New Merchant Name" : "Value..."} 
                        />
                      )}
                      <button onClick={() => setActions(actions.filter((_, idx) => idx !== i))} className="p-1.5 text-error hover:bg-error/10 rounded-md">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setActions([...actions, { type: 'assign_category', value: '' }])} className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                    <Plus size={14} /> Add Action
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant flex gap-3 sticky bottom-0 bg-surface-container-lowest z-10 rounded-b-3xl">
              <button onClick={() => setShowEditor(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleSaveRule} className="btn btn-primary flex-1">Save Rule</button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-4xl rounded-3xl shadow-2xl border border-outline-variant max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-outline-variant flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Rule Preview: {previewRule?.name}</h3>
                <p className="text-sm text-on-surface-variant">{previewMatches.length} matching transactions</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-surface-container rounded-full"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-surface-container sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Original Category</th>
                    <th className="px-6 py-4">Proposed Change</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {previewMatches.map(tx => {
                    const proposed = applyRuleActions(tx, previewRule!.actions, previewRule!.id);
                    return (
                      <tr key={tx.id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="px-6 py-4 text-sm">{tx.postedDate}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-on-surface">{tx.merchantName}</div>
                          <div className="text-[10px] text-on-surface-variant truncate max-w-xs">{tx.originalDescription}</div>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {categories.find(c => c.id === tx.categoryId)?.name || 'Uncategorized'}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-primary">
                          {categories.find(c => c.id === proposed.categoryId)?.name}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-sm">
                          ${(tx.amountCents / 100).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
