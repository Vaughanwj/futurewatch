import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilitiesPipeline } from '../../src/app-capabilities.js';

function stubAdapter(candidates, errors = []) {
  return { sourceName: () => 'stub', async fetch() { return { candidates, errors, fetchMs: 1 }; } };
}

function goodCandidate(overrides = {}) {
  return {
    capability: 'operational_autonomy',
    metric: 'metr_task_horizon_50pct',
    model: 'example-model',
    value: 60,
    unit: 'minutes',
    environment: 'controlled_lab',
    goalOrigin: 'externally_assigned',
    observedAt: '2026-07-28T00:00:00Z',
    sourceKind: 'benchmark',
    sourceName: 'METR',
    sourceUrl: 'https://metr.org',
    sourceHash: 'stable-hash-1',
    confidence: 'high',
    ...overrides,
  };
}

test('CRITICAL: one broken adapter does not prevent other adapters from running', async () => {
  const pipeline = createCapabilitiesPipeline({
    adapters: {
      broken: { sourceName: () => 'broken', async fetch() { throw new Error('boom'); } },
      good: stubAdapter([goodCandidate()]),
    },
  });
  const result = await pipeline.run();
  assert.ok(result.errors.some((e) => e.includes('boom')));
  assert.equal(result.observations.length, 1, 'the working adapter should still have contributed its observation');
  assert.equal(result.sourceHealth.find((s) => s.source === 'broken').ok, false);
  assert.equal(result.sourceHealth.find((s) => s.source === 'good').ok, true);
});

test('CRITICAL: source provenance survives normalization end to end', async () => {
  const pipeline = createCapabilitiesPipeline({
    adapters: { good: stubAdapter([goodCandidate({ sourceUrl: 'https://metr.org/specific-report' })]) },
  });
  const result = await pipeline.run();
  const obs = result.observations[0];
  assert.equal(obs.sourceUrl, 'https://metr.org/specific-report');
  assert.equal(obs.sourceName, 'METR');
  assert.equal(obs.sourceHash, 'stable-hash-1');
  assert.ok(obs.id, 'a persistence id should be assigned');
});

test('CRITICAL: duplicate feed ingestion does not create duplicate observations across runs', async () => {
  const adapters = { good: stubAdapter([goodCandidate()]) };
  const pipeline = createCapabilitiesPipeline({ adapters });
  const first = await pipeline.run(null);
  assert.equal(first.observations.length, 1);
  assert.equal(first.recordsSaved, 1);

  const second = await pipeline.run({ observations: first.observations });
  assert.equal(second.observations.length, 1, 'reprocessing the same source data must not duplicate the observation');
  assert.equal(second.recordsSaved, 0);
  assert.equal(second.recordsDeduplicated, 1);
});

test('CRITICAL: a qualitative high-risk candidate enters the review queue instead of auto-publishing', async () => {
  const risky = goodCandidate({
    capability: 'resource_acquisition', unit: 'boolean', value: true, sourceHash: 'risky-hash',
    publicSummary: 'The system self-replicated to a new host without operator involvement.',
  });
  const pipeline = createCapabilitiesPipeline({ adapters: { good: stubAdapter([risky]) } });
  const result = await pipeline.run();

  assert.equal(result.newlyPending.length, 1);
  assert.equal(result.newlyPending[0].reviewStatus, 'pending');
  // and it must not have driven a public card claim of real-world resource acquisition
  assert.equal(result.cards.resourceAcquisition.realWorldResourceAcquisitionObserved, false);
});

test('CRITICAL: an assigned goal is never surfaced as self-generated through the full pipeline', async () => {
  const c = goodCandidate({
    capability: 'goal_autonomy', metric: 'goal_autonomy_level', unit: 'boolean', value: true,
    goalOrigin: 'externally_assigned', goalAutonomyLevel: 1, sourceHash: 'goal-hash',
  });
  const pipeline = createCapabilitiesPipeline({ adapters: { good: stubAdapter([c]) } });
  const result = await pipeline.run();
  const obs = result.observations[0];
  assert.equal(obs.goalOrigin, 'externally_assigned');
  assert.notEqual(obs.goalOrigin, 'apparently_self_generated');
});

test('an unresolvable/malformed candidate is quarantined, not silently dropped or crashed on', async () => {
  const bad = { capability: 'operational_autonomy' }; // missing everything else
  const pipeline = createCapabilitiesPipeline({ adapters: { good: stubAdapter([bad]) } });
  const result = await pipeline.run();
  assert.equal(result.observations.length, 0);
  assert.equal(result.recordsQuarantined, 1);
  assert.ok(result.errors.length > 0);
});

test('public output exposes environment and goal origin on every observation', async () => {
  const pipeline = createCapabilitiesPipeline({ adapters: { good: stubAdapter([goodCandidate()]) } });
  const result = await pipeline.run();
  for (const o of result.observations) {
    assert.ok(o.environment);
    assert.ok(o.goalOrigin);
  }
});
