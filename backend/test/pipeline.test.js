import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPipeline } from '../src/app.js';
import { createManualAdapter } from '../src/adapters/manual-adapter.js';

const MANUAL_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', 'data', 'futurewatch-manual.json'
);

// Stub adapters — no network in CI (house rule).
const stubMetr = {
  async fetch() {
    return {
      indicators: {
        metrTimeHorizon: {
          value: null,
          raw: {
            p50Minutes: 320,
            frontierModel: 'Claude Opus 4.5',
            suite: 'TH1.1',
            modelCount: 14,
            frontierSeries: [
              { date: '2019-02-14', value: 4 / 60, alias: 'GPT-2' },
              { date: '2023-03-14', value: 5.4, alias: 'GPT-4 0314' },
              { date: '2024-12-05', value: 50, alias: 'o1' },
              { date: '2025-11-24', value: 320, alias: 'Claude Opus 4.5' },
            ],
          },
          asOf: '2025-11-24',
          source: 'stub',
          confidence: 'verified',
        },
      },
      fetchMs: 1,
      errors: [],
    };
  },
};

const stubRss = {
  async fetch() {
    return { indicators: {}, stories: [{ title: 'stub story', link: 'https://example.com', published: '2026-07-19', feed: 'stub' }], fetchMs: 1, errors: [] };
  },
};

test('pipeline produces a complete snapshot from stubs + real manual file', async () => {
  const pipeline = createPipeline({
    adapters: { metr: stubMetr, manual: createManualAdapter(MANUAL_PATH), rss: stubRss },
    now: () => new Date('2026-07-20T12:00:00Z'),
  });
  const snap = await pipeline.run();

  assert.equal(snap.schemaVersion, 1);
  assert.ok(Number.isFinite(snap.composite.value));
  // Provisional sanity band from anchor-tables.md: 46 ± 10
  assert.ok(snap.composite.value > 36 && snap.composite.value < 56, `composite ${snap.composite.value} outside sanity band`);

  assert.ok(Math.abs(snap.pillars.autonomy.indicators.find((i) => i.slug === 'metrTimeHorizon').score - 71) < 1);
  assert.equal(snap.pillars.capability.coverage, 1);
  assert.equal(snap.expectation.superforecasterAgi, 2047);
  assert.equal(snap.expectation.expertAgi, 2050);
  assert.ok(Math.abs(snap.safety.score - 42.5) < 0.1);
  assert.ok(snap.trajectory.metrDoublingDaysSince2023 > 0);
  assert.equal(snap.stories.length, 1);
  assert.equal(snap.sourceHealth.length, 3);
  assert.equal(snap.escalation.flagged, false);
});

test('escalation flags >5pt composite move', async () => {
  const pipeline = createPipeline({
    adapters: { metr: stubMetr, manual: createManualAdapter(MANUAL_PATH), rss: stubRss },
  });
  const snap = await pipeline.run({ composite: { value: 99 } });
  assert.equal(snap.escalation.flagged, true);
});

test('pipeline survives a throwing adapter', async () => {
  const pipeline = createPipeline({
    adapters: {
      broken: { async fetch() { throw new Error('boom'); } },
      manual: createManualAdapter(MANUAL_PATH),
    },
  });
  const snap = await pipeline.run();
  assert.ok(snap.errors.some((e) => e.includes('boom')));
  assert.ok(Number.isFinite(snap.composite.value)); // manual alone still scores
});
