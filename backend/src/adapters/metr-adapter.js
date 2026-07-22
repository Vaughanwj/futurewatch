/**
 * METR adapter — fetches runs.jsonl + release_dates.yaml from
 * METR/eval-analysis-public and computes the frontier 50% time horizon.
 * Primary source verified 2026-07-20 (see research/framework-survey.md).
 *
 * Returns raw values; normalization happens in domain (anchors.js).
 */
import axios from 'axios';
import { fitP50Horizon, frontierSeries, mergeModels } from '../domain/metr-fit.js';

const BASE = 'https://raw.githubusercontent.com/METR/eval-analysis-public/main';
// TH1.1 is the primary suite; TH1.0 supplements with legacy models (GPT-2,
// GPT-3 era) that TH1.1 never re-ran — METR's own "hybrid trend" approach.
const PRIMARY_URL = `${BASE}/reports/time-horizon-1-1/data/raw/runs.jsonl`;
const LEGACY_URL = `${BASE}/reports/time-horizon-1-0/data/raw/runs.jsonl`;
const DATES_URL = `${BASE}/data/external/release_dates.yaml`;

function parseReleaseDates(yamlText) {
  // Flat "  Name: YYYY-MM-DD" entries under a single "date:" key — a full
  // YAML parser is not warranted for this shape.
  const out = {};
  for (const line of yamlText.split('\n')) {
    const m = line.match(/^\s{2}(.+?):\s*(\d{4}-\d{2}-\d{2})\s*$/);
    if (m) out[m[1].trim()] = m[2];
  }
  return out;
}

const canonicalAlias = (alias) => alias.replace(/\s*\(Inspect\)\s*$/, '').trim();

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

function fitModels(byModel, releaseDates, suite) {
  const models = [];
  for (const [alias, runs] of byModel) {
    const { p50Minutes, n } = fitP50Horizon(runs);
    if (p50Minutes !== null) {
      models.push({ alias, p50Minutes, n, suite, releaseDate: releaseDates[alias] ?? null });
    }
  }
  return models;
}

export const metrAdapter = {
  async fetch() {
    const t0 = Date.now();
    const errors = [];

    async function fetchText(url, label) {
      try {
        const { data } = await axios.get(url, { timeout: 60000, responseType: 'text' });
        return data;
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
      return { indicators: {}, fetchMs: Date.now() - t0, errors };
    }

    const primaryModels = primaryText ? fitModels(parseRuns(primaryText), releaseDates, 'TH1.1') : [];
    const legacyModels = legacyText ? fitModels(parseRuns(legacyText), releaseDates, 'TH1.0') : [];
    // Primary wins collisions; legacy contributes only the models TH1.1
    // dropped — restoring the 2019–2022 stretch of the road chart.
    const models = mergeModels(primaryModels, legacyModels);
    const suite = primaryText
      ? legacyText ? 'TH1.1 + TH1.0 legacy' : 'TH1.1'
      : 'TH1.0';

    const series = frontierSeries(models);
    const frontier = series.length > 0 ? series[series.length - 1] : null;

    if (!frontier) {
      errors.push('metr: no frontier model produced a valid p50 fit');
      return { indicators: {}, fetchMs: Date.now() - t0, errors };
    }

    return {
      indicators: {
        metrTimeHorizon: {
          value: null, // normalized by domain
          raw: {
            p50Minutes: frontier.value,
            frontierModel: frontier.alias,
            suite,
            modelCount: models.length,
            frontierSeries: series,
          },
          asOf: frontier.date,
          source: 'METR eval-analysis-public (github.com/METR/eval-analysis-public)',
          confidence: 'verified',
        },
      },
      fetchMs: Date.now() - t0,
      errors,
    };
  },
};
