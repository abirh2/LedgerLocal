import { normalizeHeaderName } from '../../importUtils';
import { findRoleIndex, mergeAliases, REQUIRED_ROLES, OPTIONAL_ROLES } from './aliases';
import { parseDate } from './dates';
import { parseMoney } from './money';
import type {
  ColumnIndexMap,
  DateFormatId,
  HeaderAliasSet,
  HeaderCandidateScore,
  ImportProfile,
} from './types';

const DEFAULT_SCAN = 50;

export function buildColumnMap(
  headerRow: string[],
  aliases?: HeaderAliasSet
): ColumnIndexMap {
  const aliasSet = mergeAliases(aliases);
  const normalized = headerRow.map((c) => normalizeHeaderName(String(c ?? '')));

  const date =
    findRoleIndex(normalized, 'posted_date', aliasSet) >= 0
      ? findRoleIndex(normalized, 'posted_date', aliasSet)
      : findRoleIndex(normalized, 'date', aliasSet) >= 0
        ? findRoleIndex(normalized, 'date', aliasSet)
        : findRoleIndex(normalized, 'transaction_date', aliasSet);

  const descriptionRoles = ['description', 'details', 'merchant', 'memo'] as const;
  let description = -1;
  for (const role of descriptionRoles) {
    description = findRoleIndex(normalized, role, aliasSet);
    if (description >= 0) break;
  }

  const amount = findRoleIndex(normalized, 'amount', aliasSet);
  const debit =
    findRoleIndex(normalized, 'debit', aliasSet) >= 0
      ? findRoleIndex(normalized, 'debit', aliasSet)
      : findRoleIndex(normalized, 'withdrawal', aliasSet);
  const credit =
    findRoleIndex(normalized, 'credit', aliasSet) >= 0
      ? findRoleIndex(normalized, 'credit', aliasSet)
      : findRoleIndex(normalized, 'deposit', aliasSet);

  let runningBalance = findRoleIndex(normalized, 'running_balance', aliasSet);
  if (runningBalance < 0) runningBalance = findRoleIndex(normalized, 'balance', aliasSet);

  const referenceNumber = findRoleIndex(normalized, 'reference_number', aliasSet);
  const transactionType = findRoleIndex(normalized, 'transaction_type', aliasSet);

  const map: ColumnIndexMap = {};
  if (date >= 0) map.date = date;
  if (description >= 0) map.description = description;
  if (amount >= 0) map.amount = amount;
  if (debit >= 0) map.debit = debit;
  if (credit >= 0) map.credit = credit;
  if (runningBalance >= 0) map.runningBalance = runningBalance;
  if (referenceNumber >= 0) map.referenceNumber = referenceNumber;
  if (transactionType >= 0) map.transactionType = transactionType;
  return map;
}

function hasRequiredCoverage(map: ColumnIndexMap): boolean {
  const hasDate = map.date != null;
  const hasDesc = map.description != null;
  const hasAmount = map.amount != null || (map.debit != null && map.credit != null);
  return hasDate && hasDesc && hasAmount;
}

function countFollowingShapeMatches(
  rows: string[][],
  headerIndex: number,
  map: ColumnIndexMap,
  dateFormats: DateFormatId | DateFormatId[],
  moneyOpts: { decimalSeparator: '.' | ','; thousandsSeparator: ',' | '.' | ' ' | '' },
  sample = 8
): { matches: number; parseOk: number } {
  let matches = 0;
  let parseOk = 0;
  const end = Math.min(rows.length, headerIndex + 1 + sample);
  for (let i = headerIndex + 1; i < end; i++) {
    const cells = rows[i];
    if (!cells || cells.every((c) => String(c ?? '').trim() === '')) continue;
    const minCols = Math.max(
      map.date ?? 0,
      map.description ?? 0,
      map.amount ?? 0,
      map.debit ?? 0,
      map.credit ?? 0,
      map.runningBalance ?? 0
    );
    if (cells.length <= minCols) continue;
    matches++;

    const dateRaw = map.date != null ? cells[map.date] : '';
    const date = parseDate(dateRaw, dateFormats);
    let amountOk = false;
    if (map.amount != null) {
      amountOk = parseMoney(cells[map.amount], moneyOpts).status === 'valid';
    } else if (map.debit != null || map.credit != null) {
      const d = map.debit != null ? parseMoney(cells[map.debit], moneyOpts) : { status: 'blank' as const };
      const c = map.credit != null ? parseMoney(cells[map.credit], moneyOpts) : { status: 'blank' as const };
      amountOk = d.status === 'valid' || c.status === 'valid' || d.status === 'blank' || c.status === 'blank';
    }
    if (date.status === 'valid' && amountOk) parseOk++;
  }
  return { matches, parseOk };
}

/**
 * Score candidate header rows in the first `scanLimit` rows.
 * Prefers required-field coverage, uniqueness, following-row shape, and sample parses.
 */
