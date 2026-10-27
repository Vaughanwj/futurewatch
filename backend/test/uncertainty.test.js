import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compositeRange, indicatorBounds, JUDGMENT_HALF_WIDTH } from '../src/domain/uncertainty.js';
import { buildSnapshot } from '../src/domain/snapshot-builder.js';
import { normalizeEciCapability, normalizeMetrTimeHorizon } from '../src/domain/anchors.js';

test('ECI and METR bounds come from their published intervals, through the same normalizers', () => {
  const eci = indicatorBounds('eciCapability', { value: normalizeEciCapability(167.35), raw: { ciLow: 164, ciHigh: 172 } });
  assert.equal(eci.source, 'interval');
  assert.ok(Math.abs(eci.lo - normalizeEciCapability(164)) < 1e-9);
  assert.ok(Math.abs(eci.hi - normalizeEciCapability(172)) < 1e-9);

  const metr = indicatorBounds('metrTimeHorizon', {
    value: normalizeMetrTimeHorizon(1045), raw: { ciLowMinutes: 509, ciHighMinutes: 3304 },
  });
  assert.ok(metr.lo < 80.9 && metr.hi > 80.9);
  assert.ok(metr.hi - 80.9 > 80.9 - metr.lo, 'METR interval is skewed upward on the log scale');
});

test('judgment-scored inputs get ±10, clamped to 0–100; verified exact readings get no band', () => {
  const j = indicatorBounds('selfLearning', { value: 12, confidence: 'judgment', raw: {} });
  assert.deepEqual(j, { lo: 2, hi: 22, source: 'judgment' });
  assert.deepEqual(indicatorBounds('selfLearning', { value: 4, confidence: 'judgment', raw: {} }), { lo: 0, hi: 14, source: 'judgment' });
  assert.equal(indicatorBounds('arcGap', { value: 62.7, confidence: 'verified', raw: {} }), null);
  assert.equal(indicatorBounds('eciCapability', { value: 78, confidence: 'verified', raw: {} }), null, 'no interval published → no band');
  assert.equal(indicatorBounds('x', { value: null }), null);
  assert.equal(JUDGMENT_HALF_WIDTH, 10);
});

test('range is the quadrature of each input\'s weighted distance, per side', () => {
  const pillars = {
    capability: { weight: 1, score: 50, indicators: [{ slug: 'a', weight: 0.5, score: 50 }, { slug: 'b', weight: 0.5, score: 50 }] },
  };
  const indicators = { a: { value: 50, confidence: 'judgment', raw: {} }, b: { value: 50, confidence: 'judgment', raw: {} } };
  const r = compositeRange(50, pillars, indicators);
  // each: weight 0.5 × 10 = 5; quadrature sqrt(25+25) = 7.07
  assert.equal(r.low, 42.9);
  assert.equal(r.high, 57.1);
});

test('no bands anywhere → the range collapses to the headline; nothing scored → null', () => {
  const pillars = { capability: { weight: 1, score: 40, indicators: [{ slug: 'a', weight: 1, score: 40 }] } };
  const r = compositeRange(40, pillars, { a: { value: 40, confidence: 'verified', raw: {} } });
  assert.equal(r.low, 40);
  assert.equal(r.high, 40);
  assert.equal(compositeRange(null, pillars, {}), null);
});

test('the snapshot publishes the range on the composite', () => {
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
  const { low, high } = snap.composite.range;
  assert.ok(low < snap.composite.value && high > snap.composite.value);
  assert.ok(snap.composite.range.method.includes('not a statistical confidence interval'));
});
