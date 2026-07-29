/**
 * Four Capabilities Watch — value objects (validated enums).
 * Pure; no I/O. Every enum is a closed set — normalization must map unknown
 * input to an explicit "unknown" member rather than passing raw strings
 * through, so the frontend can never render a typo as if it were data.
 */

export const CAPABILITY = Object.freeze([
  'ai_improvement',
  'goal_autonomy',
  'operational_autonomy',
  'resource_acquisition',
]);

export const ENVIRONMENT = Object.freeze([
  'simulation',
  'controlled_lab',
  'sandbox',
  'limited_deployment',
  'real_world',
  'unknown',
]);

export const GOAL_ORIGIN = Object.freeze([
  'immediate_instruction',
  'externally_assigned',
  'trained_preference',
  'inferred_persistent_goal',
  'apparently_self_generated',
  'unknown',
]);

export const SOURCE_KIND = Object.freeze([
  'benchmark',
  'system_card',
  'research_report',
  'academic_paper',
  'official_framework',
  'incident_report',
  'leaderboard',
  'dataset',
  'repository_release',
  'news_report',
  'other',
]);

export const CONFIDENCE = Object.freeze(['low', 'medium', 'high']);

export const REVIEW_STATUS = Object.freeze([
  'not_required',
  'pending',
  'approved',
  'rejected',
  'needs_more_evidence',
]);

export const RECURSIVE_LOOP_STATUS = Object.freeze([
  'none_observed',
  'partial_single_cycle',
  'repeated_human_supervised_cycles',
  'repeated_ai_directed_cycles',
  'sustained_autonomous_recursive_loop',
]);

// goal_autonomy_level is an integer ladder, not a string enum — validated
// separately (see policies.js) since it also carries a review-required rule.
export const GOAL_AUTONOMY_LEVEL_MIN = 0;
export const GOAL_AUTONOMY_LEVEL_MAX = 4;

export const RESOURCE_SUBCAPABILITY = Object.freeze([
  'economic_accumulation',
  'account_acquisition',
  'compute_acquisition',
  'credential_acquisition',
  'financial_transaction',
  'independent_deployment',
  'persistent_control',
  'replication',
  'resource_retention',
  'resource_reinvestment',
]);

export const UNIT = Object.freeze([
  'USD_simulated',
  'USD_real',
  'percent',
  'pass_rate',
  'task_count',
  'boolean',
  'minutes',
  'hours',
  'days',
]);

function makeValidator(allowed) {
  const set = new Set(allowed);
  return (value) => set.has(value);
}

export const isCapability = makeValidator(CAPABILITY);
export const isEnvironment = makeValidator(ENVIRONMENT);
export const isGoalOrigin = makeValidator(GOAL_ORIGIN);
export const isSourceKind = makeValidator(SOURCE_KIND);
export const isConfidence = makeValidator(CONFIDENCE);
export const isReviewStatus = makeValidator(REVIEW_STATUS);
export const isRecursiveLoopStatus = makeValidator(RECURSIVE_LOOP_STATUS);
export const isUnit = makeValidator(UNIT);

export function isGoalAutonomyLevel(value) {
  return (
    Number.isInteger(value) && value >= GOAL_AUTONOMY_LEVEL_MIN && value <= GOAL_AUTONOMY_LEVEL_MAX
  );
}
