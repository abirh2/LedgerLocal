import { Transaction, Rule, RuleCondition, RuleGroup, RuleAction, RuleConditionField, RuleConditionOperator } from '../models/types';

export function evaluateCondition(tx: Transaction, condition: RuleCondition): boolean {
  const { field, operator, value } = condition;
  let txValue: any;

  switch (field) {
    case 'description': txValue = tx.originalDescription; break;
    case 'merchant': txValue = tx.merchantName; break;
    case 'account': txValue = tx.accountId; break;
    case 'category': txValue = tx.categoryId; break;
    case 'amount': txValue = Math.abs(tx.amountCents); break;
    case 'type': txValue = tx.transactionType; break;
    case 'date': txValue = tx.postedDate; break;
    case 'notes': txValue = tx.notes; break;
    case 'debit_credit': txValue = tx.amountCents < 0 ? 'debit' : 'credit'; break;
    default: return false;
  }

  if (txValue === undefined || txValue === null) return operator === 'is_empty';

  switch (operator) {
    case 'contains': return String(txValue).toLowerCase().includes(String(value).toLowerCase());
    case 'not_contains': return !String(txValue).toLowerCase().includes(String(value).toLowerCase());
    case 'starts_with': return String(txValue).toLowerCase().startsWith(String(value).toLowerCase());
    case 'ends_with': return String(txValue).toLowerCase().endsWith(String(value).toLowerCase());
    case 'equals': return String(txValue).toLowerCase() === String(value).toLowerCase();
    case 'gt': return Number(txValue) > Number(value);
    case 'lt': return Number(txValue) < Number(value);
    case 'matches': return new RegExp(String(value), 'i').test(String(txValue));
    case 'is_empty': return String(txValue).trim() === '';
    case 'is_not_empty': return String(txValue).trim() !== '';
    default: return false;
  }
}

export function evaluateGroup(tx: Transaction, group: RuleGroup | RuleCondition): boolean {
  if ('field' in group) {
    return evaluateCondition(tx, group);
  }

  if (group.logic === 'AND') {
    return group.conditions.every(c => evaluateGroup(tx, c));
  } else {
    return group.conditions.some(c => evaluateGroup(tx, c));
  }
}

export function applyRuleActions(tx: Transaction, actions: RuleAction[], ruleId: string): Transaction {
  const newTx = { ...tx, ruleId };
  
  for (const action of actions) {
    switch (action.type) {
      case 'rename_merchant':
        newTx.merchantName = action.value;
        break;
      case 'assign_category':
        newTx.categoryId = action.value;
        break;
      case 'add_tag':
        newTx.tags = Array.from(new Set([...(newTx.tags || []), action.value]));
        break;
      case 'remove_tag':
        newTx.tags = (newTx.tags || []).filter(t => t !== action.value);
        break;
      case 'mark_transfer':
        newTx.isTransfer = action.value === true;
        break;
      case 'mark_refund':
        newTx.isRefund = action.value === true;
        break;
      case 'exclude_reports':
        newTx.excludedFromReports = true;
        break;
      case 'include_reports':
        newTx.excludedFromReports = false;
        break;
      case 'add_note_prefix':
        newTx.notes = `${action.value}${newTx.notes || ''}`;
        break;
    }
  }

  return newTx;
}

export function processTransactionWithRules(tx: Transaction, rules: Rule[]): { transaction: Transaction, appliedRuleId?: string } {
  // Only apply to transactions that haven't been manually edited
  if (tx.manualEdit) return { transaction: tx };

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (!rule.enabled) continue;

    const matches = rule.logic === 'AND' 
      ? rule.conditions.every(c => evaluateGroup(tx, c))
      : rule.conditions.some(c => evaluateGroup(tx, c));

    if (matches) {
      if (rule.actions && rule.actions.length > 0) {
        return { 
          transaction: applyRuleActions(tx, rule.actions, rule.id),
          appliedRuleId: rule.id
        };
      }
    }
  }
  
  return { transaction: tx };
}
