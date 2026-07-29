import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCapability, isGoalAutonomyLevel } from '../../src/domain/capabilities/value-objects.js';
import { reviewRequired, validateBounds, validateIntegrity, HIGH_RISK_PHRASES } from '../../src/domain/capabilities/policies.js';
import { normalizeObservation, computeSourceHash } from '../../src/domain/capabilities/observation.js';
import { classifyEnvironment, classifyGoalOrigin } from '../../src/domain/capabilities/classify.js';
import { partitionNewObservations } from '../../src/domain/capabilities/dedup.js';
import { buildCapabilityCards } from '../../src/domain/capabilities/card-service.js';

// ── value objects ────────────────────────────────────────────────────────

test('capability enum rejects unknown values', () => {
  assert.equal(isCapability('resource_acquisition'), true);
  assert.equal(isCapability('telekinesis'), false);
});

test('goal autonomy level bounds are 0-4 integer only', () => {
  assert.equal(isGoalAutonomyLevel(0), true);
  assert.equal(isGoalAutonomyLevel(4), true);
  assert.equal(isGoalAutonomyLevel(5), false);
  assert.equal(isGoalAutonomyLevel(-1), false);
  assert.equal(isGoalAutonomyLevel(2.5), false);
});

// ── classification: goal-origin and environment ──────────────────────────

test('environment classification maps common phrasings, unknown stays unknown', () => {
  assert.equal(classifyEnvironment('Simulated'), 'simulation');
  assert.equal(classifyEnvironment('production'), 'real_world');
  assert.equal(classifyEnvironment('controlled lab'), 'controlled_lab');
  assert.equal(classifyEnvironment('something the source invented'), 'unknown');
  assert.equal(classifyEnvironment(undefined), 'unknown');
});

test('CRITICAL: an assigned goal is never classified as self-generated', () => {
  assert.equal(classifyGoalOrigin('assigned'), 'externally_assigned');
  assert.equal(classifyGoalOrigin('externally assigned'), 'externally_assigned');
  // Unrecognized input must resolve to 'unknown', never to the highest-stakes
  // enum member by default.
  assert.equal(classifyGoalOrigin('the model just did its own thing sort of'), 'unknown');
  assert.equal(classifyGoalOrigin('self-generated'), 'apparently_self_generated');
});

// ── review-required policy ───────────────────────────────────────────────

test('goal_autonomy levels 2-4 require review; 0-1 do not', () => {
  assert.equal(reviewRequired({ capability: 'goal_autonomy', goalAutonomyLevel: 0 }).required, false);
  assert.equal(reviewRequired({ capability: 'goal_autonomy', goalAutonomyLevel: 1 }).required, false);
  assert.equal(reviewRequired({ capability: 'goal_autonomy', goalAutonomyLevel: 2 }).required, true);
  assert.equal(reviewRequired({ capability: 'goal_autonomy', goalAutonomyLevel: 3 }).required, true);
  assert.equal(reviewRequired({ capability: 'goal_autonomy', goalAutonomyLevel: 4 }).required, true);
});

test('CRITICAL: high-risk claims always enter review regardless of capability', () => {
  for (const phrase of HIGH_RISK_PHRASES) {
    const result = reviewRequired({ capability: 'resource_acquisition', summary: `Report states: ${phrase} occurred.` });
    assert.equal(result.required, true, `expected review required for phrase: ${phrase}`);
  }
});

test('a benign summary with no high-risk phrase and no goal-autonomy level does not require review', () => {
  const result = reviewRequired({ capability: 'operational_autonomy', summary: 'The agent completed a terminal task benchmark.' });
  assert.equal(result.required, false);
});

// ── bounds ────────────────────────────────────────────────────────────────

test('percent and pass_rate bounds are enforced', () => {
  assert.deepEqual(validateBounds({ unit: 'percent', value: 101, metric: 'x' }), ['x: percent out of [0,100]: 101']);
  assert.deepEqual(validateBounds({ unit: 'percent', value: 50, metric: 'x' }), []);
  assert.deepEqual(validateBounds({ unit: 'pass_rate', value: 1.5, metric: 'y' }), ['y: pass_rate out of [0,1]: 1.5']);
});

