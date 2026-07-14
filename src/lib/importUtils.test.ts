import { describe, it, expect } from 'vitest';
import { parseCsvAmount, parseCsvDate, parseMMDDYYYY, processCsvData, redactForDiagnostics } from './importUtils';

describe('importUtils', () => {
  describe('parseCsvAmount', () => {
    it('parses basic amounts with integer cents', () => {
      expect(parseCsvAmount('100.00').amountCents).toBe(10000);
      expect(parseCsvAmount('-5.50').amountCents).toBe(-550);
      expect(parseCsvAmount('123.45').amountCents).toBe(12345);
    });

    it('handles currency symbols, quotes, and commas', () => {
      expect(parseCsvAmount('$1,234.56').amountCents).toBe(123456);
      expect(parseCsvAmount('"1,234.56"').amountCents).toBe(123456);
      expect(parseCsvAmount('"-1,234.56"').amountCents).toBe(-123456);
    });

    it('handles parentheses for negative numbers', () => {
      expect(parseCsvAmount('(50.00)').amountCents).toBe(-5000);
    });

    it('treats blank as missing, not zero', () => {
      const blank = parseCsvAmount('');
      expect(blank.isBlank).toBe(true);
      expect(blank.isValid).toBe(false);
      expect(parseCsvAmount('0').amountCents).toBe(0);
      expect(parseCsvAmount('0').isValid).toBe(true);
    });

    it('returns invalid for non-numeric input', () => {
      const result = parseCsvAmount('abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid amount');
    });
  });

  describe('parseCsvDate / parseMMDDYYYY', () => {
    it('parses ISO and MM/DD/YYYY without timezone shift', () => {
      expect(parseCsvDate('2026-07-01').date).toBe('2026-07-01');
      expect(parseCsvDate('07/01/2026').date).toBe('2026-07-01');
      expect(parseMMDDYYYY('1/5/2026').date).toBe('2026-01-05');
    });

    it('returns invalid for bad dates', () => {
      expect(parseCsvDate('not-a-date').isValid).toBe(false);
      expect(parseMMDDYYYY('2026-07-01').isValid).toBe(false);
    });
  });

  describe('processCsvData', () => {
    it('maps columns and preserves full description', () => {
      const long = 'A'.repeat(250);
      const rawData = [{ Date: '2026-07-01', Desc: long, Amt: '-5.50' }];
      const results = processCsvData(rawData, { dateCol: 'Date', descCol: 'Desc', amountCol: 'Amt' });
      expect(results).toHaveLength(1);
      expect(results[0].amountCents).toBe(-550);
      expect(results[0].description).toBe(long);
      expect(results[0].date).toBe('2026-07-01');
      expect(results[0].isValid).toBe(true);
    });
  });

  describe('redactForDiagnostics', () => {
    it('redacts likely identifiers', () => {
      const out = redactForDiagnostics('CONF 445566 Merchant #7788');
      expect(out).not.toMatch(/445566/);
      expect(out).not.toMatch(/#7788/);
    });
  });
});
