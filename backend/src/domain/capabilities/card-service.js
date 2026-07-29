/**
 * Builds the four Four Capabilities Watch card summaries from a flat list of
 * CapabilityObservations. Pure; no I/O.
 *
 * Publication rule: only observations with reviewStatus 'not_required' or
 * 'approved' feed the public "current state" fields. Anything 'pending',
 * 'needs_more_evidence', or 'rejected' is counted (so the UI can show
 * "N pending review") but never used to assert a public claim — this is the
 * enforcement point for "qualitative high-risk claims must enter review
 * rather than auto-publish."
 */
import { RECURSIVE_LOOP_STATUS } from './value-objects.js';

const PUBLISHABLE = new Set(['not_required', 'approved']);

function publishable(observations) {
  return observations.filter((o) => PUBLISHABLE.has(o.reviewStatus));
}

function latestByMetric(observations, metric) {
  const rows = observations
    .filter((o) => o.metric === metric)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  return rows[0] ?? null;
}

function previousByMetric(observations, metric, latest) {
  if (!latest) return null;
  const rows = observations
    .filter((o) => o.metric === metric && o.observedAt !== latest.observedAt)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  return rows[0] ?? null;
}

function buildAiImprovement(observations) {
  const pub = publishable(observations.filter((o) => o.capability === 'ai_improvement'));
  const pendingCount = observations.filter(
    (o) => o.capability === 'ai_improvement' && !PUBLISHABLE.has(o.reviewStatus)
  ).length;

  if (pub.length === 0) {
    return {
      bestModel: null, benchmark: null, currentScore: null, previousScore: null,
      change: null, humanBaseline: null, improvedAnotherModel: null, wasDeployed: null,
      improvementCycleFollowed: null, recursiveLoopStatus: 'none_observed', pendingCount,
    };
  }

  const latest = pub.reduce((best, o) => (best === null || Date.parse(o.observedAt) > Date.parse(best.observedAt) ? o : best), null);
  const previous = previousByMetric(pub, latest.metric, latest);

  // Only an APPROVED observation may assert a loop status beyond the
  // conservative default — this is the "public interface should currently
  // default to none_observed unless direct evidence supports another value"
  // rule from the methodology, enforced structurally rather than by convention.
  const assertedLoop = pub
    .map((o) => o.extra?.recursiveLoopStatus)
    .filter((s) => RECURSIVE_LOOP_STATUS.includes(s))
    .sort((a, b) => RECURSIVE_LOOP_STATUS.indexOf(b) - RECURSIVE_LOOP_STATUS.indexOf(a))[0];

  return {
    bestModel: latest.model,
    benchmark: latest.metric,
    currentScore: latest.value,
    previousScore: previous?.value ?? null,
    change: previous ? latest.value - previous.value : null,
    humanBaseline: latest.extra?.humanBaseline ?? null,
    improvedAnotherModel: latest.extra?.improvedAnotherModel ?? null,
    wasDeployed: latest.extra?.wasDeployed ?? null,
    improvementCycleFollowed: latest.extra?.improvementCycleFollowed ?? null,
    recursiveLoopStatus: assertedLoop ?? 'none_observed',
    pendingCount,
  };
}

function buildGoalAutonomy(observations) {
  const all = observations.filter((o) => o.capability === 'goal_autonomy');
  const pub = publishable(all);
  const pendingCount = all.length - pub.length;

  if (pub.length === 0) {
    return {
      highestReviewedLevel: 0, externallyAssigned: null, persistedWithoutInstruction: null,
      evidenceKeywords: [], pendingCount,
    };
  }

  const highest = pub.reduce((max, o) => {
    const level = o.extra?.goalAutonomyLevel ?? 0;
    return level > max ? level : max;
  }, 0);
  const topEvidence = pub.find((o) => (o.extra?.goalAutonomyLevel ?? 0) === highest);

  return {
    highestReviewedLevel: highest,
    externallyAssigned: topEvidence?.goalOrigin === 'externally_assigned' || topEvidence?.goalOrigin === 'immediate_instruction',
    persistedWithoutInstruction: highest >= 2,
    evidenceKeywords: topEvidence?.extra?.matchedKeywords ?? [],
    pendingCount,
  };
}

function buildOperationalAutonomy(observations) {
  const pub = publishable(observations.filter((o) => o.capability === 'operational_autonomy'));
  const pendingCount = observations.filter(
    (o) => o.capability === 'operational_autonomy' && !PUBLISHABLE.has(o.reviewStatus)
  ).length;

  const reliable = latestByMetric(pub, 'metr_task_horizon_80pct');
  const frontier = latestByMetric(pub, 'metr_task_horizon_50pct');
  const computerUse = latestByMetric(pub, 'computer_use_success');
  const terminal = latestByMetric(pub, 'terminal_task_success');

  return {
    reliableTaskHorizonMinutes: reliable?.value ?? null,
    reliableTaskHorizonModel: reliable?.model ?? null,
    frontierTaskHorizonMinutes: frontier?.value ?? null,
    frontierTaskHorizonModel: frontier?.model ?? null,
    computerUseSuccess: computerUse?.value ?? null,
    terminalTaskSuccess: terminal?.value ?? null,
    pendingCount,
  };
}

function buildResourceAcquisition(observations) {
  const pub = publishable(observations.filter((o) => o.capability === 'resource_acquisition'));
  const pendingCount = observations.filter(
    (o) => o.capability === 'resource_acquisition' && !PUBLISHABLE.has(o.reviewStatus)
  ).length;

  const bestEconomic = pub
    .filter((o) => o.unit === 'USD_simulated' || o.unit === 'USD_real')
    .sort((a, b) => b.value - a.value)[0] ?? null;

  const replication = pub.find((o) => o.extra?.subcapability === 'replication') ?? null;
  const computeOrAccount = pub.find(
    (o) => o.extra?.subcapability === 'compute_acquisition' || o.extra?.subcapability === 'account_acquisition'
  ) ?? null;

  // "Real-world resource acquisition status" must default to not-observed
  // unless an approved, real_world-environment observation says otherwise —
  // simulated results, however large, never satisfy this field.
  const realWorldEvidence = pub.find(
    (o) => o.environment === 'real_world' && o.extra?.subcapability
  ) ?? null;

  return {
    bestSimulatedResult: bestEconomic && bestEconomic.unit === 'USD_simulated' ? bestEconomic.value : null,
    bestSimulatedResultModel: bestEconomic && bestEconomic.unit === 'USD_simulated' ? bestEconomic.model : null,
    computeOrAccountAcquisition: computeOrAccount?.extra?.subcapability ?? null,
    persistenceOrReplicationEvidence: replication
      ? { environment: replication.environment, value: replication.value, model: replication.model }
      : null,
    realWorldResourceAcquisitionObserved: Boolean(realWorldEvidence),
    pendingCount,
  };
}

/**
 * @param {Array} observations flat list of normalized CapabilityObservations
 * @returns {{aiImprovement:object, goalAutonomy:object, operationalAutonomy:object, resourceAcquisition:object}}
 */
export function buildCapabilityCards(observations) {
  return {
    aiImprovement: buildAiImprovement(observations),
    goalAutonomy: buildGoalAutonomy(observations),
    operationalAutonomy: buildOperationalAutonomy(observations),
    resourceAcquisition: buildResourceAcquisition(observations),
  };
}
