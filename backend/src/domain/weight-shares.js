/**
 * Effective weights, and how much of the composite rests on inputs of each
 * confidence level — pure; no I/O.
 *
 * Added after an outside review (2026-10) pointed out that the headline
 * leans heavily on inputs the site itself labels "judgment", which a visitor
 * can't see from the number alone. Weights are *effective*: the pillar weight
 * and intra-pillar weight after renormalizing over whatever is present,
 * exactly as scorePillar / scoreComposite apply them, so they sum to 1 and
 * track what actually moves the headline.
 */

/**
 * @param {Object<string, {weight:number, score:number|null, indicators:Array<{slug:string, weight:number, score:number|null}>}>} pillars
 * @returns {Object<string, number>} slug → share of the composite (unrounded); empty if nothing scored
 */
export function effectiveWeights(pillars) {
  const out = {};
  const scoredPillars = Object.values(pillars).filter((p) => p.score !== null);
  const pillarTotal = scoredPillars.reduce((s, p) => s + p.weight, 0);
  if (pillarTotal === 0) return out;
  for (const p of scoredPillars) {
    const present = p.indicators.filter((r) => r.score !== null);
    const presentWeight = present.reduce((s, r) => s + r.weight, 0);
    if (presentWeight === 0) continue;
    for (const r of present) out[r.slug] = (p.weight / pillarTotal) * (r.weight / presentWeight);
  }
  return out;
}

/**
 * @param {Object} pillars as for effectiveWeights
 * @param {Object<string, {confidence?:string}>} indicators keyed by slug
 * @returns {{verified:number, provisional:number, judgment:number}} shares in [0,1], 3 d.p.; zeros if nothing scored
 */
export function weightByConfidence(pillars, indicators) {
  const out = { verified: 0, provisional: 0, judgment: 0 };
  for (const [slug, w] of Object.entries(effectiveWeights(pillars))) {
    const c = indicators[slug]?.confidence;
    // anything not explicitly verified or judgment is treated as provisional
    out[c === 'verified' ? 'verified' : c === 'judgment' ? 'judgment' : 'provisional'] += w;
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 1000) / 1000;
  return out;
}
