import { describe, it, expect } from 'vitest';
import { evaluateCondition } from './ruleEngine';
import { createTransaction } from '../test/factories/modelFactories';

describe('ruleEngine - notes field', () => {
  it('should match transaction notes with contains operator', () => {
    const tx = createTransaction({ notes: 'Special Purchase' });
    const condition = { field: 'notes' as any, operator: 'contains' as any, value: 'Special' };
    expect(evaluateCondition(tx, condition)).toBe(true);
  });

  it('should not match when notes do not contain value', () => {
    const tx = createTransaction({ notes: 'Regular bill' });
    const condition = { field: 'notes' as any, operator: 'contains' as any, value: 'Special' };
    expect(evaluateCondition(tx, condition)).toBe(false);
  });

  it('should handle missing notes gracefully', () => {
    const tx = createTransaction({ notes: undefined });
    const condition = { field: 'notes' as any, operator: 'contains' as any, value: 'Special' };
    expect(evaluateCondition(tx, condition)).toBe(false);
  });
});
