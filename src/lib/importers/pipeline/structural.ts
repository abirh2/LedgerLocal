import type { StructuralBalanceKind } from './types';

const STRUCTURAL_PATTERNS: { kind: StructuralBalanceKind; re: RegExp }[] = [
  { kind: 'beginning_balance', re: /^(beginning|opening)\s+balance(\s+as\s+of)?/i },
  { kind: 'ending_balance', re: /^(ending|closing)\s+balance(\s+as\s+of)?/i },
  { kind: 'available_balance', re: /^available\s+balance/i },
  { kind: 'statement_balance', re: /^statement\s+balance/i },
  { kind: 'total_credits', re: /^total\s+credits?/i },
  { kind: 'total_debits', re: /^total\s+debits?/i },
  { kind: 'totals', re: /^totals?\b/i },
  { kind: 'pending_balance', re: /^pending\s+balance/i },
];

export function matchStructuralKind(
  text: string,
  extraPatterns: string[] = []
): StructuralBalanceKind | null {
  const t = text.trim();
  if (!t) return null;
  for (const { kind, re } of STRUCTURAL_PATTERNS) {
    if (re.test(t)) return kind;
  }
  for (const p of extraPatterns) {
    try {
      if (new RegExp(p, 'i').test(t)) return 'totals';
    } catch {
      if (t.toLowerCase().includes(p.toLowerCase())) return 'totals';
    }
  }
  return null;
}

export function isOpeningBalanceKind(kind: StructuralBalanceKind | undefined): boolean {
  return kind === 'beginning_balance';
}
