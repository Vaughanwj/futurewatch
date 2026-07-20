import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMetrTimeHorizon,
  normalizeAutonomyLevel,
  normalizeHendrycks,
  normalizeArcGap,
  normalizeSelfLearning,
  normalizeRealTimeEngagement,
  normalizeEpochBasket,
  normalizeEconIndex,
  normalizeAiIndexEconomy,
  normalizeSafetyGrade,
} from '../src/domain/anchors.js';

test('metrTimeHorizon anchors per D1 (month Rubicon)', () => {
  assert.equal(normalizeMetrTimeHorizon(4 / 60), 0); // GPT-2 2019
  assert.equal(normalizeMetrTimeHorizon(170 * 60), 100); // work-month
  assert.ok(Math.abs(normalizeMetrTimeHorizon(320) - 71) < 1); // Opus 4.5 verified
  assert.ok(Math.abs(normalizeMetrTimeHorizon(480) - 74.4) < 1); // derived work-day
  assert.ok(Math.abs(normalizeMetrTimeHorizon(1) - 22.7) < 1); // derived 1 min
  assert.equal(normalizeMetrTimeHorizon(1e9), 100); // clamps above Rubicon
  assert.equal(normalizeMetrTimeHorizon(-5), null);
  assert.equal(normalizeMetrTimeHorizon(NaN), null);
});

test('autonomy level rubric', () => {
  assert.equal(normalizeAutonomyLevel('tool'), 0);
  assert.equal(normalizeAutonomyLevel('collaborator', true), 60);
  assert.equal(normalizeAutonomyLevel('agent'), 100);
  assert.equal(normalizeAutonomyLevel('agent', true), 100); // clamped
  assert.equal(normalizeAutonomyLevel('wizard'), null);
});

test('hendrycks identity with clamp', () => {
  assert.equal(normalizeHendrycks(58), 58);
  assert.equal(normalizeHendrycks(120), 100);
  assert.equal(normalizeHendrycks(undefined), null);
});

test('arcGap mean of active generations with ratchet retirement', () => {
  const score = normalizeArcGap([
    { name: 'v2', frontierOverHuman: 0.25 },
    { name: 'v3', frontierOverHuman: 0.005 },
  ]);
  assert.ok(Math.abs(score - 12.75) < 0.1);
  // retired generation (>0.85) drops out of the mean
  const withRetired = normalizeArcGap([
    { name: 'v1', frontierOverHuman: 0.99 },
    { name: 'v3', frontierOverHuman: 0.005 },
  ]);
  assert.ok(Math.abs(withRetired - 0.5) < 0.1);
  // everything retired = gap closed
  assert.equal(normalizeArcGap([{ name: 'v1', frontierOverHuman: 0.9 }]), 100);
  assert.equal(normalizeArcGap([]), null);
});

test('selfLearning piecewise anchors', () => {
  assert.equal(normalizeSelfLearning(0), 0);
  assert.ok(Math.abs(normalizeSelfLearning(0.15) - 30) < 0.01);
  assert.ok(Math.abs(normalizeSelfLearning(0.5) - 60) < 0.01);
  assert.equal(normalizeSelfLearning(1), 100);
  assert.ok(Math.abs(normalizeSelfLearning(0.06) - 12) < 0.5);
});

test('realTimeEngagement rubric D2: only 0/10/20 accepted', () => {
  assert.equal(normalizeRealTimeEngagement({ m1: 20, m2: 10, m3: 0, m4: 0, m5: 0 }), 30);
  assert.equal(normalizeRealTimeEngagement({ m1: 20, m2: 15, m3: 0, m4: 0, m5: 0 }), null);
  assert.equal(normalizeRealTimeEngagement({ m1: 20, m2: 10, m3: 0, m4: 0 }), null);
});

test('epoch basket mean', () => {
  assert.equal(normalizeEpochBasket([0.6]), 60);
  assert.equal(normalizeEpochBasket([0.5, 0.7]), 60);
  assert.equal(normalizeEpochBasket([]), null);
});

test('econ index geometric mean punishes lopsidedness', () => {
  assert.ok(Math.abs(normalizeEconIndex(0.36, 0.22) - 28.1) < 0.5);
  assert.ok(normalizeEconIndex(0.9, 0.01) < normalizeEconIndex(0.3, 0.3));
  assert.equal(normalizeEconIndex(NaN, 0.5), null);
});

test('aiIndexEconomy mean', () => {
  assert.ok(Math.abs(normalizeAiIndexEconomy(0.55, 0.3) - 42.5) < 0.01);
});

test('safety grade to 0-100', () => {
  assert.ok(Math.abs(normalizeSafetyGrade('C-') - 42.5) < 0.01);
  assert.equal(normalizeSafetyGrade('F'), 0);
  assert.equal(normalizeSafetyGrade('Z'), null);
});
