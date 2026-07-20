/**
 * Anchor normalization — pure functions, no I/O.
 * Every function maps raw source values to a 0–100 score per
 * research/anchor-tables.md. Anchor constants carry their "says who".
 *
 * Scale convention: 2019 frontier ≈ 0, AGI-line condition = 100 (D1: month Rubicon).
 */

const clamp = (x) => Math.max(0, Math.min(100, x));

// ── P2: metrTimeHorizon ───────────────────────────────────────────────────────
// Log-linear. 0-anchor: GPT-2 ≈ 4 s (METR TH1). 100-anchor: 1 work-month
// (170 h) — Decision D1, the Rubicon threshold.
const METR_LO_MIN = 4 / 60;      // 0.0667 min
const METR_HI_MIN = 170 * 60;    // 10,200 min

export function normalizeMetrTimeHorizon(p50Minutes) {
  if (!Number.isFinite(p50Minutes) || p50Minutes <= 0) return null;
  const lo = Math.log10(METR_LO_MIN);
  const hi = Math.log10(METR_HI_MIN);
  return clamp(((Math.log10(p50Minutes) - lo) / (hi - lo)) * 100);
}

// ── P2: agenticAutonomyLevel ─────────────────────────────────────────────────
// Morris et al. (arXiv:2311.02462) autonomy rubric, scored on routine
// deployment. +10 if next level demonstrated in limited settings.
const AUTONOMY_LEVELS = { tool: 0, consultant: 25, collaborator: 50, expert: 75, agent: 100 };

export function normalizeAutonomyLevel(routineLevel, nextDemonstrated = false) {
  const base = AUTONOMY_LEVELS[routineLevel];
  if (base === undefined) return null;
  return clamp(base + (nextDemonstrated ? 10 : 0));
}

// ── P1: hendrycksAgiScore ────────────────────────────────────────────────────
// Identity: their published % (agidefinition.ai) is natively 0→AGI-line.
export function normalizeHendrycks(publishedPct) {
  return Number.isFinite(publishedPct) ? clamp(publishedPct) : null;
}

// ── P1: arcGap ───────────────────────────────────────────────────────────────
// Mean over active ARC generations of (frontier ÷ human). Generations with
// frontier > 85% of human retire from the mean (ratchet rule).
export const ARC_RETIREMENT_RATIO = 0.85;

export function normalizeArcGap(generations) {
  if (!Array.isArray(generations) || generations.length === 0) return null;
  const active = generations.filter(
    (g) => Number.isFinite(g.frontierOverHuman) && g.frontierOverHuman < ARC_RETIREMENT_RATIO
  );
  if (active.length === 0) return 100; // everything retired = gap closed
  const mean = active.reduce((s, g) => s + g.frontierOverHuman, 0) / active.length;
  return clamp(mean * 100);
}

// ── P1: selfLearning ─────────────────────────────────────────────────────────
// CL-Bench Gain, piecewise per anchor table. gainRatio = observed Gain as a
// fraction of the human learning-curve improvement (judgment anchor until
// CL-Bench publishes human baselines).
export function normalizeSelfLearning(gainRatio) {
  if (!Number.isFinite(gainRatio)) return null;
  if (gainRatio <= 0) return 0;
  if (gainRatio >= 1) return 100;
  // 0→0, 0.15→30, 0.5→60, 1→100 (piecewise linear through anchor rows)
  if (gainRatio < 0.15) return clamp((gainRatio / 0.15) * 30);
  if (gainRatio < 0.5) return clamp(30 + ((gainRatio - 0.15) / 0.35) * 30);
  return clamp(60 + ((gainRatio - 0.5) / 0.5) * 40);
}

// ── P1: realTimeEngagement ───────────────────────────────────────────────────
// Rubric D2: five milestones × 20 pts, partial credit 0/10/20 each.
const RUBRIC_KEYS = ['m1', 'm2', 'm3', 'm4', 'm5'];

export function normalizeRealTimeEngagement(milestones) {
  if (!milestones) return null;
  let total = 0;
  for (const k of RUBRIC_KEYS) {
    const v = milestones[k];
    if (![0, 10, 20].includes(v)) return null; // malformed scoring — refuse
    total += v;
  }
  return clamp(total);
}

// ── P1: epochBenchmarks ──────────────────────────────────────────────────────
// Versioned basket: mean fraction-of-expert-human across members.
export function normalizeEpochBasket(fractions) {
  if (!Array.isArray(fractions) || fractions.length === 0) return null;
  const valid = fractions.filter(Number.isFinite);
  if (valid.length === 0) return null;
  return clamp((valid.reduce((s, f) => s + f, 0) / valid.length) * 100);
}

// ── P3: anthropicEconIndex ───────────────────────────────────────────────────
// Geometric mean of breadth and depth (each 0–1, as share of TOTAL work,
// not share of AI traffic).
export function normalizeEconIndex(breadth, depth) {
  if (!Number.isFinite(breadth) || !Number.isFinite(depth)) return null;
  if (breadth < 0 || depth < 0) return null;
  return clamp(Math.sqrt(breadth * depth) * 100);
}

// ── P3: aiIndexEconomy ───────────────────────────────────────────────────────
// Mean of firm-adoption and job-posting components, each pre-rebased 0–1.
export function normalizeAiIndexEconomy(adoption01, postings01) {
  const parts = [adoption01, postings01].filter(Number.isFinite);
  if (parts.length === 0) return null;
  return clamp((parts.reduce((s, x) => s + x, 0) / parts.length) * 100);
}

// ── Safety (beside the meter) ────────────────────────────────────────────────
// Best-lab existential-safety domain grade → GPA/4 × 100.
const GRADE_POINTS = {
  'A+': 4.3, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0,
};

export function normalizeSafetyGrade(letter) {
  const gpa = GRADE_POINTS[letter];
  if (gpa === undefined) return null;
  return clamp((gpa / 4.0) * 100);
}
