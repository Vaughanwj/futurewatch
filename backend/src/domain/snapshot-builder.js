/**
 * Snapshot builder — pure assembly of futurewatch.json from adapter results.
 * No I/O. All normalization routed through anchors.js here, so adapters stay
 * shape-only and the scoring stays testable.
 */
import {
  normalizeMetrTimeHorizon,
  normalizeAutonomyLevel,
  normalizeEciCapability,
  normalizeArcGap,
  normalizeSelfLearning,
  normalizeRealTimeEngagement,
  normalizeEpochBasket,
  normalizeEconIndex,
  normalizeAiIndexEconomy,
  normalizeSafetyGrade,
} from './anchors.js';
import { scorePillar, scoreComposite, doublingTimeDays, PILLAR_DEFS } from './scorer.js';
import { assessFreshness, summarizeFreshness } from './freshness.js';

// Inputs that feed the composite — what the headline number rests on.
const SCORED_SLUGS = new Set(Object.values(PILLAR_DEFS).flatMap((def) => Object.keys(def)));

const NORMALIZERS = {
  metrTimeHorizon: (raw) => normalizeMetrTimeHorizon(raw?.p50Minutes),
  agenticAutonomyLevel: (raw) => normalizeAutonomyLevel(raw?.routineLevel, raw?.nextDemonstrated),
  eciCapability: (raw) => normalizeEciCapability(raw?.eci),
  arcGap: (raw) => normalizeArcGap(raw?.generations),
  selfLearning: (raw) => normalizeSelfLearning(raw?.gainRatio),
  realTimeEngagement: (raw) => normalizeRealTimeEngagement(raw?.milestones),
  epochBenchmarks: (raw) => normalizeEpochBasket(raw?.fractions),
  anthropicEconIndex: (raw) => normalizeEconIndex(raw?.breadth, raw?.depth),
  aiIndexEconomy: (raw) => normalizeAiIndexEconomy(raw?.adoption01, raw?.postings01),
};

/**
 * @param {Object} opts
 * @param {Object<string, import('../ports/types.js').AdapterResult>} opts.results keyed by adapter name
 * @param {Date} [opts.now]
 * @returns {import('../ports/types.js').FuturewatchSnapshot}
 */
export function buildSnapshot({ results, carried = null, now = new Date() }) {
  const errors = [];
  const sourceHealth = [];
  const merged = {};
  let stories = [];

  for (const [name, res] of Object.entries(results)) {
    errors.push(...(res.errors ?? []));
    sourceHealth.push({
      source: name,
      ok: (res.errors ?? []).length === 0,
      fetchMs: res.fetchMs ?? null,
      indicatorCount: Object.keys(res.indicators ?? {}).length,
    });
    Object.assign(merged, res.indicators ?? {});
    if (Array.isArray(res.stories)) stories = stories.concat(res.stories);
  }

  // Last-known readings for automated inputs that produced nothing this run
  // (domain/carry-forward.js). Never overrides a fresh reading.
  if (carried) {
    errors.push(...carried.errors);
    for (const [slug, reading] of Object.entries(carried.indicators)) {
      if (!merged[slug]) merged[slug] = reading;
    }
  }

  // Normalize every scoreable indicator
  for (const [slug, reading] of Object.entries(merged)) {
    const fn = NORMALIZERS[slug];
    if (fn) reading.value = fn(reading.raw);
  }

  const pillars = {};
  for (const name of Object.keys(PILLAR_DEFS)) {
    pillars[name] = scorePillar(name, merged);
  }
  const composite = scoreComposite(pillars);

  // Trajectory metadata (D3: displayed, not blended)
  const series = merged.metrTimeHorizon?.raw?.frontierSeries ?? [];
  const trajectory = {
    frontierSeries: series,
    metrDoublingDaysSince2023: doublingTimeDays(series, '2023-01-01'),
    metrDoublingDaysAll: doublingTimeDays(series),
  };

  const leapRaw = merged.friLeapAgi?.raw;
  const expectation = {
    superforecasterAgi: leapRaw?.superforecasterMedianYear ?? null,
    expertAgi: leapRaw?.expertMedianYear ?? null,
    label: 'Forecasting Research Institute — LEAP panel (experts & superforecasters) — a forecast, not a measurement',
    source: merged.friLeapAgi?.source ?? null,
  };

  // Freshness per input, then a roll-up. Kept apart from sourceHealth on
  // purpose: that only records whether a fetch succeeded, which is how 8 of
  // 9 scored inputs went months out of date while the panel read "100% healthy".
  const freshnessBySlug = Object.fromEntries(
    Object.entries(merged).map(([slug, r]) => [
      slug,
      assessFreshness({ slug, asOf: r.asOf, reviewBy: r.reviewBy, now }),
    ])
  );
  const freshness = summarizeFreshness(
    Object.entries(freshnessBySlug).map(([slug, f]) => ({ slug, scored: SCORED_SLUGS.has(slug), freshness: f }))
  );

  const safetyRaw = merged.fliSafetyIndex?.raw;
  const safety = safetyRaw
    ? {
        score: normalizeSafetyGrade(safetyRaw.existentialGrade),
        existentialGrade: safetyRaw.existentialGrade,
        overallBestGpa: safetyRaw.overallBestGpa ?? null,
        bestLab: safetyRaw.bestLab ?? null,
        source: merged.fliSafetyIndex.source,
      }
    : { score: null };

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    composite,
    pillars,
    expectation,
    safety,
    trajectory,
    stories,
    sourceHealth,
    freshness,
    indicators: Object.fromEntries(
      Object.entries(merged).map(([slug, r]) => [
        slug,
        {
          value: r.value, raw: r.raw, asOf: r.asOf, source: r.source, confidence: r.confidence,
          freshness: freshnessBySlug[slug],
          ...(r.carriedForward ? { carriedForward: true } : {}),
        },
      ])
    ),
    errors,
  };
}
