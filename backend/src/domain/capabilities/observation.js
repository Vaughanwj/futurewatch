/**
 * CapabilityObservation — the normalized record every source adapter must
 * produce candidates for. Pure; no I/O (hashing uses Node's built-in crypto,
 * which is a standard-library primitive, not an external I/O dependency).
 */
import { createHash } from 'node:crypto';
import {
  isCapability, isEnvironment, isGoalOrigin, isSourceKind, isConfidence,
  isReviewStatus, isUnit, isGoalAutonomyLevel,
} from './value-objects.js';
import { reviewRequired, validateBounds, validateIntegrity } from './policies.js';

/**
 * Stable hash from source identity + version, model, metric, date, and
 * normalized value — reprocessing unchanged source data must yield the same
 * hash so the pipeline can skip creating a duplicate observation.
 */
export function computeSourceHash({
  sourceName, sourceVersion, model, metric, observedAt, value, unit,
}) {
  const key = [sourceName, sourceVersion ?? '', model, metric, observedAt, String(value), unit].join('|');
  return createHash('sha256').update(key).digest('hex');
}

/**
 * @param {object} candidate raw fields proposed by an adapter/normalizer
 * @returns {{observation: object|null, errors: string[], reviewReasons: string[]}}
 */
export function normalizeObservation(candidate) {
  const errors = [];

  if (!isCapability(candidate.capability)) errors.push(`unknown capability: ${candidate.capability}`);
  if (!candidate.metric) errors.push('metric missing');
  if (!candidate.model) errors.push('model identity missing');
  if (candidate.value === undefined || candidate.value === null) errors.push('value missing');
  if (!isUnit(candidate.unit)) errors.push(`unknown or ambiguous unit: ${candidate.unit}`);
  if (!isEnvironment(candidate.environment)) errors.push(`unknown environment: ${candidate.environment}`);
  if (candidate.goalOrigin !== undefined && candidate.goalOrigin !== null && !isGoalOrigin(candidate.goalOrigin)) {
    errors.push(`unknown goal_origin: ${candidate.goalOrigin}`);
  }
  if (!isSourceKind(candidate.sourceKind)) errors.push(`unknown source_kind: ${candidate.sourceKind}`);
  if (!isConfidence(candidate.confidence)) errors.push(`unknown confidence: ${candidate.confidence}`);
  if (!candidate.observedAt) errors.push('observed_at missing where chronology matters');
  if (!candidate.sourceHash) errors.push('source_hash missing');

  if (candidate.capability === 'goal_autonomy' && candidate.goalAutonomyLevel !== undefined && candidate.goalAutonomyLevel !== null) {
    if (!isGoalAutonomyLevel(candidate.goalAutonomyLevel)) {
      errors.push(`goal_autonomy_level out of range: ${candidate.goalAutonomyLevel}`);
    }
  }

  if (errors.length === 0) {
    errors.push(...validateBounds(candidate));
    errors.push(...validateIntegrity(candidate));
  }

  const review = reviewRequired({
    capability: candidate.capability,
    goalAutonomyLevel: candidate.goalAutonomyLevel,
    summary: candidate.publicSummary,
    excerpt: candidate.excerpt,
  });

  if (errors.length > 0) {
    return { observation: null, errors, reviewReasons: review.reasons };
  }

  const reviewStatus = review.required
    ? (isReviewStatus(candidate.reviewStatus) && candidate.reviewStatus !== 'not_required' ? candidate.reviewStatus : 'pending')
    : 'not_required';

  const observation = {
    id: candidate.id ?? null, // assigned by the repository/adapter layer at save time
    capability: candidate.capability,
    metric: candidate.metric,
    model: candidate.model,
    modelProvider: candidate.modelProvider ?? null,
    value: candidate.value,
    unit: candidate.unit,
    environment: candidate.environment,
    goalOrigin: candidate.goalOrigin ?? 'unknown',
    scaffold: candidate.scaffold ?? null,
    observedAt: candidate.observedAt,
    publishedAt: candidate.publishedAt ?? null,
    sourceKind: candidate.sourceKind,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl ?? null,
    sourceDocumentId: candidate.sourceDocumentId ?? null,
    sourceHash: candidate.sourceHash,
    confidence: candidate.confidence,
    evidenceLevel: candidate.evidenceLevel ?? null,
    humanReviewRequired: review.required,
    reviewStatus,
    notes: candidate.notes ?? null,
    rawPayloadReference: candidate.rawPayloadReference ?? null,
    // Capability-specific extension fields pass through untouched — each
    // capability's card-service knows how to read its own shape.
    extra: candidate.extra ?? {},
  };

  return { observation, errors: [], reviewReasons: review.reasons };
}
