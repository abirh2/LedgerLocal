import { DEFAULT_HEADER_ALIASES } from './aliases';
import {
  IMPORT_PROFILE_SCHEMA_VERSION,
  type ImportProfile,
} from './types';

export function createDefaultImportProfile(
  overrides: Partial<ImportProfile> = {}
): ImportProfile {
  const now = new Date().toISOString();
  const {
    headerAliases: aliasOverrides,
    id,
    name,
    createdAt,
    updatedAt,
    ...rest
  } = overrides;

  return {
    id: id ?? `imp_profile_${Date.now()}`,
    name: name ?? 'Default CSV',
    version: IMPORT_PROFILE_SCHEMA_VERSION,
    createdAt: createdAt ?? now,
    updatedAt: updatedAt ?? now,
    headerDiscoveryStrategy: 'alias_score',
    dateFormat: ['YYYY-MM-DD', 'MM/DD/YYYY'],
    amountMode: 'signed',
    invertAmountSign: false,
    decimalSeparator: '.',
    thousandsSeparator: ',',
    structuralRowPatterns: [],
    openingBalanceBehavior: 'snapshot',
    footerHandling: 'classify',
    createBalanceSnapshots: true,
    ...rest,
    headerAliases: {
      ...DEFAULT_HEADER_ALIASES,
      ...(aliasOverrides ?? {}),
    },
  };
}

/** Migrate persisted profiles when schema version changes. */
export function migrateImportProfile(raw: unknown): ImportProfile {
  if (!raw || typeof raw !== 'object') {
    return createDefaultImportProfile();
  }
  const p = raw as Partial<ImportProfile> & { version?: number };
  const version = p.version ?? 0;

  // v0 → v1: fill new fields with defaults
  const base = createDefaultImportProfile({
    id: p.id,
    name: p.name,
    accountId: p.accountId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt ?? new Date().toISOString(),
  });

  if (version >= 1) {
    return {
      ...base,
      ...p,
      version: IMPORT_PROFILE_SCHEMA_VERSION,
      headerAliases: {
        ...DEFAULT_HEADER_ALIASES,
        ...(p.headerAliases ?? {}),
      },
    } as ImportProfile;
  }

  // Legacy partial mappings (docs claimed saved date/desc/amount columns)
  const legacy = raw as {
    dateCol?: string;
    descCol?: string;
    amountCol?: string;
    invertSign?: boolean;
  };
  if (legacy.dateCol || legacy.descCol || legacy.amountCol) {
    return createDefaultImportProfile({
      name: p.name ?? 'Migrated mapping',
      invertAmountSign: !!legacy.invertSign,
      headerAliases: {
        ...DEFAULT_HEADER_ALIASES,
        ...(legacy.dateCol ? { date: [legacy.dateCol, ...DEFAULT_HEADER_ALIASES.date] } : {}),
        ...(legacy.descCol
          ? { description: [legacy.descCol, ...DEFAULT_HEADER_ALIASES.description] }
          : {}),
        ...(legacy.amountCol
          ? { amount: [legacy.amountCol, ...DEFAULT_HEADER_ALIASES.amount] }
          : {}),
      },
    });
  }

  return base;
}
