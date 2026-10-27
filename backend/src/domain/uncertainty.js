/**
 * A plausible range around the composite — pure; no I/O.
 *
 * A bare "57.2" implies a precision the inputs don't have. This is NOT a
 * statistical confidence interval; it is a stated, reproducible sensitivity:
 *
 *   - measured inputs that publish an interval use it (ECI: Epoch's CI;
 *     METR time horizon: METR's CI on the p50);
 *   - judgment-scored inputs get ±JUDGMENT_HALF_WIDTH points — an explicit
 *     [J] assumption, roughly one step of their scoring rubrics;
 *   - everything else (exact leaderboard readings, provisional survey
 *     figures) gets no band of its own — their weaknesses are labelled
 *     elsewhere, not quantified here.
 *
 * Each input's effect on the composite is its effective weight × its
 * distance to the bound; effects are combined in quadrature (independent
 * errors), separately for the low and high sides, because the METR interval
 * is skewed. The result is rounded to whole points on the page, on purpose.
 */
import { normalizeEciCapability, normalizeMetrTimeHorizon } from './anchors.js';
import { effectiveWeights } from './weight-shares.js';

export const JUDGMENT_HALF_WIDTH = 10;

const clamp = (x) => Math.max(0, Math.min(100, x));

/**
 * @returns {{lo:number, hi:number, source:'interval'|'judgment'}|null} bounds on the 0–100 indicator score
 */
export function indicatorBounds(slug, reading) {
  const v = reading?.value;
  if (!Number.isFinite(v)) return null;
  const raw = reading.raw ?? {};

  if (slug === 'eciCapability') {
    const lo = normalizeEciCapability(raw.ciLow);
    const hi = normalizeEciCapability(raw.ciHigh);
    if (lo !== null && hi !== null) return { lo: Math.min(lo, v), hi: Math.max(hi, v), source: 'interval' };
  }
  if (slug === 'metrTimeHorizon') {
    const lo = normalizeMetrTimeHorizon(raw.ciLowMinutes);
    const hi = normalizeMetrTimeHorizon(raw.ciHighMinutes);
    if (lo !== null && hi !== null) return { lo: Math.min(lo, v), hi: Math.max(hi, v), source: 'interval' };
  }
  if (reading.confidence === 'judgment') {
    return { lo: clamp(v - JUDGMENT_HALF_WIDTH), hi: clamp(v + JUDGMENT_HALF_WIDTH), source: 'judgment' };
  }
  return null;
}

/**
 * @param {number|null} composite the headline value
 * @param {Object} pillars scored pillars (scorer.js shape)
 * @param {Object<string, object>} indicators normalized readings keyed by slug
 * @returns {{low:number, high:number, judgmentHalfWidth:number, method:string}|null}
 */
export function compositeRange(composite, pillars, indicators) {
  if (!Number.isFinite(composite)) return null;
  let down = 0;
  let up = 0;
  for (const [slug, w] of Object.entries(effectiveWeights(pillars))) {
    const b = indicatorBounds(slug, indicators[slug]);
    if (!b) continue;
    const v = indicators[slug].value;
    down += (w * (v - b.lo)) ** 2;
    up += (w * (b.hi - v)) ** 2;
  }
  const r1 = (x) => Math.round(x * 10) / 10;
  return {
    low: r1(Math.max(0, composite - Math.sqrt(down))),
    high: r1(Math.min(100, composite + Math.sqrt(up))),
    judgmentHalfWidth: JUDGMENT_HALF_WIDTH,
    method:
      'Published intervals (ECI, METR) plus ±10 points on judgment-scored inputs, each weighted by its share of the composite and combined in quadrature. A sensitivity range, not a statistical confidence interval.',
  };
}
