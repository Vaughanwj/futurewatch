/**
 * Manual adapter — reads backend/data/futurewatch-manual.json.
 * Mirrors Frokkle's manual-adapter pattern: each entry carries _instructions
 * and nextUpdate so annual maintenance is self-documenting.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEFAULT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'data', 'futurewatch-manual.json'
);

export function createManualAdapter(filePath = DEFAULT_PATH) {
  return {
    async fetch() {
      const t0 = Date.now();
      const errors = [];
      let indicators = {};
      try {
        const parsed = JSON.parse(await readFile(filePath, 'utf8'));
        for (const [slug, entry] of Object.entries(parsed)) {
          if (slug.startsWith('_')) continue;
          indicators[slug] = {
            value: null, // normalized by domain from raw
            raw: entry.raw,
            asOf: entry.asOf,
            source: entry.source,
            confidence: entry.confidence ?? 'provisional',
          };
        }
      } catch (err) {
        errors.push(`manual: ${err.message}`);
      }
      return { indicators, fetchMs: Date.now() - t0, errors };
    },
  };
}

export const manualAdapter = createManualAdapter();
