import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitP50Horizon, frontierSeries, mergeModels, horizonAtSuccessRate } from '../src/domain/metr-fit.js';

test('mergeModels: primary wins collisions, legacy fills pre-2023 gap', () => {
  const primary = [
    { alias: 'GPT-4 0314', p50Minutes: 3.6, suite: 'TH1.1' },
    { alias: 'GPT-5', p50Minutes: 214, suite: 'TH1.1' },
  ];
  const legacy = [
    { alias: 'GPT-2', p50Minutes: 0.067, suite: 'TH1.0' },
    { alias: 'GPT-4 0314', p50Minutes: 5.4, suite: 'TH1.0' }, // collision — dropped
  ];
  const merged = mergeModels(primary, legacy);
  assert.equal(merged.length, 3);
  assert.equal(merged.find((m) => m.alias === 'GPT-4 0314').p50Minutes, 3.6);
  assert.ok(merged.some((m) => m.alias === 'GPT-2'));
  assert.deepEqual(mergeModels([], legacy).map((m) => m.alias), ['GPT-2', 'GPT-4 0314']);
});

test('logistic fit recovers a known p50 from synthetic runs', () => {
  // True p50 = 60 min: generate probabilistic-looking but deterministic data —
  // multiple runs per length with success fraction following the true curve.
  const runs = [];
  const lengths = [1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 960];
  for (const m of lengths) {
    const p = 1 / (1 + Math.exp(1.2 * (Math.log2(m) - Math.log2(60))));
    const n = 20;
    const successes = Math.round(p * n);
    for (let i = 0; i < n; i++) runs.push({ humanMinutes: m, success: i < successes ? 1 : 0 });
  }
  const { p50Minutes } = fitP50Horizon(runs);
  assert.ok(p50Minutes > 40 && p50Minutes < 90, `p50 ${p50Minutes} not near 60`);
});

test('horizonAtSuccessRate(a,b,0.5) reproduces the same p50 the fit already found', () => {
  const runs = [];
  const lengths = [1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 960];
  for (const m of lengths) {
    const p = 1 / (1 + Math.exp(1.2 * (Math.log2(m) - Math.log2(60))));
    const n = 20;
    const successes = Math.round(p * n);
    for (let i = 0; i < n; i++) runs.push({ humanMinutes: m, success: i < successes ? 1 : 0 });
  }
  const { p50Minutes, a, b } = fitP50Horizon(runs);
  const recomputed = horizonAtSuccessRate(a, b, 0.5);
  assert.ok(Math.abs(recomputed - p50Minutes) < 1e-6);
});

test('the 80% (reliable) horizon is shorter than the 50% (frontier) horizon on the same curve', () => {
  const { a, b } = fitP50Horizon((() => {
    const runs = [];
    for (const m of [1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 960]) {
      const p = 1 / (1 + Math.exp(1.2 * (Math.log2(m) - Math.log2(60))));
      for (let i = 0; i < 20; i++) runs.push({ humanMinutes: m, success: i < Math.round(p * 20) ? 1 : 0 });
    }
    return runs;
  })());
  const p50 = horizonAtSuccessRate(a, b, 0.5);
  const p80 = horizonAtSuccessRate(a, b, 0.8);
  assert.ok(p80 < p50, `expected 80% horizon (${p80}) < 50% horizon (${p50})`);
});

test('horizonAtSuccessRate rejects out-of-range probabilities and a non-decreasing curve', () => {
  assert.equal(horizonAtSuccessRate(1, -0.5, 0), null);
  assert.equal(horizonAtSuccessRate(1, -0.5, 1), null);
  assert.equal(horizonAtSuccessRate(1, 0.5, 0.8), null); // b >= 0: success doesn't decrease with length
});

test('fit refuses pathological data', () => {
  assert.equal(fitP50Horizon([]).p50Minutes, null);
  // success INCREASES with length — no meaningful horizon
  const upward = [];
  for (const m of [1, 10, 100, 1000]) {
    for (let i = 0; i < 10; i++) upward.push({ humanMinutes: m, success: m >= 100 ? 1 : 0 });
  }
  assert.equal(fitP50Horizon(upward).p50Minutes, null);
});

test('frontier series keeps only advances, sorted by release', () => {
  const s = frontierSeries([
    { alias: 'B', releaseDate: '2024-01-01', p50Minutes: 30 },
    { alias: 'A', releaseDate: '2023-01-01', p50Minutes: 10 },
    { alias: 'C', releaseDate: '2025-01-01', p50Minutes: 20 }, // regression, dropped
    { alias: 'D', releaseDate: '2026-01-01', p50Minutes: 300 },
    { alias: 'E', releaseDate: '2024-06-01', p50Minutes: null }, // invalid, dropped
  ]);
  assert.deepEqual(s.map((p) => p.alias), ['A', 'B', 'D']);
});
