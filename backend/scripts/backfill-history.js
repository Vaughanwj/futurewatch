/**
 * One-off: reconstruct the composite for each day from the first published
 * history point up to (not including) the re-baseline date, from dated
 * sources, and write backend/config/history-backfill.json. The daily pipeline
 * merges that file into history.json (domain/history.js applyBackfill) — so
 * the rewrite is reviewable in git and reproducible, not a manual edit of the
 * data branch.
 *
 *   node scripts/backfill-history.js --from 2026-07-29 --before 2026-10-02
 *
 * Needs network (Epoch archive, arcprize.org). Re-running regenerates the
 * file from whatever those sources say today, so commit the result.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import axios from 'axios';
import { fetchEpochArchive } from '../src/adapters/epoch-source.js';
import { ARC_EVALUATIONS_URL, ARC_V3_URL } from '../src/adapters/arc-adapter.js';
import { createManualAdapter } from '../src/adapters/manual-adapter.js';
import { buildDisplayNames } from '../src/domain/epoch-extract.js';
import { dateRange, reconstructPoint } from '../src/domain/backfill.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'config', 'history-backfill.json');
const ARC_MODELS_URL = 'https://arcprize.org/media/data/models.json';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
const from = arg('from');
const before = arg('before');
if (!from || !before) {
  console.error('usage: node scripts/backfill-history.js --from YYYY-MM-DD --before YYYY-MM-DD');
  process.exit(1);
}

const getJson = async (url) => (await axios.get(url, { timeout: 60000 })).data;

const { tables, errors } = await fetchEpochArchive();
if (errors.length) throw new Error(errors.join('; '));
const [arcEvaluations, arcModels, arcV3] = [await getJson(ARC_EVALUATIONS_URL), await getJson(ARC_MODELS_URL), await getJson(ARC_V3_URL)];
const manual = await createManualAdapter().fetch();
if (manual.errors.length) throw new Error(manual.errors.join('; '));

const lastDay = new Date(Date.parse(before) - 86400000).toISOString().slice(0, 10);
const displayNames = buildDisplayNames(tables['model_metadata.csv'] ?? []);
const points = dateRange(from, lastDay).map((asOf) =>
  reconstructPoint({ asOf, manualIndicators: manual.indicators, tables, arcEvaluations, arcModels, arcV3, displayNames })
);

const out = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  before,
  method:
    'Reconstructed with the current methodology from results dated on or before each day (benchmark rows dated by model release). ' +
    'Hand-scored inputs held at current values. See backend/src/domain/backfill.js.',
  points,
};
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

const incomplete = points.filter((p) => p.missing);
console.log(`wrote ${points.length} points ${from} → ${lastDay} to ${path.relative(process.cwd(), OUT)}`);
console.log(`composite ${points[0].composite} → ${points.at(-1).composite}; ${incomplete.length} point(s) missing an indicator`);
