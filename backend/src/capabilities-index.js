/**
 * Entry point — runs the Four Capabilities Watch pipeline and writes
 * data/capabilities.json. Separate file, separate script from index.js: this
 * panel must never be silently merged into futurewatch.json's composite.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCapabilitiesPipeline } from './app-capabilities.js';
import { createMetrCapabilitiesAdapter } from './adapters/capabilities/metr-capabilities-adapter.js';
import { createManualCapabilitiesAdapter } from './adapters/capabilities/manual-capabilities-adapter.js';
import { epochCapabilitiesAdapter } from './adapters/capabilities/epoch-capabilities-adapter.js';
import { vendingBenchLiveAdapter } from './adapters/capabilities/vendingbench-live-adapter.js';
import { githubReleaseAdapter } from './adapters/capabilities/github-release-adapter.js';
import { publicationMonitorAdapter } from './adapters/capabilities/publication-monitor-adapter.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, '..', 'data');
const CONFIG_DIR = path.join(ROOT, '..', 'config');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'capabilities.json');
const STATUS_CONFIG_PATH = path.join(CONFIG_DIR, 'capabilities-status.json');

async function readJsonOrNull(p) {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

const pipeline = createCapabilitiesPipeline({
  adapters: {
    metr: createMetrCapabilitiesAdapter(),
    manual: createManualCapabilitiesAdapter(),
    epoch: epochCapabilitiesAdapter,
    vendingBenchLive: vendingBenchLiveAdapter,
    githubReleases: githubReleaseAdapter,
    publicationMonitor: publicationMonitorAdapter,
  },
});

const previous = await readJsonOrNull(SNAPSHOT_PATH);
const statusConfig = (await readJsonOrNull(STATUS_CONFIG_PATH)) ?? {
  headline: 'No integrated autonomous self-expansion observed. Component capabilities are advancing independently.',
};

const result = await pipeline.run(previous);

const snapshot = {
  schemaVersion: result.schemaVersion,
  generatedAt: result.generatedAt,
  status: { headline: statusConfig.headline, lastReviewed: statusConfig.lastReviewed ?? null },
  cards: result.cards,
  observations: result.observations,
  sourceHealth: result.sourceHealth,
  errors: result.errors,
  ingestion: {
    recordsSeen: result.recordsSeen,
    recordsNormalized: result.recordsNormalized,
    recordsSaved: result.recordsSaved,
    recordsDeduplicated: result.recordsDeduplicated,
    recordsQuarantined: result.recordsQuarantined,
    pendingReviewCount: result.newlyPending.length,
  },
};

await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));

console.log(`capabilities: ${result.recordsSaved} new observation(s), ${result.recordsDeduplicated} deduplicated, ${result.recordsQuarantined} quarantined`);
for (const s of result.sourceHealth) {
  const flag = s.pending ? 'pending' : s.ok ? 'ok' : 'error';
  console.log(`  ${s.source}: ${flag} (${s.candidateCount} candidates)`);
}
if (result.newlyPending.length > 0) {
  // capabilities-review-queue.json is a human-only workspace (see its
  // _readme) — the pipeline never writes to it. Pending items are already
  // visible here, in the published snapshot's own observations list, with
  // reviewStatus 'pending' and excluded from every public card field.
  console.log(`${result.newlyPending.length} new observation(s) require human review before publication (reviewStatus: pending) — see the observations list in capabilities.json`);
}
if (result.errors.length) {
  console.warn(`errors (${result.errors.length}):`);
  for (const e of result.errors) console.warn(`  - ${e}`);
}
