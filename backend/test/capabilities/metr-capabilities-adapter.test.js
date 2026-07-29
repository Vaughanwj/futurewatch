import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMetrCapabilitiesAdapter } from '../../src/adapters/capabilities/metr-capabilities-adapter.js';
import { normalizeObservation } from '../../src/domain/capabilities/observation.js';

const stubSource = async () => ({
  suite: 'TH1.1',
  errors: [],
  models: [
    { alias: 'GPT-4 0314', p50Minutes: 5.4, a: 2.1, b: -0.9, n: 200, suite: 'TH1.1', releaseDate: '2023-03-14' },
    { alias: 'GPT-5.2', p50Minutes: 352.2, a: 3.0, b: -0.6, n: 400, suite: 'TH1.1', releaseDate: '2025-12-11' },
  ],
  series: [
    { date: '2023-03-14', value: 5.4, alias: 'GPT-4 0314' },
    { date: '2025-12-11', value: 352.2, alias: 'GPT-5.2' },
  ],
});

test('produces both a 50% and 80% horizon observation for the frontier model', async () => {
  const adapter = createMetrCapabilitiesAdapter(stubSource);
  const { candidates, errors } = await adapter.fetch();
  assert.deepEqual(errors, []);
  assert.equal(candidates.length, 2);
  assert.ok(candidates.every((c) => c.model === 'GPT-5.2'));
  const metrics = candidates.map((c) => c.metric).sort();
  assert.deepEqual(metrics, ['metr_task_horizon_50pct', 'metr_task_horizon_80pct']);
});

test('the 80% horizon is shorter than the 50% horizon', async () => {
  const adapter = createMetrCapabilitiesAdapter(stubSource);
  const { candidates } = await adapter.fetch();
  const p50 = candidates.find((c) => c.metric === 'metr_task_horizon_50pct').value;
  const p80 = candidates.find((c) => c.metric === 'metr_task_horizon_80pct').value;
  assert.ok(p80 < p50);
});

test('candidates carry environment=controlled_lab and goalOrigin=externally_assigned, never real_world', async () => {
  const adapter = createMetrCapabilitiesAdapter(stubSource);
  const { candidates } = await adapter.fetch();
  for (const c of candidates) {
    assert.equal(c.environment, 'controlled_lab');
    assert.equal(c.goalOrigin, 'externally_assigned');
  }
});

test('each candidate normalizes cleanly through the domain layer', async () => {
  const adapter = createMetrCapabilitiesAdapter(stubSource);
  const { candidates } = await adapter.fetch();
  for (const c of candidates) {
    const { observation, errors } = normalizeObservation(c);
    assert.deepEqual(errors, [], `candidate ${c.metric} failed normalization: ${errors}`);
    assert.equal(observation.reviewStatus, 'not_required');
  }
});

test('no series/no frontier point yields no candidates and surfaces upstream errors', async () => {
  const adapter = createMetrCapabilitiesAdapter(async () => ({ suite: null, errors: ['metr runs TH1.1: timeout'], models: [], series: [] }));
  const { candidates, errors } = await adapter.fetch();
  assert.equal(candidates.length, 0);
  assert.deepEqual(errors, ['metr runs TH1.1: timeout']);
});

test('a frontier model missing a,b (no 80% derivable) still yields the 50% observation alone', async () => {
  const adapter = createMetrCapabilitiesAdapter(async () => ({
    suite: 'TH1.1', errors: [],
    models: [{ alias: 'X', p50Minutes: 10, a: null, b: null, n: 5, suite: 'TH1.1', releaseDate: '2026-01-01' }],
    series: [{ date: '2026-01-01', value: 10, alias: 'X' }],
  }));
  const { candidates } = await adapter.fetch();
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].metric, 'metr_task_horizon_50pct');
});