test('CRITICAL: a simulated balance can never be labeled real-world', () => {
  const errors = validateIntegrity({
    model: 'example-model', unit: 'USD_simulated', environment: 'real_world', sourceUrl: 'https://example.com',
  });
  assert.ok(errors.some((e) => e.includes('simulated currency value cannot be attributed to a real_world environment')));
});

test('a real balance from a simulation environment is also rejected', () => {
  const errors = validateIntegrity({
    model: 'x', unit: 'USD_real', environment: 'simulation', sourceUrl: 'https://example.com',
  });
  assert.ok(errors.some((e) => e.includes('real-world currency value cannot come from a simulation environment')));
});

test('claiming apparently_self_generated at low evidence level is flagged inconsistent', () => {
  const errors = validateIntegrity({
    model: 'x', unit: 'boolean', environment: 'sandbox', sourceUrl: 'https://example.com',
    goalOrigin: 'apparently_self_generated', evidenceLevel: 1,
  });
  assert.ok(errors.some((e) => e.includes('inconsistent with evidence_level')));
});

// ── observation normalization ─────────────────────────────────────────────

function baseCandidate(overrides = {}) {
  return {
    capability: 'operational_autonomy',
    metric: 'metr_task_horizon_50pct',
    model: 'example-model',
    modelProvider: 'example-provider',
    value: 60,
    unit: 'minutes',
    environment: 'controlled_lab',
    goalOrigin: 'externally_assigned',
    observedAt: '2026-07-28T00:00:00Z',
    sourceKind: 'benchmark',
    sourceName: 'METR',
    sourceUrl: 'https://metr.org',
    sourceHash: 'abc123',
    confidence: 'high',
    ...overrides,
  };
}

test('a well-formed candidate normalizes cleanly with reviewStatus not_required', () => {
  const { observation, errors } = normalizeObservation(baseCandidate());
  assert.deepEqual(errors, []);
  assert.equal(observation.reviewStatus, 'not_required');
  assert.equal(observation.humanReviewRequired, false);
});

test('CRITICAL: a high-risk claim always lands in the review queue, not auto-published', () => {
  const { observation, errors } = normalizeObservation(
    baseCandidate({ capability: 'resource_acquisition', unit: 'boolean', value: true, publicSummary: 'The agent self-replicated across hosts.' })
  );
  assert.deepEqual(errors, []);
  assert.equal(observation.humanReviewRequired, true);
  assert.equal(observation.reviewStatus, 'pending');
});

test('goal_autonomy level 3 candidate requires review even with high confidence', () => {
  const { observation } = normalizeObservation(
    baseCandidate({ capability: 'goal_autonomy', metric: 'goal_autonomy_level', unit: 'boolean', value: true, goalAutonomyLevel: 3 })
  );
  assert.equal(observation.humanReviewRequired, true);
  assert.equal(observation.reviewStatus, 'pending');
});

test('missing model identity is rejected, not silently defaulted', () => {
  const c = baseCandidate();
  delete c.model;
  const { observation, errors } = normalizeObservation(c);
  assert.equal(observation, null);
  assert.ok(errors.some((e) => e.includes('model identity missing')));
});

test('an unofficial/unverifiable source (no url, not dataset) is rejected', () => {
  const c = baseCandidate({ sourceUrl: undefined });
  const { observation, errors } = normalizeObservation(c);
  assert.equal(observation, null);
  assert.ok(errors.some((e) => e.includes('source_url missing')));
});

// ── source hash / dedup ──────────────────────────────────────────────────

