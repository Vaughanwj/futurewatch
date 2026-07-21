/**
 * Entry point — runs the pipeline and writes data/futurewatch.json,
 * appending the composite to data/history.json for the road-from-2019 chart.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPipeline } from './app.js';
import { metrAdapter } from './adapters/metr-adapter.js';
import { manualAdapter } from './adapters/manual-adapter.js';
import { rssAdapter } from './adapters/rss-adapter.js';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'futurewatch.json');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');

async function readJsonOrNull(p) {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

const pipeline = createPipeline({
  adapters: { metr: metrAdapter, manual: manualAdapter, rss: rssAdapter },
});

const previous = await readJsonOrNull(SNAPSHOT_PATH);
const snapshot = await pipeline.run(previous);

await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));

const history = (await readJsonOrNull(HISTORY_PATH)) ?? { schemaVersion: 1, points: [] };
history.points.push({
  date: snapshot.generatedAt.slice(0, 10),
  composite: snapshot.composite.value,
  pillars: Object.fromEntries(Object.entries(snapshot.pillars).map(([k, p]) => [k, p.score])),
});
await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2));

console.log(`composite: ${snapshot.composite.value} (coverage ${snapshot.composite.coverage})`);
for (const [name, p] of Object.entries(snapshot.pillars)) {
  console.log(`  ${name}: ${p.score} (coverage ${p.coverage})`);
}
if (snapshot.escalation.flagged) {
  console.error(`ESCALATION: ${snapshot.escalation.note}`);
  process.exitCode = 2;
}
if (snapshot.errors.length) {
  console.warn(`errors (${snapshot.errors.length}):`);
  for (const e of snapshot.errors) console.warn(`  - ${e}`);
}
