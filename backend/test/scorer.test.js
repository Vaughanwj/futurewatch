import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePillar, scoreComposite, doublingTimeDays } from '../src/domain/scorer.js';

const ind = (value) => ({ value });

test('pillar scoring with full coverage matches anchor-table sanity check', () => {
  const capability = scorePillar('capability', {
    hendrycksAgiScore: ind(58),
    epochBenchmarks: ind(60),
    arcGap: ind(12.75),
    selfLearning: ind(12),
    realTimeEngagement: ind(30),
  });
  assert.ok(Math.abs(capability.score - 34.6) < 0.2);
  assert.equal(capability.coverage, 1);

  const autonomy = scorePillar('autonomy', {
    metrTimeHorizon: ind(71),
    agenticAutonomyLevel: ind(60),
  });
  assert.ok(Math.abs(autonomy.score - 67.7) < 0.2);

  const deployment = scorePillar('deployment', {
    anthropicEconIndex: ind(28.1),
    aiIndexEconomy: ind(42.5),
  });
  assert.ok(Math.abs(deployment.score - 35.3) < 0.2);

  const composite = scoreComposite({ capability, autonomy, deployment });
  // 34.6*.45 + 67.7*.35 + 35.3*.20 = 15.57 + 23.7 + 7.06 ≈ 46.3
  assert.ok(Math.abs(composite.value - 46.3) < 0.5);
  assert.equal(composite.coverage, 1);
});

test('missing indicator renormalizes weights and reports coverage', () => {
  const p = scorePillar('capability', {
    hendrycksAgiScore: ind(60),
    epochBenchmarks: ind(null),
    arcGap: ind(20),
    selfLearning: ind(null),
    realTimeEngagement: ind(40),
  });
  assert.ok(Math.abs(p.score - 40) < 0.01); // equal weights over the 3 present
  assert.equal(p.coverage, 0.6);
});

test('empty pillar yields null score, composite renormalizes', () => {
  const empty = scorePillar('deployment', {});
  assert.equal(empty.score, null);
  const cap = scorePillar('capability', { hendrycksAgiScore: ind(50), epochBenchmarks: ind(50), arcGap: ind(50), selfLearning: ind(50), realTimeEngagement: ind(50) });
  const aut = scorePillar('autonomy', { metrTimeHorizon: ind(50), agenticAutonomyLevel: ind(50) });
  const composite = scoreComposite({ capability: cap, autonomy: aut, deployment: empty });
  assert.equal(composite.value, 50); // renormalized over scored pillars
});

test('doubling time recovers a known exponential', () => {
  // value doubles every 120 days
  const points = [];
  for (let d = 0; d <= 720; d += 60) {
    points.push({ date: new Date(Date.parse('2023-01-01') + d * 86400000).toISOString(), value: Math.pow(2, d / 120) });
  }
  const dt = doublingTimeDays(points);
  assert.ok(Math.abs(dt - 120) <= 1);
  assert.equal(doublingTimeDays(points.slice(0, 2)), null); // too few points
});
