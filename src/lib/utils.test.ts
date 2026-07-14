import { describe, it, expect } from 'vitest';
import { formatCurrency } from './utils';

describe('formatCurrency', () => {
  it('formats positive cents correctly', () => {
    expect(formatCurrency(10000)).toBe('$100.00');
    expect(formatCurrency(550)).toBe('$5.50');
  });

  it('formats negative cents correctly', () => {
    expect(formatCurrency(-10000)).toBe('-$100.00');
    expect(formatCurrency(-50)).toBe('-$0.50');
  });

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles large amounts', () => {
    expect(formatCurrency(100000000)).toBe('$1,000,000.00');
  });
});
