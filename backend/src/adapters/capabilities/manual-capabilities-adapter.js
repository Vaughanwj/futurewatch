/**
 * Manual capabilities adapter — reads backend/data/capabilities-manual.json.
 * Mirrors the existing manual-adapter.js pattern: human-curated entries with
 * _instructions, consumed the same way a live source adapter would be.
 * Computes source_hash here (the manual file doesn't carry one) so
 * unchanged entries dedupe against previously-saved observations exactly
 * like any automated source.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeSourceHash } from '../../domain/capabilities/observation.js';

const DEFAULT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', 'data', 'capabilities-manual.json'
);

export function createManualCapabilitiesAdapter(filePath = DEFAULT_PATH) {
  return {
    sourceName: () => 'manual-capabilities',
    async fetch() {
      const t0 = Date.now();
      const errors = [];
      let candidates = [];
      try {
        const parsed = JSON.parse(await readFile(filePath, 'utf8'));
        candidates = (parsed.observations ?? []).map((o) => ({
          ...o,
          sourceHash: computeSourceHash({
            sourceName: o.sourceName,
            sourceVersion: o.scaffold ?? null,
            model: o.model,
            metric: o.metric,
            observedAt: o.observedAt,
            value: o.value,
            unit: o.unit,
          }),
        }));
      } catch (err) {
        errors.push(`manual-capabilities: ${err.message}`);
      }
      return { candidates, fetchMs: Date.now() - t0, errors };
    },
  };
}

export const manualCapabilitiesAdapter = createManualCapabilitiesAdapter();
