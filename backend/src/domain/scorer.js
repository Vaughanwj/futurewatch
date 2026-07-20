/**
 * Pillar and composite scoring — pure functions, no I/O.
 *
 * Decision D3 (Claude, 2026-07-20, overturnable): v0.1 composite uses level
 * components only. Trajectory (METR doubling, frontier series) is surfaced as
 * display metadata, not blended into the composite, until backfill validation
 * establishes a defensible level:trajectory ratio.
 *
 * Missing indicators: pillar weight is renormalized over present indicators;
 * coverage is reported so the frontend can show honesty ("scored on 4 of 5").
 */

export const PILLAR_WEIGHTS = { capability: 0.45, autonomy: 0.35, deployment: 0.2 };

// Indicator → pillar assignment with intra-pillar weights.
// P2 split 70/30 is [J] — open challenge 5 in anchor-tables.md.
export const PILLAR_DEFS = {
  capability: {
    hendrycksAgiScore: 0.2,
    epochBenchmarks: 0.2,
    arcGap: 0.2,
    selfLearning: 0.2,
    realTimeEngagement: 0.2,
  },
  autonomy: {
    metrTimeHorizon: 0.7,
    agenticAutonomyLevel: 0.3,
  },
  deployment: {
    anthropicEconIndex: 0.5,
    aiIndexEconomy: 0.5,
  },
};

/**
 * @param {Object<string, {value:number|null}>} indicators keyed by slug
 * @returns {import('../ports/types.js').PillarScore}
 */
export function scorePillar(name, indicators) {
  const def = PILLAR_DEFS[name];
  if (!def) throw new Error(`unknown pillar: ${name}`);

  const rows = Object.entries(def).map(([slug, weight]) => ({
    slug,
    weight,
    score: Number.isFinite(indicators[slug]?.value) ? indicators[slug].value : null,
  }));

  const present = rows.filter((r) => r.score !== null);
  const presentWeight = present.reduce((s, r) => s + r.weight, 0);

  const score =
    presentWeight > 0
      ? present.reduce((s, r) => s + r.score * (r.weight / presentWeight), 0)
      : null;

  return {
    name,
    weight: PILLAR_WEIGHTS[name],
    score: score === null ? null : round1(score),
    coverage: round2(present.length / rows.length),
    indicators: rows,
  };
}

/**
 * Composite over pillars, renormalizing over pillars that produced a score.
 */
export function scoreComposite(pillars) {
  const scored = Object.values(pillars).filter((p) => p.score !== null);
  const totalWeight = scored.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return { value: null, coverage: 0 };
  const value = scored.reduce((s, p) => s + p.score * (p.weight / totalWeight), 0);
  const coverage =
    Object.values(pillars).reduce((s, p) => s + p.coverage * p.weight, 0) /
    Object.values(pillars).reduce((s, p) => s + p.weight, 0);
  return { value: round1(value), coverage: round2(coverage) };
}

/**
 * Doubling time (days) of an exponentially-growing series via OLS of
 * log2(value) on time. Points: [{date: ISO string, value: number}].
 * Returns null with fewer than 3 points.
 */
export function doublingTimeDays(points, sinceIso = null) {
  const cutoff = sinceIso ? Date.parse(sinceIso) : -Infinity;
  const pts = (points || [])
    .filter((p) => Number.isFinite(p.value) && p.value > 0 && Date.parse(p.date) >= cutoff)
    .map((p) => ({ t: Date.parse(p.date) / 86400000, y: Math.log2(p.value) }));
  if (pts.length < 3) return null;
  const n = pts.length;
  const mt = pts.reduce((s, p) => s + p.t, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.t - mt) * (p.y - my);
    den += (p.t - mt) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den; // doublings per day
  if (slope <= 0) return null;
  return Math.round(1 / slope);
}

const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;
