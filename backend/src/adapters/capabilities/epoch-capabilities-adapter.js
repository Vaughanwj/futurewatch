/**
 * Epoch AI → Four Capabilities Watch observations.
 *
 * Reads the same CC-BY benchmark archive as the scored indicators
 * (adapters/epoch-source.js) and turns the record-setting results on each
 * capability-relevant benchmark into candidate observations:
 *
 *   Vending-Bench 2   → resource_acquisition  (simulated USD, simulation)
 *   PostTrainBench    → ai_improvement        (percent, controlled lab)
 *   OSWorld           → operational_autonomy  (computer_use_success)
 *   Terminal-Bench 2  → operational_autonomy  (terminal_task_success)
 *
 * For each metric the last RECORDS_PER_METRIC record-setters are emitted, so
 * a card can show the current best and what it beat. Unchanged data hashes to
 * the same sourceHash on every run and is deduplicated by the pipeline.
 */
import { getEpochArchive } from '../epoch-source.js';
import { computeSourceHash } from '../../domain/capabilities/observation.js';
import { CAPABILITY_SOURCES, recordSeries, buildDisplayNames, modelLabel } from '../../domain/epoch-extract.js';

const RECORDS_PER_METRIC = 3;

function toCandidate(def, rec) {
  const value = Math.round(rec.score * 10000) / 10000;
  const provider = rec.row.Organization || rec.row['Model Org'] || null;
  return {
    capability: def.capability,
    metric: def.metric,
    model: rec.model,
    modelProvider: provider,
    value,
    unit: def.unit,
    environment: def.environment,
    goalOrigin: 'externally_assigned',
    scaffold: rec.row.Scaffold || rec.row.Agent || null,
    observedAt: rec.date,
    publishedAt: null,
    sourceKind: 'benchmark',
    sourceName: def.sourceName,
    sourceUrl: def.sourceUrl,
    sourceHash: computeSourceHash({
      sourceName: def.sourceName, sourceVersion: def.file, model: rec.model, metric: def.metric,
      observedAt: rec.date, value, unit: def.unit,
    }),
    confidence: 'high',
    evidenceLevel: 2,
    reviewStatus: 'not_required',
    notes: def.notes,
    extra: { ...def.extra },
  };
}

export function createEpochCapabilitiesAdapter({ fetchArchive = getEpochArchive } = {}) {
  return {
    sourceName: () => 'epoch-capabilities',
    async fetch() {
      const t0 = Date.now();
      const { tables, errors: fetchErrors } = await fetchArchive();
      const errors = [...fetchErrors];
      const candidates = [];
      const displayNames = buildDisplayNames(tables['model_metadata.csv'] ?? []);

      for (const def of CAPABILITY_SOURCES) {
        const rows = tables[def.file];
        if (!rows) {
          if (fetchErrors.length === 0) errors.push(`epoch-capabilities: ${def.file} missing from archive`);
          continue;
        }
        const records = recordSeries(rows, { scoreCols: def.scoreCols, scale: def.scale, nameOf: (r) => modelLabel(r, displayNames) });
        if (records.length === 0) {
          errors.push(`epoch-capabilities: ${def.file} has no scored, dated rows`);
          continue;
        }
        for (const rec of records.slice(-RECORDS_PER_METRIC)) candidates.push(toCandidate(def, rec));
      }

      return { candidates, fetchMs: Date.now() - t0, errors };
    },
  };
}

export const epochCapabilitiesAdapter = createEpochCapabilitiesAdapter();
