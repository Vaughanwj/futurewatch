/**
 * Snapshot builder — pure assembly of futurewatch.json from adapter results.
 * No I/O. All normalization routed through anchors.js here, so adapters stay
 * shape-only and the scoring stays testable.
 */
import {
  normalizeMetrTimeHorizon,
  normalizeAutonomyLevel,
  normalizeHendrycks,
  normalizeArcGap,
  normalizeSelfLearning,
  normalizeRealTimeEngagement,
  normalizeEpochBasket,
  normalizeEconIndex,
  normalizeAiIndexEconomy,
  normalizeSafetyGrade,
} from './anchors.js';
import { scorePillar, scoreComposite, doublingTimeDays, PILLAR_DEFS } from './scorer.js';

const NORMALIZERS = {
  metrTimeHorizon: (raw) => normalizeMetrTimeHorizon(raw?.p50Minutes),
  agenticAutonomyLevel: (raw) => normalizeAutonomyLevel(raw?.routineLevel, raw?.nextDemonstrated),
  hendrycksAgiScore: (raw) => normalizeHendrycks(raw?.publishedPct),
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
export function buildSnapshot({ results, now = new Date() }) {
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
    indicators: Object.fromEntries(
      Object.entries(merged).map(([slug, r]) => [
        slug,
        { value: r.value, raw: r.raw, asOf: r.asOf, source: r.source, confidence: r.confidence },
      ])
    ),
    errors,
  };
}
