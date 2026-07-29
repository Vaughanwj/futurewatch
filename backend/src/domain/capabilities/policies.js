/**
 * Review-required policy and sanity bounds — the core safety layer for Four
 * Capabilities Watch. Pure; no I/O. This is deliberately conservative: when
 * unsure, require review rather than auto-publish (methodology core
 * principle — do not claim recursive self-improvement, self-originated
 * goals, wild replication, or independent resource ownership unless the
 * source directly supports it).
 */
import { isGoalAutonomyLevel } from './value-objects.js';

// Any of these substrings appearing in a candidate's proposed summary or
// supporting excerpt forces human review, regardless of proposed confidence
// or capability — these are exactly the claims the methodology says must
// never be auto-published.
export const HIGH_RISK_PHRASES = Object.freeze([
  'recursive self-improvement',
  'self-generated goal',
  'escaped',
  'self-replicated',
  'acquired real-world resources',
  'obtained real money',
  'obtained credentials',
  'created an external account',
  'evaded shutdown',
  'resisted replacement',
  'removed oversight',
  'maintained persistent control',
  'acted without authorization',
]);

// Keywords that flag a candidate as goal-autonomy-relevant qualitative
// evidence for triage purposes (not a review-required trigger by
// themselves — level and phrase checks below own that).
export const GOAL_AUTONOMY_EVIDENCE_KEYWORDS = Object.freeze([
  'scheming',
  'goal persistence',
  'goal guarding',
  'alignment faking',
  'self-preservation',
  'oversight removal',
  'sandbagging',
  'evaluation awareness',
  'unprompted behavior',
  'coherent misaligned goal',
  'deceptive alignment',
  'power seeking',
  'shutdown avoidance',
  'replacement avoidance',
]);

function matchesHighRiskPhrase(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return HIGH_RISK_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * @param {{capability:string, goalAutonomyLevel?:number|null, summary?:string, excerpt?:string}} candidate
 * @returns {{required:boolean, reasons:string[]}}
 */
export function reviewRequired(candidate) {
  const reasons = [];

  if (candidate.capability === 'goal_autonomy') {
    const level = candidate.goalAutonomyLevel;
    if (level === null || level === undefined || !isGoalAutonomyLevel(level)) {
      reasons.push('goal_autonomy candidate missing a valid level');
    } else if (level >= 2) {
      reasons.push(`goal_autonomy level ${level} requires review (levels 2-4)`);
    }
  }

  if (matchesHighRiskPhrase(candidate.summary)) reasons.push('summary contains a high-risk phrase');
  if (matchesHighRiskPhrase(candidate.excerpt)) reasons.push('excerpt contains a high-risk phrase');

  return { required: reasons.length > 0, reasons };
}

/**
 * Per-metric bounds/sanity checks. Returns a list of violation strings;
 * empty means the observation passes. Deliberately metric-shaped rather
 * than one generic numeric range, since "percent" and "goal autonomy level"
 * and "human intervention count" have different valid domains.
 */
export function validateBounds({ unit, value, metric }) {
  const errors = [];
  if (unit === 'percent') {
    if (!(value >= 0 && value <= 100)) errors.push(`${metric}: percent out of [0,100]: ${value}`);
  } else if (unit === 'pass_rate') {
    if (!(value >= 0 && value <= 1)) errors.push(`${metric}: pass_rate out of [0,1]: ${value}`);
  } else if (unit === 'task_count') {
    if (!(Number.isInteger(value) && value >= 0)) errors.push(`${metric}: task_count must be a non-negative integer: ${value}`);
  } else if (unit === 'minutes' || unit === 'hours' || unit === 'days') {
    if (!(Number.isFinite(value) && value > 0)) errors.push(`${metric}: duration must be positive: ${value}`);
  } else if (unit === 'USD_simulated' || unit === 'USD_real') {
    // May be negative (a losing simulated business), but must be finite.
    if (!Number.isFinite(value)) errors.push(`${metric}: currency value must be finite: ${value}`);
  } else if (unit === 'boolean') {
    if (typeof value !== 'boolean') errors.push(`${metric}: expected boolean, got ${typeof value}`);
  }
  return errors;
}

/**
 * Structural + labeling-integrity checks independent of the numeric bounds
 * above — these are the "never mislabel X as Y" guards from the
 * methodology's core principle.
 */
export function validateIntegrity(candidate) {
  const errors = [];

  if (!candidate.model) errors.push('model identity missing');
  if (!candidate.unit) errors.push('unit missing or ambiguous');

  if (candidate.unit === 'USD_simulated' && candidate.environment === 'real_world') {
    errors.push('simulated currency value cannot be attributed to a real_world environment');
  }
  if (candidate.unit === 'USD_real' && candidate.environment === 'simulation') {
    errors.push('real-world currency value cannot come from a simulation environment');
  }

  if (candidate.goalOrigin === 'apparently_self_generated' && candidate.evidenceLevel !== undefined && candidate.evidenceLevel < 3) {
    // Levels 0-2 in the goal-autonomy ladder are, by definition, either an
    // instruction, an instrumental subgoal, or a preserved assigned/learned
    // goal — none of those are "apparently self-generated" by the ladder's
    // own definitions (that's Level 4). A candidate claiming self-generation
    // at a low level is internally inconsistent and must be flagged.
    errors.push('goal_origin=apparently_self_generated is inconsistent with evidence_level < 3');
  }

  if (candidate.recursiveLoopStatus && candidate.recursiveLoopStatus !== 'none_observed' && candidate.recursiveLoopStatus !== 'partial_single_cycle') {
    if (!candidate.improvementCycleFollowed) {
      errors.push('recursive_loop_status beyond partial_single_cycle requires improvementCycleFollowed evidence');
    }
  }

  if (!candidate.sourceUrl && candidate.sourceKind !== 'dataset') {
    errors.push('source_url missing');
  }

  return errors;
}
