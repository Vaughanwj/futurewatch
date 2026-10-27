import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weightByConfidence } from '../src/domain/weight-shares.js';
import { scorePillar, PILLAR_DEFS } from '../src/domain/scorer.js';
import { buildSnapshot } from '../src/domain/snapshot-builder.js';

const ind = (value, confidence) => ({ value, confidence });

function pillarsFor(indicators) {
  return Object.fromEntries(Object.keys(PILLAR_DEFS).map((n) => [n, scorePillar(n, indicators)]));
}

test('live-shaped confidence labels give the judgment share the site actually carries (38.5%)', () => {
  const indicators = {
    eciCapability: ind(78, 'verified'), epochBenchmarks: ind(82, 'verified'), arcGap: ind(62, 'verified'),
    selfLearning: ind(12, 'judgment'), realTimeEngagement: ind(30, 'judgment'),
    metrTimeHorizon: ind(80, 'provisional'), agenticAutonomyLevel: ind(60, 'judgment'),
    anthropicEconIndex: ind(28, 'provisional'), aiIndexEconomy: ind(42, 'judgment'),
  };
  const s = weightByConfidence(pillarsFor(indicators), indicators);
  // 0.45*0.4 + 0.35*0.3 + 0.20*0.5 = 0.18 + 0.105 + 0.10
  assert.equal(s.judgment, 0.385);
  assert.equal(s.provisional, 0.345); // metr 0.35*0.7 + econ 0.2*0.5
  assert.equal(Math.round((s.verified + s.provisional + s.judgment) * 1000) / 1000, 1);
});

test('shares renormalize over present indicators, like the score itself', () => {
  const indicators = { selfLearning: ind(10, 'judgment'), arcGap: ind(60, 'verified') };
  const s = weightByConfidence(pillarsFor(indicators), indicators);
  // only the capability pillar scores, so it carries all the weight: 50/50 between the two present indicators
  assert.deepEqual(s, { verified: 0.5, provisional: 0, judgment: 0.5 });
});

test('unlabelled or unknown confidence counts as provisional, and nothing scored gives zeros', () => {
  const indicators = { arcGap: { value: 50 }, selfLearning: ind(10, 'whatever') };
  const s = weightByConfidence(pillarsFor(indicators), indicators);
  assert.deepEqual(s, { verified: 0, provisional: 1, judgment: 0 });
  assert.deepEqual(weightByConfidence(pillarsFor({}), {}), { verified: 0, provisional: 0, judgment: 0 });
});

test('the snapshot publishes it on the composite', () => {
  const snap = buildSnapshot({
    results: {
      a: {
        indicators: {
          selfLearning: { value: null, raw: { gainRatio: 0.06 }, asOf: '2026-06-05', source: 's', confidence: 'judgment' },
          arcGap: { value: null, raw: { generations: [{ name: 'x', frontierOverHuman: 0.3 }] }, asOf: '2026-10-01', source: 's', confidence: 'verified' },
        },
        errors: [],
      },
    },
    now: new Date('2026-10-02T00:00:00Z'),
  });
  assert.deepEqual(snap.composite.weightByConfidence, { verified: 0.5, provisional: 0, judgment: 0.5 });
});
