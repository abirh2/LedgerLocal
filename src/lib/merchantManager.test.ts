import { describe, it, expect } from 'vitest';
import { normalizeMerchantName, generateMerchantsFromTransactions } from './merchantManager';

describe('merchantManager', () => {
  describe('normalizeMerchantName', () => {
    it('removes common suffixes', () => {
      expect(normalizeMerchantName('AMAZON INC')).toBe('AMAZON');
      expect(normalizeMerchantName('GOOGLE LLC')).toBe('GOOGLE');
      expect(normalizeMerchantName('APPLE CO')).toBe('APPLE');
    });

    it('removes transaction noise', () => {
      expect(normalizeMerchantName('PURCHASE STARBUCKS')).toBe('STARBUCKS');
      expect(normalizeMerchantName('CHECKCARD TARGET')).toBe('TARGET');
    });

    it('removes terminal IDs and numbers', () => {
      expect(normalizeMerchantName('WALMART #1234')).toBe('WALMART');
      expect(normalizeMerchantName('SHELL *8888')).toBe('SHELL');
    });

    it('cleans up extra spaces', () => {
      expect(normalizeMerchantName('  SUBWAY   SANDWICHES  ')).toBe('SUBWAY SANDWICHES');
    });

    it('handles mixed case by converting to upper', () => {
      expect(normalizeMerchantName('Netflix.com')).toBe('NETFLIX.COM');
    });
  });

  describe('generateMerchantsFromTransactions', () => {
    it('creates merchants and collects original descriptions', () => {
      const transactions: any[] = [
        { originalDescription: 'WALMART #123', merchantName: '' },
        { originalDescription: 'WALMART #456', merchantName: '' },
        { originalDescription: 'TARGET STORE', merchantName: '' }
      ];
      const merchants = generateMerchantsFromTransactions(transactions);
      expect(merchants.length).toBe(2);
      const walmart = merchants.find(m => m.name === 'WALMART');
      expect(walmart?.originalDescriptions).toContain('WALMART #123');
      expect(walmart?.originalDescriptions).toContain('WALMART #456');
    });
  });
});
