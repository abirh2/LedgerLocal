import Papa from 'papaparse';

export interface ParseMatrixResult {
  rows: string[][];
  delimiter: string;
}

const DELIMITER_CANDIDATES = [',', ';', '\t', '|'] as const;

/** Score delimiter by consistent column counts on non-blank early rows. */
export function detectDelimiter(text: string, preferred?: string): string {
  if (preferred && DELIMITER_CANDIDATES.includes(preferred as (typeof DELIMITER_CANDIDATES)[number])) {
    return preferred;
  }

  const sample = text.slice(0, 8000);
  let best = ',';
  let bestScore = -1;

  for (const d of DELIMITER_CANDIDATES) {
    const lines = sample.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 30);
    if (!lines.length) continue;
    const counts = lines.map((l) => l.split(d).length);
    const mode = mostCommon(counts);
    const consistency = counts.filter((c) => c === mode).length / counts.length;
    const score = consistency * mode;
    if (mode >= 2 && score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function mostCommon(nums: number[]): number {
  const map = new Map<number, number>();
  for (const n of nums) map.set(n, (map.get(n) ?? 0) + 1);
  let best = nums[0] ?? 1;
  let bestC = 0;
  for (const [n, c] of map) {
    if (c > bestC) {
      bestC = c;
      best = n;
    }
  }
  return best;
}

/** Parse CSV into string[][] without assuming a header on row 0. */
export function parseCsvMatrix(text: string, delimiterHint?: string): ParseMatrixResult {
  const delimiter = detectDelimiter(text, delimiterHint);
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
    delimiter,
    quoteChar: '"',
    escapeChar: '"',
  });

  const rows = (result.data || []).map((row) =>
    (Array.isArray(row) ? row : [String(row)]).map((c) => String(c ?? ''))
  );
  return { rows, delimiter: result.meta.delimiter || delimiter };
}
