import {
  BOFA_CHECKING_DISPLAY_NAME,
  BOFA_CHECKING_IMPORTER_ID,
  detectFromText,
  parseBankOfAmericaCheckingCsv,
} from './bankOfAmericaChecking';
import type { BofAParseResult, ImporterDetection } from './bankOfAmericaChecking';

export interface BuiltInImporter {
  id: string;
  displayName: string;
  /** Observed-format note for UI; not a universal bank claim. */
  formatNote: string;
  detect(text: string): ImporterDetection | null;
  parse(text: string): BofAParseResult | null;
}

const bankOfAmericaCheckingImporter: BuiltInImporter = {
  id: BOFA_CHECKING_IMPORTER_ID,
  displayName: BOFA_CHECKING_DISPLAY_NAME,
  formatNote:
    'Supported observed Bank of America checking CSV structure. Other BoA exports may differ — use custom mapping if detection fails.',
  detect: detectFromText,
  parse: parseBankOfAmericaCheckingCsv,
};

/** Registry of built-in importers. Generic mapping remains the fallback. */
export const builtInImporters: BuiltInImporter[] = [bankOfAmericaCheckingImporter];

export function detectBuiltInImporter(text: string): {
  importer: BuiltInImporter;
  detection: ImporterDetection;
} | null {
  for (const importer of builtInImporters) {
    const detection = importer.detect(text);
    if (detection) return { importer, detection };
  }
  return null;
}
