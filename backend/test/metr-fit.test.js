import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitP50Horizon, frontierSeries } from '../src/domain/metr-fit.js';

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
