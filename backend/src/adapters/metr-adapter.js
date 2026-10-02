/**
 * METR adapter — fetches runs.jsonl + release_dates.yaml from
 * METR/eval-analysis-public and computes the frontier 50% time horizon.
 * Primary source verified 2026-07-20 (see research/framework-survey.md).
 *
 * Returns raw values; normalization happens in domain (anchors.js).
 *
 * fetchMetrSource() is the shared fetch+fit step — both this adapter (the
 * road-chart/scored metrTimeHorizon indicator) and metr-capabilities-adapter
 * (the Four Capabilities Watch operational_autonomy observations) need the
 * same underlying model fits and must not issue duplicate network requests
 * for the same two files.
 */
import axios from 'axios';
import { fitP50Horizon, frontierSeries, mergeModels } from '../domain/metr-fit.js';
import { getEpochArchive } from './epoch-source.js';
import { extractMetrHorizons, buildDisplayNames } from '../domain/epoch-extract.js';

// METR's own caveat: the task suite is thin above ~16 hours, so estimates
// past it are low-confidence (both CI and the choice of scoring treatment
// move them a lot). Surfaced on the indicator, not used to clip it.
export const METR_SUITE_CEILING_MINUTES = 16 * 60;

const BASE = 'https://raw.githubusercontent.com/METR/eval-analysis-public/main';
// TH1.1 is the primary suite; TH1.0 supplements with legacy models (GPT-2,
// GPT-3 era) that TH1.1 never re-ran — METR's own "hybrid trend" approach.
const PRIMARY_URL = `${BASE}/reports/time-horizon-1-1/data/raw/runs.jsonl`;
const LEGACY_URL = `${BASE}/reports/time-horizon-1-0/data/raw/runs.jsonl`;
const DATES_URL = `${BASE}/data/external/release_dates.yaml`;

const canonicalAlias = (alias) => alias.replace(/\s*\(Inspect\)\s*$/, '').trim();

/**
 * Flat "  Name: YYYY-MM-DD" entries under a single "date:" key — a full YAML
 * parser is not warranted for this shape.
 *
 * Keys are canonicalized the same way run aliases are (the "(Inspect)"
 * suffix stripped). METR lists older models twice (plain and "(Inspect)",
 * same date) but newer ones — e.g. Claude Opus 4.6 — only with the suffix;
 * matching on the raw key silently left those models undated, which dropped
 * them from the frontier series. First entry wins on duplicates.
 */
export function parseReleaseDates(yamlText) {
  const out = {};
  for (const line of yamlText.split('\n')) {
    const m = line.match(/^\s{2}(.+?):\s*(\d{4}-\d{2}-\d{2})\s*$/);
    if (!m) continue;
    const key = canonicalAlias(m[1]);
    if (!(key in out)) out[key] = m[2];
  }
  return out;
}

// METR's runs files include the human baseline under this alias — it's the
// yardstick the tasks were timed against, not a model.
const HUMAN_BASELINE_ALIAS = 'human';

function parseRuns(jsonlText) {
  const byModel = new Map();
  for (const line of jsonlText.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue; // tolerate malformed lines; count is checked below
    }
    const alias = row.alias ? canonicalAlias(String(row.alias)) : null;
    if (!alias) continue;
    if (!byModel.has(alias)) byModel.set(alias, []);
    byModel.get(alias).push({
      humanMinutes: Number(row.human_minutes),
      success: Number(row.score_binarized),
      weight: Number(row.invsqrt_task_weight),
    });
  }
  return byModel;
}

export function fitModels(byModel, releaseDates, suite) {
  const models = [];
  for (const [alias, runs] of byModel) {
    if (alias === HUMAN_BASELINE_ALIAS) continue;
    const { p50Minutes, a, b, n } = fitP50Horizon(runs);
    if (p50Minutes !== null) {
      models.push({ alias, p50Minutes, a, b, n, suite, releaseDate: releaseDates[alias] ?? null });
    }
  }
  return models;
}

/**
 * Models that produced a valid fit but have no release date can't be placed
 * on the frontier timeline, and frontierSeries() filters them out without a
 * word. That is how a 12-hour model once vanished unnoticed, so callers
 * surface this list as an error instead of letting it pass quietly.
 */
export function findUndatedModels(models) {
  return models.filter((m) => !m.releaseDate).map((m) => m.alias);
}

async function defaultGetText(url) {
  const { data } = await axios.get(url, { timeout: 60000, responseType: 'text' });
  return data;
}

/**
 * METR's published horizons as mirrored in Epoch's benchmark archive: one
 * fetch, METR's own p50/p80/CI numbers (not our refit), and it picks up new
 * models long before METR's GitHub runs files do (those last gained a model
 * on 2026-03-06; the mirror runs through 2026-04-07).
 * @returns {Promise<{horizons: object[], errors: string[]}>}
 */
