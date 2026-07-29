import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epochCapabilitiesAdapter } from '../../src/adapters/capabilities/epoch-capabilities-adapter.js';
import { vendingBenchLiveAdapter } from '../../src/adapters/capabilities/vendingbench-live-adapter.js';
import { githubReleaseAdapter } from '../../src/adapters/capabilities/github-release-adapter.js';
import { publicationMonitorAdapter } from '../../src/adapters/capabilities/publication-monitor-adapter.js';

const PENDING_ADAPTERS = [
  ['epoch', epochCapabilitiesAdapter],
  ['vendingbench-live', vendingBenchLiveAdapter],
  ['github-releases', githubReleaseAdapter],
  ['publication-monitor', publicationMonitorAdapter],
];

for (const [label, adapter] of PENDING_ADAPTERS) {
  test(`${label}: conforms to the CapabilitySourcePort shape`, () => {
    assert.equal(typeof adapter.sourceName, 'function');
    assert.equal(typeof adapter.fetch, 'function');
    assert.equal(typeof adapter.sourceName(), 'string');
  });

  test(`${label}: honestly reports pending rather than fabricating data`, async () => {
    const result = await adapter.fetch();
    assert.deepEqual(result.candidates, []);
    assert.equal(result.pending, true);
    assert.equal(typeof result.pendingReason, 'string');
    assert.ok(result.pendingReason.length > 0);
    assert.deepEqual(result.errors, []);
  });
}
