import type { DateFormatId, ParsedDate } from './types';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function validYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1000 || y > 9999) return false;
  // Reject clearly impossible days without timezone Date construction
  if (d > 30 && [4, 6, 9, 11].includes(m)) return false;
  if (m === 2 && d > 29) return false;
  if (m === 2 && d === 29) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (!leap) return false;
  }
  return true;
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function tryFormat(raw: string, format: DateFormatId): string | null {
  const s = raw.trim().replace(/^["']|["']$/g, '');
  if (!s) return null;

  if (format === 'YYYY-MM-DD') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return validYmd(y, mo, d) ? toIso(y, mo, d) : null;
  }

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!slash) return null;
  const a = Number(slash[1]);
  const b = Number(slash[2]);
  const y = Number(slash[3]);

  if (format === 'MM/DD/YYYY' || format === 'M/D/YYYY') {
    return validYmd(y, a, b) ? toIso(y, a, b) : null;
  }
  if (format === 'DD/MM/YYYY' || format === 'D/M/YYYY') {
    return validYmd(y, b, a) ? toIso(y, b, a) : null;
  }
  return null;
}

/**
 * Profile-driven date parsing. Never timezone-shifts.
 * When multiple configured formats produce different ISO dates, status is ambiguous.
 */
export function parseDate(
  raw: unknown,
  formats: DateFormatId | DateFormatId[] = ['YYYY-MM-DD', 'MM/DD/YYYY']
): ParsedDate {
  if (raw == null || String(raw).trim() === '') {
    return { status: 'blank', error: 'Missing date' };
  }
  const s = String(raw).trim();
  const list = Array.isArray(formats) ? formats : [formats];
  const hits: { format: DateFormatId; date: string }[] = [];

  for (const f of list) {
    const date = tryFormat(s, f);
    if (date) hits.push({ format: f, date });
  }

  if (hits.length === 0) {
    return { status: 'invalid', error: 'Invalid date' };
  }

  const unique = [...new Set(hits.map((h) => h.date))];
  if (unique.length > 1) {
    return {
      status: 'ambiguous',
      candidates: unique,
      error: 'Ambiguous date — confirm format',
    };
  }

  return {
    date: unique[0],
    status: 'valid',
    formatUsed: hits[0].format,
  };
}

/** Strict MM/DD/YYYY helper used by institution importers. */
export function parseMMDDYYYYStrict(raw: unknown): ParsedDate {
  return parseDate(raw, 'MM/DD/YYYY');
}
