import { describe, it, expect } from 'vitest';
import { evaluateCondition, evaluateGroup, applyRuleActions, processTransactionWithRules } from './ruleEngine';
import { Transaction, Rule, RuleCondition, RuleAction } from '../models/types';

describe('ruleEngine', () => {
  const mockTx: Transaction = {
    id: 'tx1',
    accountId: 'acc1',
    postedDate: '2026-07-01',
    originalDescription: 'STARBUCKS COFFEE #123',
    merchantName: 'Starbucks',
    amountCents: -550,
    categoryId: 'food',
    excludedFromReports: false,
    isTransfer: false,
    createdAt: new Date().toISOString(),
  };

  describe('evaluateCondition', () => {
    it('handles contains operator', () => {
      const condition: RuleCondition = { field: 'description', operator: 'contains', value: 'starbucks' };
      expect(evaluateCondition(mockTx, condition)).toBe(true);
    });

    it('handles equals operator', () => {
      const condition: RuleCondition = { field: 'merchant', operator: 'equals', value: 'Starbucks' };
      expect(evaluateCondition(mockTx, condition)).toBe(true);
    });

    it('handles gt operator for amount', () => {
      const condition: RuleCondition = { field: 'amount', operator: 'gt', value: 500 };
      expect(evaluateCondition(mockTx, condition)).toBe(true);
    });

    it('handles lt operator for amount', () => {
      const condition: RuleCondition = { field: 'amount', operator: 'lt', value: 1000 };
      expect(evaluateCondition(mockTx, condition)).toBe(true);
    });

    it('handles matches operator (regex)', () => {
      const condition: RuleCondition = { field: 'description', operator: 'matches', value: 'COFFEE #\\d+' };
      expect(evaluateCondition(mockTx, condition)).toBe(true);
    });

    it('handles not_contains operator', () => {
      const condition: RuleCondition = { field: 'description', operator: 'not_contains', value: 'PEPSI' };
      expect(evaluateCondition(mockTx, condition)).toBe(true);
    });

    it('handles starts_with operator', () => {
      const condition: RuleCondition = { field: 'description', operator: 'starts_with', value: 'STARBUCKS' };
      expect(evaluateCondition(mockTx, condition)).toBe(true);
    });

    it('handles ends_with operator', () => {
      const condition: RuleCondition = { field: 'description', operator: 'ends_with', value: '#123' };
      expect(evaluateCondition(mockTx, condition)).toBe(true);
    });

    it('handles is_empty and is_not_empty operators', () => {
      const condition1: RuleCondition = { field: 'notes', operator: 'is_empty', value: '' };
      expect(evaluateCondition(mockTx, condition1)).toBe(true);
      const condition2: RuleCondition = { field: 'description', operator: 'is_not_empty', value: '' };
      expect(evaluateCondition(mockTx, condition2)).toBe(true);
    });

    it('handles debit_credit field', () => {
      const condition: RuleCondition = { field: 'debit_credit', operator: 'equals', value: 'debit' };
      expect(evaluateCondition(mockTx, condition)).toBe(true);
    });
  });

  describe('evaluateGroup', () => {
    it('handles AND logic', () => {
      const rule = {
        logic: 'AND' as const,
        conditions: [
          { field: 'merchant' as const, operator: 'contains' as const, value: 'Star' },
          { field: 'amount' as const, operator: 'gt' as const, value: 500 }
        ]
      };
      expect(evaluateGroup(mockTx, rule)).toBe(true);
    });

    it('handles OR logic', () => {
      const rule = {
        logic: 'OR' as const,
        conditions: [
          { field: 'merchant' as const, operator: 'contains' as const, value: 'Star' },
          { field: 'amount' as const, operator: 'gt' as const, value: 1000 }
        ]
      };
      expect(evaluateGroup(mockTx, rule)).toBe(true);
    });
  });

  describe('applyRuleActions', () => {
    it('renames merchant', () => {
      const actions: RuleAction[] = [{ type: 'rename_merchant', value: 'Starbucks Coffee' }];
      const result = applyRuleActions(mockTx, actions, 'rule1');
      expect(result.merchantName).toBe('Starbucks Coffee');
    });

    it('assigns category', () => {
      const actions: RuleAction[] = [{ type: 'assign_category', value: 'dining' }];
      const result = applyRuleActions(mockTx, actions, 'rule1');
      expect(result.categoryId).toBe('dining');
    });

    it('handles tags, transfers, refunds, reports, and notes', () => {
      const actions: RuleAction[] = [
        { type: 'add_tag', value: 'coffee' },
        { type: 'mark_transfer', value: true },
        { type: 'mark_refund', value: true },
        { type: 'exclude_reports', value: true },
        { type: 'add_note_prefix', value: 'IMPORTANT: ' }
      ];
      const result = applyRuleActions(mockTx, actions, 'rule1');
      expect(result.tags).toContain('coffee');
      expect(result.isTransfer).toBe(true);
      expect(result.isRefund).toBe(true);
      expect(result.excludedFromReports).toBe(true);
      expect(result.notes).toBe('IMPORTANT: ');
    });
  });

  describe('processTransactionWithRules', () => {
    it('applies rules in priority order', () => {
      const rules: Rule[] = [
        {
          id: 'rule_high',
          name: 'High Priority',
          priority: 1,
          enabled: true,
          logic: 'AND',
          conditions: [{ field: 'merchant', operator: 'contains', value: 'Star' }],
          actions: [{ type: 'rename_merchant', value: 'High Priority Rename' }],
          matchCount: 0,
          createdAt: ''
        },
        {
          id: 'rule_low',
          name: 'Low Priority',
          priority: 10,
          enabled: true,
          logic: 'AND',
          conditions: [{ field: 'merchant', operator: 'contains', value: 'Star' }],
          actions: [{ type: 'rename_merchant', value: 'Low Priority Rename' }],
          matchCount: 0,
          createdAt: ''
        }
      ];
      const result = processTransactionWithRules(mockTx, rules);
      expect(result.transaction.merchantName).toBe('High Priority Rename');
      expect(result.appliedRuleId).toBe('rule_high');
    });
  });
});
