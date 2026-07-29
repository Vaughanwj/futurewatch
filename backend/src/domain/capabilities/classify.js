/**
 * Defensive classification of adapter-supplied labels into our closed enums.
 * Pure; no I/O. Adapters see many spellings/phrasings from raw sources —
 * this is the single place that decides what counts as which enum member,
 * so "sim", "simulated", "Simulation" all resolve the same way and nothing
 * a source calls "controlled" silently becomes "real_world".
 */
import { ENVIRONMENT, GOAL_ORIGIN } from './value-objects.js';

const ENVIRONMENT_ALIASES = {
  simulation: 'simulation', simulated: 'simulation', sim: 'simulation',
  controlled_lab: 'controlled_lab', 'controlled lab': 'controlled_lab', lab: 'controlled_lab', controlled: 'controlled_lab',
  sandbox: 'sandbox', sandboxed: 'sandbox',
  limited_deployment: 'limited_deployment', 'limited deployment': 'limited_deployment', pilot: 'limited_deployment',
  real_world: 'real_world', 'real world': 'real_world', production: 'real_world', deployed: 'real_world', wild: 'real_world',
};

const GOAL_ORIGIN_ALIASES = {
  immediate_instruction: 'immediate_instruction', 'immediate instruction': 'immediate_instruction', instructed: 'immediate_instruction',
  externally_assigned: 'externally_assigned', 'externally assigned': 'externally_assigned', assigned: 'externally_assigned',
  trained_preference: 'trained_preference', 'trained preference': 'trained_preference',
  inferred_persistent_goal: 'inferred_persistent_goal', 'inferred persistent goal': 'inferred_persistent_goal', 'instrumental subgoal': 'inferred_persistent_goal',
  apparently_self_generated: 'apparently_self_generated', 'apparently self-generated': 'apparently_self_generated', 'self-generated': 'apparently_self_generated', 'self generated': 'apparently_self_generated',
};

function classify(raw, aliasMap, enumValues) {
  if (raw === undefined || raw === null) return 'unknown';
  const key = String(raw).trim().toLowerCase();
  if (enumValues.includes(key)) return key;
  return aliasMap[key] ?? 'unknown';
}

/** Never returns anything but a member of ENVIRONMENT; unmapped input -> 'unknown'. */
export function classifyEnvironment(raw) {
  return classify(raw, ENVIRONMENT_ALIASES, ENVIRONMENT);
}

/**
 * Never returns anything but a member of GOAL_ORIGIN; unmapped input ->
 * 'unknown'. Critically, an *unrecognized* label never resolves to
 * 'apparently_self_generated' — that value only comes back when the input
 * explicitly says so, since misclassifying "unknown" as "self-generated"
 * would be exactly the kind of overclaim the methodology forbids.
 */
export function classifyGoalOrigin(raw) {
  return classify(raw, GOAL_ORIGIN_ALIASES, GOAL_ORIGIN);
}
