/**
 * History backfill — pure; no I/O.
 *
 * Reconstructs what the composite WOULD have read on a past date under the
 * current methodology, using only results that existed by then, so the trend
 * line across the 2026-10 re-baseline (decision D7) is continuous instead of
 * a cliff. The reconstruction mirrors the live adapters: same extractors,
 * same normalizers (via buildSnapshot), with each table cut off at the date.
 *
 * What "existed by then" means: a model's release date. Benchmark rows are
 * dated by the model's release, not by when its score was published, so the
 * reconstruction can be slightly generous for models whose results arrived
 * weeks after release. Hand-scored inputs (self-learning, real-time,
 * agentic autonomy, economy) are held at their current values — none were
 * re-scored since the site launched. Every reconstructed point is labelled
 * `backfilled: true` in history.json and drawn differently on the site.
 */
import { extractEci, extractBasket, extractMetrHorizons, DAY_MS } from './epoch-extract.js';
import { extractArc2, extractArc3, HUMAN_PANEL_ID } from './arc-extract.js';
import { frontierSeries } from './metr-fit.js';
import { buildSnapshot } from './snapshot-builder.js';

const dateOf = (v) => String(v ?? '').slice(0, 10);
const onOrBefore = (v, asOf) => {
  const d = dateOf(v);
  return d !== '' && d <= asOf;
};

/** Every ISO date from `from` to `to` inclusive. */
export function dateRange(from, to) {
  const out = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Cut each Epoch table to rows released on or before asOf (undated rows can't be placed, so they drop). */
function epochTablesAsOf(tables, asOf) {
  const out = {};
  for (const [name, rows] of Object.entries(tables)) {
    if (name === 'model_metadata.csv') out[name] = rows;
    else if (name.endsWith('eci_scores.csv')) out[name] = rows.filter((r) => onOrBefore(r.date, asOf));
    else out[name] = rows.filter((r) => onOrBefore(r['Release date'], asOf));
  }
  return out;
}

/**
 * Automated indicators as they would have read on `asOf`. An indicator that
 * could not be reconstructed (too little data that early) is simply absent,
 * and the returned `missing` list says which.
 * @param {{asOf:string, tables:Object, arcEvaluations:Array, arcModels:Array, arcV3:Object, displayNames?:Map}} src
 */
export function reconstructAutomated({ asOf, tables, arcEvaluations, arcModels, arcV3, displayNames = new Map() }) {
  const indicators = {};
  const missing = [];
  const cut = epochTablesAsOf(tables, asOf);

  const eci = cut['epoch_capabilities_index/eci_scores.csv'] ? extractEci(cut['epoch_capabilities_index/eci_scores.csv']) : null;
  if (eci?.eci != null) {
    indicators.eciCapability = { raw: { eci: eci.eci, model: eci.model, modelDate: eci.date }, asOf: eci.dataThrough };
  } else missing.push('eciCapability');

  const basket = extractBasket(cut, { displayNames });
  if (basket.fractions) {
    indicators.epochBenchmarks = { raw: { basket: 'B-2026.1', fractions: basket.fractions }, asOf };
  } else missing.push('epochBenchmarks');

  const released = new Map(arcModels.map((m) => [m.id, dateOf(m.modelReleaseDate)]));
  const arc2 = extractArc2(
    arcEvaluations.filter((e) => e.modelId === HUMAN_PANEL_ID || onOrBefore(released.get(e.modelId), asOf))
  );
  const arc3 = extractArc3({
    generatedAt: asOf,
    evaluations: (arcV3?.evaluations ?? []).filter((e) => onOrBefore(e.modelReleaseDate, asOf)),
  });
  if (arc2.generation && arc3.generation) {
    indicators.arcGap = { raw: { generations: [arc2.generation, arc3.generation] }, asOf };
  } else missing.push('arcGap');

  const horizons = extractMetrHorizons(cut['metr_time_horizons_external.csv'] ?? [], { displayNames })
    .filter((h) => onOrBefore(h.releaseDate, asOf));
  const series = frontierSeries(horizons);
  if (series.length > 0) {
    const f = series[series.length - 1];
    indicators.metrTimeHorizon = { raw: { p50Minutes: f.value, frontierModel: f.alias, frontierSeries: series }, asOf: f.date };
  } else missing.push('metrTimeHorizon');

  return { indicators, missing };
}

/**
 * One history point for `asOf`: automated indicators reconstructed as of the
 * date, plus the hand-scored ones held at their current values.
 * @param {{manualIndicators: Object}} src manual-adapter indicators, as the live pipeline reads them
 */
export function reconstructPoint({ asOf, manualIndicators, ...src }) {
  const { indicators, missing } = reconstructAutomated({ asOf, ...src });
  const manual = {};
  for (const [slug, r] of Object.entries(manualIndicators)) manual[slug] = { ...r, value: null };
  const snapshot = buildSnapshot({
    results: { backfill: { indicators: { ...manual, ...indicators }, errors: [] } },
    now: new Date(`${asOf}T12:00:00Z`),
  });
  return {
    date: asOf,
    composite: snapshot.composite.value,
    pillars: Object.fromEntries(Object.entries(snapshot.pillars).map(([k, p]) => [k, p.score])),
    coverage: snapshot.composite.coverage,
    ...(missing.length > 0 ? { missing } : {}),
    backfilled: true,
  };
}
