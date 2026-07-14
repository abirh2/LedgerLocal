import React, { useMemo, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import {
  buildSanitizedDiagnostic,
  createDefaultImportProfile,
  formatSanitizedDiagnostic,
  runGenericImportPipeline,
  runImportPipeline,
  type DateFormatId,
  type ImportPipelineResult,
  type ImportProfile,
} from '../lib/importers/pipeline';

interface ImportFixtureLabPageProps {
  onNavigate: (view: string) => void;
}

/** Developer-only inspectable view of the staged CSV import pipeline. */
export function ImportFixtureLabPage({ onNavigate }: ImportFixtureLabPageProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportPipelineResult | null>(null);
  const [preferBuiltIn, setPreferBuiltIn] = useState(true);
  const [headerOverride, setHeaderOverride] = useState<number | undefined>();
  const [profileDraft, setProfileDraft] = useState<ImportProfile>(() =>
    createDefaultImportProfile({ name: 'Lab profile' })
  );

  const run = () => {
    const runner = preferBuiltIn ? runImportPipeline : runGenericImportPipeline;
    setResult(
      runner({
        text,
        headerOverrideIndex: headerOverride,
        profile: profileDraft,
        useBuiltInWhenDetected: preferBuiltIn,
      })
    );
  };

  const diagnostic = useMemo(
    () => (result ? formatSanitizedDiagnostic(buildSanitizedDiagnostic(result)) : ''),
    [result]
  );

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full space-y-6">
      <PageHeader title="Import Fixture Lab">
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="text-sm font-semibold text-on-surface-variant hover:text-on-surface"
        >
          Back to Settings
        </button>
      </PageHeader>

      <p className="text-sm text-on-surface-variant">
        Developer tool: inspect each import stage with fictional fixtures. No data leaves the
        device. Prefer sanitized diagnostics — never paste raw bank rows into issues.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase text-on-surface-variant">
            Fixture CSV
          </label>
          <textarea
            className="w-full h-64 font-mono text-xs border border-outline-variant rounded-lg p-3 bg-surface-container-lowest"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a fictional CSV fixture…"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferBuiltIn}
                onChange={(e) => setPreferBuiltIn(e.target.checked)}
              />
              Prefer built-in importer
            </label>
            <label className="inline-flex items-center gap-2">
              Header override
              <input
                type="number"
                min={0}
                className="w-16 border border-outline-variant rounded px-1 py-0.5"
                value={headerOverride ?? ''}
                onChange={(e) =>
                  setHeaderOverride(e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
            </label>
            <button
              type="button"
              onClick={run}
              className="btn-physical px-4 py-1.5 rounded-lg text-primary text-sm font-bold"
            >
              Run pipeline
            </button>
          </div>

          <details className="text-sm border border-outline-variant rounded-lg p-3">
            <summary className="font-semibold cursor-pointer">Advanced profile</summary>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <label className="col-span-2">
                Date format
                <select
                  className="w-full border border-outline-variant rounded p-1 mt-1"
                  value={
                    Array.isArray(profileDraft.dateFormat)
                      ? profileDraft.dateFormat[0]
                      : profileDraft.dateFormat
                  }
                  onChange={(e) =>
                    setProfileDraft((p) => ({
                      ...p,
                      dateFormat: e.target.value as DateFormatId,
                    }))
                  }
                >
                  {(
                    ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'M/D/YYYY', 'D/M/YYYY'] as DateFormatId[]
                  ).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount mode
                <select
                  className="w-full border border-outline-variant rounded p-1 mt-1"
                  value={profileDraft.amountMode}
                  onChange={(e) =>
                    setProfileDraft((p) => ({
                      ...p,
                      amountMode: e.target.value as ImportProfile['amountMode'],
                    }))
                  }
                >
                  <option value="signed">signed</option>
                  <option value="debit_credit">debit_credit</option>
                  <option value="absolute_invert">absolute_invert</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 mt-5">
                <input
                  type="checkbox"
                  checked={profileDraft.invertAmountSign}
                  onChange={(e) =>
                    setProfileDraft((p) => ({ ...p, invertAmountSign: e.target.checked }))
                  }
                />
                Invert signs
              </label>
              <label>
                Decimal
                <select
                  className="w-full border border-outline-variant rounded p-1 mt-1"
                  value={profileDraft.decimalSeparator}
                  onChange={(e) =>
                    setProfileDraft((p) => ({
                      ...p,
                      decimalSeparator: e.target.value as '.' | ',',
                    }))
                  }
                >
                  <option value=".">.</option>
                  <option value=",">,</option>
                </select>
              </label>
              <label>
                Thousands
                <select
                  className="w-full border border-outline-variant rounded p-1 mt-1"
                  value={profileDraft.thousandsSeparator}
                  onChange={(e) =>
                    setProfileDraft((p) => ({
                      ...p,
                      thousandsSeparator: e.target.value as ',' | '.' | ' ' | '',
                    }))
                  }
                >
                  <option value=",">,</option>
                  <option value=".">.</option>
                  <option value=" ">space</option>
                  <option value="">none</option>
                </select>
              </label>
            </div>
          </details>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase text-on-surface-variant">Stages</h3>
          <ol className="space-y-2 text-sm max-h-80 overflow-auto border border-outline-variant rounded-lg p-3 bg-surface-container-low">
            {(result?.stages ?? []).map((s) => (
              <li key={s.id} className="flex gap-2 items-start">
                <span
                  className={`mt-0.5 inline-block w-2 h-2 rounded-full shrink-0 ${
                    s.ok ? 'bg-primary' : 'bg-error'
                  }`}
                />
                <div>
                  <div className="font-semibold text-on-surface">{s.label}</div>
                  <div className="text-xs text-on-surface-variant">{s.detail}</div>
                </div>
              </li>
            ))}
            {!result && (
              <li className="text-on-surface-variant text-xs">Run a fixture to see stages.</li>
            )}
          </ol>

          {result && (
            <div className="text-xs space-y-1 text-on-surface-variant">
              <div>
                Header:{' '}
                {result.selectedHeader
                  ? `row ${result.selectedHeader.rowIndex + 1} (${(result.selectedHeader.confidence * 100).toFixed(0)}%)`
                  : 'none'}
              </div>
              <div>
                Rows: {result.normalized.length} normalized ·{' '}
                {result.parsedRows.length} preview
              </div>
              <div>
                Reconcile: {result.runningBalanceValidation.status} /{' '}
                {result.summaryValidation.status}
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-bold uppercase text-on-surface-variant">
                Sanitized diagnostic
              </h3>
              <button
                type="button"
                className="text-xs font-semibold"
                disabled={!diagnostic}
                onClick={() => navigator.clipboard.writeText(diagnostic)}
              >
                Copy
              </button>
            </div>
            <pre className="text-[10px] font-mono bg-surface-container-lowest border border-outline-variant rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
              {diagnostic || '—'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