export function discoverHeaderCandidates(
  rows: string[][],
  profile: Pick<
    ImportProfile,
    | 'headerAliases'
    | 'headerDiscoveryStrategy'
    | 'headerRowIndex'
    | 'skipRows'
    | 'dateFormat'
    | 'decimalSeparator'
    | 'thousandsSeparator'
  >,
  scanLimit = DEFAULT_SCAN
): HeaderCandidateScore[] {
  const aliases = mergeAliases(profile.headerAliases);
  const moneyOpts = {
    decimalSeparator: profile.decimalSeparator,
    thousandsSeparator: profile.thousandsSeparator,
  };

  if (profile.headerDiscoveryStrategy === 'fixed_row' && profile.headerRowIndex != null) {
    const i = profile.headerRowIndex;
    if (i < 0 || i >= rows.length) return [];
    return [scoreRow(rows, i, aliases, profile.dateFormat, moneyOpts)];
  }

  if (profile.headerDiscoveryStrategy === 'skip_rows' && profile.skipRows != null) {
    const i = profile.skipRows;
    if (i < 0 || i >= rows.length) return [];
    return [scoreRow(rows, i, aliases, profile.dateFormat, moneyOpts)];
  }

  const limit = Math.min(rows.length, scanLimit);
  const candidates: HeaderCandidateScore[] = [];
  for (let i = 0; i < limit; i++) {
    const scored = scoreRow(rows, i, aliases, profile.dateFormat, moneyOpts);
    if (scored.requiredCoverage > 0) candidates.push(scored);
  }

  candidates.sort((a, b) => b.score - a.score || a.rowIndex - b.rowIndex);
  return candidates;
}

function scoreRow(
  rows: string[][],
  rowIndex: number,
  aliases: HeaderAliasSet,
  dateFormat: DateFormatId | DateFormatId[],
  moneyOpts: { decimalSeparator: '.' | ','; thousandsSeparator: ',' | '.' | ' ' | '' }
): HeaderCandidateScore {
  const headers = (rows[rowIndex] || []).map((c) => String(c ?? ''));
  const columnMap = buildColumnMap(headers, aliases);
  const normalized = headers.map((h) => normalizeHeaderName(h));

  let requiredCoverage = 0;
  if (columnMap.date != null) requiredCoverage++;
  if (columnMap.description != null) requiredCoverage++;
  if (columnMap.amount != null || (columnMap.debit != null && columnMap.credit != null)) {
    requiredCoverage++;
  }

  let optionalCoverage = 0;
  for (const role of OPTIONAL_ROLES) {
    if (role === 'date' || role === 'description' || role === 'amount') continue;
    // count if mapped
  }
  if (columnMap.runningBalance != null) optionalCoverage++;
  if (columnMap.referenceNumber != null) optionalCoverage++;
  if (columnMap.transactionType != null) optionalCoverage++;
  if (columnMap.debit != null) optionalCoverage++;
  if (columnMap.credit != null) optionalCoverage++;

  const mappedIndexes = Object.values(columnMap).filter((v): v is number => v != null);
  const uniqueMappedFields = new Set(mappedIndexes).size;

  const shape = countFollowingShapeMatches(
    rows,
    rowIndex,
    columnMap,
    dateFormat,
    moneyOpts
  );

  // Penalize rows that look like data (first cell is a date)
  let dataPenalty = 0;
  const first = normalized[0] ?? '';
  if (/^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(first)) dataPenalty = 40;

  let score =
    requiredCoverage * 40 +
    optionalCoverage * 8 +
    uniqueMappedFields * 5 +
    shape.matches * 6 +
    shape.parseOk * 10 -
    dataPenalty;

  if (!hasRequiredCoverage(columnMap)) score = Math.min(score, 35);

  // Require at least some header-like tokens
  const looksLikeHeader = REQUIRED_ROLES.some((role) => {
    const aliasesFor = aliases[role] ?? [];
    return normalized.some((h) => aliasesFor.some((a) => normalizeHeaderName(a) === h || h.includes(normalizeHeaderName(a))));
  });
  if (!looksLikeHeader) score = Math.min(score, 20);

  const confidence = Math.max(0, Math.min(1, score / 120));

  return {
    rowIndex,
    score,
    confidence,
    requiredCoverage,
    optionalCoverage,
    uniqueMappedFields,
    followingShapeMatches: shape.matches,
    sampleParseOk: shape.parseOk,
    columnMap,
    headers,
  };
}

export function selectBestHeader(
  candidates: HeaderCandidateScore[],
  overrideIndex?: number
): HeaderCandidateScore | undefined {
  if (overrideIndex != null) {
    return candidates.find((c) => c.rowIndex === overrideIndex) ?? candidates[0];
  }
  return candidates[0];
}