test('source hash is stable for identical inputs and changes when value changes', () => {
  const args = { sourceName: 'METR', sourceVersion: 'TH1.1', model: 'example-model', metric: 'metr_task_horizon_50pct', observedAt: '2026-07-28', value: 60, unit: 'minutes' };
  const h1 = computeSourceHash(args);
  const h2 = computeSourceHash(args);
  const h3 = computeSourceHash({ ...args, value: 61 });
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test('CRITICAL: reprocessing unchanged source data does not create duplicate observations', () => {
  const known = new Set(['hash-a']);
  const candidates = [{ sourceHash: 'hash-a' }, { sourceHash: 'hash-b' }];
  const { fresh, duplicates } = partitionNewObservations(known, candidates);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].sourceHash, 'hash-b');
  assert.equal(duplicates.length, 1);
});

test('duplicates within the same batch (two runs of the same job) are also caught', () => {
  const { fresh, duplicates } = partitionNewObservations(new Set(), [{ sourceHash: 'x' }, { sourceHash: 'x' }]);
  assert.equal(fresh.length, 1);
  assert.equal(duplicates.length, 1);
});

// ── card service ──────────────────────────────────────────────────────────

test('CRITICAL: a one-cycle improvement is not classified as recursive self-improvement by default', () => {
  const obs = [{
    capability: 'ai_improvement', metric: 'postrainbench', model: 'm1', value: 42,
    observedAt: '2026-07-01T00:00:00Z', reviewStatus: 'not_required', extra: {},
  }];
  const cards = buildCapabilityCards(obs);
  assert.equal(cards.aiImprovement.recursiveLoopStatus, 'none_observed');
});

test('CRITICAL: an unreviewed (pending) high-stakes observation never drives the public card', () => {
  const obs = [{
    capability: 'goal_autonomy', metric: 'goal_autonomy_level', model: 'm1', value: true,
    observedAt: '2026-07-01T00:00:00Z', reviewStatus: 'pending', goalOrigin: 'apparently_self_generated',
    extra: { goalAutonomyLevel: 4 },
  }];
  const cards = buildCapabilityCards(obs);
  assert.equal(cards.goalAutonomy.highestReviewedLevel, 0);
  assert.equal(cards.goalAutonomy.pendingCount, 1);
});

test('an approved goal_autonomy observation does drive the public card', () => {
  const obs = [{
    capability: 'goal_autonomy', metric: 'goal_autonomy_level', model: 'm1', value: true,
    observedAt: '2026-07-01T00:00:00Z', reviewStatus: 'approved', goalOrigin: 'inferred_persistent_goal',
    extra: { goalAutonomyLevel: 2 },
  }];
  const cards = buildCapabilityCards(obs);
  assert.equal(cards.goalAutonomy.highestReviewedLevel, 2);
  assert.equal(cards.goalAutonomy.persistedWithoutInstruction, true);
});

test('resource acquisition: simulated balance never satisfies real-world acquisition status', () => {
  const obs = [{
    capability: 'resource_acquisition', metric: 'vending_bench_2_balance', model: 'm1', value: 10936.76,
    unit: 'USD_simulated', environment: 'simulation', observedAt: '2026-07-28T00:00:00Z',
    reviewStatus: 'not_required', extra: { subcapability: 'economic_accumulation' },
  }];
  const cards = buildCapabilityCards(obs);
  assert.equal(cards.resourceAcquisition.bestSimulatedResult, 10936.76);
  assert.equal(cards.resourceAcquisition.realWorldResourceAcquisitionObserved, false);
});

test('operational autonomy separates the 50% and 80% horizons rather than blending them', () => {
  const obs = [
    { capability: 'operational_autonomy', metric: 'metr_task_horizon_50pct', model: 'm1', value: 240, observedAt: '2026-07-20T00:00:00Z', reviewStatus: 'not_required', extra: {} },
    { capability: 'operational_autonomy', metric: 'metr_task_horizon_80pct', model: 'm1', value: 45, observedAt: '2026-07-20T00:00:00Z', reviewStatus: 'not_required', extra: {} },
  ];
  const cards = buildCapabilityCards(obs);
  assert.equal(cards.operationalAutonomy.frontierTaskHorizonMinutes, 240);
  assert.equal(cards.operationalAutonomy.reliableTaskHorizonMinutes, 45);
});
