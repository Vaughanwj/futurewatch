import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createManualCapabilitiesAdapter } from '../../src/adapters/capabilities/manual-capabilities-adapter.js';
import { normalizeObservation } from '../../src/domain/capabilities/observation.js';

const REAL_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'capabilities-manual.json'
);

test('reads the real capabilities-manual.json and produces normalizable candidates', async () => {
  const adapter = createManualCapabilitiesAdapter(REAL_PATH);
  const { candidates, errors } = await adapter.fetch();
  assert.deepEqual(errors, []);
  assert.ok(candidates.length > 0);
  for (const c of candidates) {
    const { observation, errors: normErrors } = normalizeObservation(c);
    assert.deepEqual(normErrors, [], `candidate ${c.metric} failed normalization: ${normErrors}`);
    assert.ok(observation.sourceHash);
  }
});

test('CRITICAL: the seeded Vending-Bench 2 entry never claims real-world money', async () => {
  const adapter = createManualCapabilitiesAdapter(REAL_PATH);
  const { candidates } = await adapter.fetch();
  const vb = candidates.find((c) => c.metric === 'vending_bench_2_balance');
  assert.ok(vb, 'expected a vending_bench_2_balance candidate to exist');
  assert.equal(vb.unit, 'USD_simulated');
  assert.equal(vb.environment, 'simulation');
});

test('missing file surfaces an error and yields no candidates rather than throwing', async () => {
  const adapter = createManualCapabilitiesAdapter('/nonexistent/path.json');
  const { candidates, errors } = await adapter.fetch();
  assert.equal(candidates.length, 0);
  assert.ok(errors[0].includes('manual-capabilities'));
});

test('computed source hashes are stable across repeated reads of the same file', async () => {
  const adapter = createManualCapabilitiesAdapter(REAL_PATH);
  const first = await adapter.fetch();
  const second = await adapter.fetch();
  assert.deepEqual(
    first.candidates.map((c) => c.sourceHash),
    second.candidates.map((c) => c.sourceHash)
  );
});
