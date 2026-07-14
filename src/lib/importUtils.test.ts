import { describe, it, expect } from 'vitest';
import { parseCsvAmount, parseCsvDate, processCsvData } from './importUtils';

describe('importUtils', () => {
  describe('parseCsvAmount', () => {
    it('parses basic amounts', () => {
      expect(parseCsvAmount('100.00').amountCents).toBe(10000);
      expect(parseCsvAmount('-5.50').amountCents).toBe(-550);
    });

    it('handles currency symbols and commas', () => {
      expect(parseCsvAmount('$1,234.56').amountCents).toBe(123456);
    });

    it('handles parentheses for negative numbers', () => {
      expect(parseCsvAmount('(50.00)').amountCents).toBe(-5000);
    });

    it('returns invalid for non-numeric input', () => {
      const result = parseCsvAmount('abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid amount');
    });
  });

  describe('parseCsvDate', () => {
    it('parses valid dates', () => {
      expect(parseCsvDate('2026-07-01').date).toBe('2026-07-01');
      expect(parseCsvDate('07/01/2026').date).toBe('2026-07-01');
    });

    it('returns invalid for bad dates', () => {
      const result = parseCsvDate('not-a-date');
      expect(result.isValid).toBe(false);
    });
  });

  describe('processCsvData', () => {
    it('maps columns correctly', () => {
      const rawData = [
        { 'Date': '2026-07-01', 'Desc': 'Starbucks', 'Amt': '-5.50' }
      ];
      const mapping = { dateCol: 'Date', descCol: 'Desc', amountCol: 'Amt' };
      const results = processCsvData(rawData, mapping);
      
      expect(results).toHaveLength(1);
      expect(results[0].amountCents).toBe(-550);
      expect(results[0].description).toBe('Starbucks');
      expect(results[0].date).toBe('2026-07-01');
      expect(results[0].isValid).toBe(true);
    });
  });
});