export async function defaultGetHorizons() {
  const { tables, errors } = await getEpochArchive();
  const rows = tables['metr_time_horizons_external.csv'];
  if (!rows) return { horizons: [], errors: errors.length ? errors : ['metr: horizons table missing from Epoch archive'] };
  const displayNames = buildDisplayNames(tables['model_metadata.csv'] ?? []);
  return { horizons: extractMetrHorizons(rows, { displayNames }), errors };
}

/**
 * Source preference: the Epoch mirror of METR's published horizons; if that
 * is unreachable, METR's GitHub runs refit locally (older, but independent).
 *
 * @param {{getText?: (url: string) => Promise<string>,
 *          getHorizons?: () => Promise<{horizons: object[], errors: string[]}>}} [deps]
 *   injectable fetchers so tests can run against fixtures with no network.
 * @returns {Promise<{models: object[], series: object[], suite: string, errors: string[]}>}
 * models retain `a`/`b` (the fitted logistic coefficients) so callers can
 * derive horizons at success rates other than 50% without refetching or
 * refitting.
 */
export async function fetchMetrSource({ getText = defaultGetText, getHorizons = defaultGetHorizons } = {}) {
  const errors = [];

  let mirror = { horizons: [], errors: [] };
  try {
    mirror = await getHorizons();
  } catch (err) {
    mirror = { horizons: [], errors: [`metr: Epoch mirror failed: ${err.message}`] };
  }
  if (mirror.horizons.length > 0) {
    const models = mirror.horizons.map((h) => ({ ...h, a: null, b: null, n: null }));
    return { models, series: frontierSeries(models), suite: 'METR Time Horizon (via Epoch AI)', errors: [] };
  }
  if (mirror.errors.length > 0) {
    errors.push(...mirror.errors, 'metr: falling back to METR GitHub runs (stale: newest model there is from early 2026)');
  }

  async function fetchText(url, label) {
    try {
      return await getText(url);
    } catch (err) {
      errors.push(`metr ${label}: ${err.message}`);
      return null;
    }
  }

  const [primaryText, legacyText, datesText] = [
    await fetchText(PRIMARY_URL, 'runs TH1.1'),
    await fetchText(LEGACY_URL, 'runs TH1.0'),
    await fetchText(DATES_URL, 'release_dates'),
  ];

  const releaseDates = datesText ? parseReleaseDates(datesText) : {};

  if (!primaryText && !legacyText) {
    return { models: [], series: [], suite: null, errors };
  }

  const primaryModels = primaryText ? fitModels(parseRuns(primaryText), releaseDates, 'TH1.1') : [];
  const legacyModels = legacyText ? fitModels(parseRuns(legacyText), releaseDates, 'TH1.0') : [];
  // Primary wins collisions; legacy contributes only the models TH1.1
  // dropped — restoring the 2019–2022 stretch of the road chart.
  const models = mergeModels(primaryModels, legacyModels);
  const suite = primaryText
    ? legacyText ? 'TH1.1 + TH1.0 legacy' : 'TH1.1'
    : 'TH1.0';

  // If the dates file itself failed to load that's already reported above and
  // every model would be "undated" — only flag the case where dates loaded
  // but a fitted model still has none (a genuine join gap).
  if (datesText) {
    const undated = findUndatedModels(models);
    if (undated.length > 0) {
      errors.push(
        `metr: ${undated.length} fitted model(s) have no release date and are excluded from the frontier series: ${undated.join(', ')}`
      );
    }
  }

  const series = frontierSeries(models);
  return { models, series, suite, errors };
}

export const metrAdapter = {
  async fetch() {
    const t0 = Date.now();
    const { series, models, suite, errors } = await fetchMetrSource();
    const frontier = series.length > 0 ? series[series.length - 1] : null;
    const frontierModelRow = frontier ? models.find((m) => m.alias === frontier.alias) : null;

    if (!frontier) {
      if (models.length === 0 && errors.length === 0) errors.push('metr: no frontier model produced a valid p50 fit');
      return { indicators: {}, fetchMs: Date.now() - t0, errors };
    }

    return {
      indicators: {
        metrTimeHorizon: {
          value: null, // normalized by domain
          raw: {
            p50Minutes: frontier.value,
            frontierModel: frontier.alias,
            p80Minutes: frontierModelRow?.p80Minutes ?? null,
            ciLowMinutes: frontierModelRow?.ciLow ?? null,
            ciHighMinutes: frontierModelRow?.ciHigh ?? null,
            aboveSuiteCeiling: frontier.value > METR_SUITE_CEILING_MINUTES,
            suite,
            modelCount: models.length,
            frontierSeries: series,
          },
          asOf: frontier.date,
          source: 'METR time horizons (metr.org; github.com/METR/eval-analysis-public), mirrored by Epoch AI (CC-BY 4.0)',
          confidence: 'verified',
        },
      },
      fetchMs: Date.now() - t0,
      errors,
    };
  },
};
