/**
 * Epoch AI benchmark-data extractors — pure functions over parsed CSV rows
 * (see domain/csv.js). No I/O: the adapter unzips and parses, this decides
 * what the numbers mean.
 *
 * Source: epoch.ai/data/benchmark_data.zip (CC-BY 4.0, refreshed daily).
 * Every extractor returns `{ ..., errors: string[] }` and refuses (value
 * null) rather than guessing when its inputs fail a guard. That matters here
 * because a silently-shrunk basket or a re-anchored ECI would shift the
 * published composite with no visible cause.
 */

export const DAY_MS = 86400000;

// ── ECI anchors ──────────────────────────────────────────────────────────────
// Epoch pins its index so GPT-5 = 150 and GPT-4 (Mar 2023) = 125.89. The
// FutureWatch calibration (anchors.js normalizeEciCapability) is defined
// against those two points; if Epoch ever re-anchors, the mapping would be
// silently wrong, so the extractor verifies them and refuses on drift.
export const ECI_ANCHOR_CHECKS = [
  { name: 'GPT-5', eci: 150.0 },
  { name: 'GPT-4 (Mar 2023)', eci: 125.89 },
];
const ECI_ANCHOR_TOLERANCE = 0.5;

// ── Basket B-2026.1 ──────────────────────────────────────────────────────────
// Each member: file, the score column, and how many rows we expect at least
// (a table that has collapsed to a handful of rows is a feed problem).
export const BASKET_ID = 'B-2026.1';
export const BASKET_MEMBERS = [
  { key: 'gpqa', label: 'GPQA Diamond', file: 'gpqa_diamond.csv', scoreCols: ['mean_score', 'Best score (across scorers)'], minRows: 20 },
  { key: 'swe', label: 'SWE-bench Verified', file: 'swe_bench_verified.csv', scoreCols: ['mean_score', 'Best score (across scorers)'], minRows: 20 },
  { key: 'fm', label: 'FrontierMath Tiers 1–3 (v2)', file: 'frontiermath_tiers_1_3_v2.csv', scoreCols: ['mean_score', 'Best score (across scorers)'], minRows: 20 },
  { key: 'hle', label: "Humanity's Last Exam", file: 'hle_external.csv', scoreCols: ['Accuracy'], minRows: 20 },
];
// A basket member at or above this has saturated (ratchet rule: rotate it
// out, don't let the basket silently become uninformative).
export const BASKET_SATURATION = 0.9;

const num = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

const isoDate = (v) => {
  const m = String(v ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** "claude-opus-5-5_max" → "claude-opus-5-5 (max)"; unknown effort dropped. */
export function prettifyModelVersion(version) {
  const v = String(version ?? '').trim();
  const m = v.match(/^(.*)_([A-Za-z0-9-]+)$/);
  if (!m) return v;
  return m[2] === 'unknown' ? m[1] : `${m[1]} (${m[2]})`;
}

export function displayNameOf(row) {
  const name = row.Name || row['Display name'] || row.display_name;
  return name && name.trim() ? name.trim() : prettifyModelVersion(row['Model version'] ?? row.Model);
}

/**
 * Highest-scoring dated row. Rows without a numeric score or a release date
 * are skipped (an undated result can't be placed on the timeline). Ties go to
 * the earlier release.
 * @returns {{row, score:number, date:string, n:number}|null}
 */
export function frontierRow(rows, { scoreCols, dateCol = 'Release date', scale = 1 }) {
  let best = null;
  let n = 0;
  for (const row of rows) {
    let s = null;
    for (const col of scoreCols) {
      s = num(row[col]);
      if (s !== null) break;
    }
    const date = isoDate(row[dateCol]);
    if (s === null || !date) continue;
    n++;
    const score = s * scale;
    if (!best || score > best.score || (score === best.score && date < best.date)) {
      best = { row, score, date };
    }
  }
  return best ? { ...best, n } : null;
}

/**
 * Record-setting series: each model that beat every earlier-released model,
 * in release order. Gives the "frontier over time" a card can show a
 * previous value from.
 */
export function recordSeries(rows, { scoreCols, dateCol = 'Release date', scale = 1, nameOf = displayNameOf }) {
  const dated = [];
  for (const row of rows) {
    let s = null;
    for (const col of scoreCols) {
      s = num(row[col]);
      if (s !== null) break;
    }
    const date = isoDate(row[dateCol]);
    if (s === null || !date) continue;
    dated.push({ row, score: s * scale, date });
  }
  dated.sort((a, b) => a.date.localeCompare(b.date) || b.score - a.score);
  const out = [];
  let best = -Infinity;
  for (const d of dated) {
    if (d.score > best) {
      best = d.score;
      out.push({ date: d.date, score: d.score, model: nameOf(d.row), row: d.row });
    }
  }
  return out;
}

/**
 * Epoch Capabilities Index: the top model, with an anchor-drift guard.
 * @param {Array<Object>} eciRows parsed eci_scores.csv
 * @returns {{eci:number|null, model:string|null, date:string|null, ciLow:number|null, ciHigh:number|null,
 *            dataThrough:string|null, n:number, errors:string[]}}
 */
export function extractEci(eciRows) {
  const errors = [];
  const rows = eciRows
    .map((r) => ({ r, eci: num(r.eci), date: isoDate(r.date), name: (r['Display name'] || r.Model || '').trim() }))
    .filter((x) => x.eci !== null && x.date);

  const empty = { eci: null, model: null, date: null, ciLow: null, ciHigh: null, dataThrough: null, n: rows.length, errors };
  if (rows.length < 50) {
    errors.push(`epoch: eci_scores.csv has only ${rows.length} usable rows (expected ≥50)`);
    return empty;
  }

  for (const anchor of ECI_ANCHOR_CHECKS) {
    const hit = rows.find((x) => x.name === anchor.name);
    if (!hit) {
      errors.push(`epoch: ECI anchor model "${anchor.name}" not found — calibration cannot be verified`);
    } else if (Math.abs(hit.eci - anchor.eci) > ECI_ANCHOR_TOLERANCE) {
      errors.push(`epoch: ECI re-anchored? "${anchor.name}" is ${hit.eci}, expected ${anchor.eci} — calibration invalid`);
    }
  }
  if (errors.length > 0) return empty;

  const top = rows.reduce((b, x) => (x.eci > b.eci || (x.eci === b.eci && x.date < b.date) ? x : b));
  const dataThrough = rows.reduce((d, x) => (x.date > d ? x.date : d), '0000-00-00');
  return {
    eci: top.eci,
    model: top.name,
    date: top.date,
    ciLow: num(top.r.eci_ci_low),
    ciHigh: num(top.r.eci_ci_high),
    dataThrough,
    n: rows.length,
    errors,
  };
}

/**
 * Frontier basket B-2026.1: the best score on each member benchmark. All
 * members must resolve — a partial basket is a different indicator, so it is
 * refused (the pipeline then carries the previous reading forward).
 * @param {Object<string, Array<Object>>} tables parsed CSV rows keyed by file name
 * @returns {{fractions:number[]|null, members:object[], errors:string[]}}
 */
export function extractBasket(tables, { displayNames = new Map() } = {}) {
  const errors = [];
  const members = [];
  for (const def of BASKET_MEMBERS) {
    const rows = tables[def.file];
    if (!rows) {
      errors.push(`epoch: ${def.file} missing from archive`);
      continue;
    }
    const front = frontierRow(rows, { scoreCols: def.scoreCols });
    if (!front || front.n < def.minRows) {
      errors.push(`epoch: ${def.label} has ${front?.n ?? 0} scored rows (expected ≥${def.minRows})`);
      continue;
    }
    if (front.score < 0 || front.score > 1) {
      errors.push(`epoch: ${def.label} frontier score ${front.score} is outside [0,1]`);
      continue;
    }
    members.push({
      key: def.key,
      label: def.label,
      score: front.score,
      model: modelLabel(front.row, displayNames),
      date: front.date,
      rows: front.n,
      saturated: front.score >= BASKET_SATURATION,
    });
  }
  if (members.length !== BASKET_MEMBERS.length) return { fractions: null, members, errors };
  return { fractions: members.map((m) => m.score), members, errors };
}

/**
 * model_metadata.csv → Map(model_version → display_name). Blank names (about
 * half the file) are left out so callers fall back to prettifyModelVersion.
 */
export function buildDisplayNames(metaRows) {
  const out = new Map();
  for (const r of metaRows) {
    if (r.model_version && r.display_name && r.display_name.trim()) out.set(r.model_version, r.display_name.trim());
  }
  return out;
}

// METR rows without an effort setting are labelled "(unknown thinking)" or
// "(no thinking)" in Epoch's metadata — noise for a headline model name.
const cleanModelName = (n) => n.replace(/\s*\((?:unknown|no) thinking\)\s*$/i, '').trim();

/** Row label: its own Name column, else the metadata display name, else prettified id. */
export function modelLabel(row, displayNames = new Map()) {
  if (row.Name && row.Name.trim()) return row.Name.trim();
  const v = String(row['Model version'] ?? '').trim();
  const base = v.replace(/_[A-Za-z0-9-]+$/, '');
  const meta = displayNames.get(v) ?? displayNames.get(base);
  return meta ? cleanModelName(meta) : prettifyModelVersion(v);
}

function metrAlias(version, displayNames) {
  const v = String(version ?? '').trim();
  const base = v.replace(/_[A-Za-z0-9-]+$/, '');
  return cleanModelName(displayNames.get(v) ?? displayNames.get(base) ?? prettifyModelVersion(v));
}

/**
 * METR time horizons as mirrored by Epoch (metr_time_horizons_external.csv).
 * Returns one entry per model, preferring the METR-Horizon-v1.1 row when a
 * model appears under several suite versions or effort settings, then the
 * higher p50. `Time horizon` and `Time Horizon (80%)` are minutes.
 * @returns {Array<{alias:string, p50Minutes:number, p80Minutes:number|null, ciLow:number|null, ciHigh:number|null,
 *                  releaseDate:string, suite:string}>}
 */
export function extractMetrHorizons(rows, { displayNames = new Map() } = {}) {
  const byModel = new Map();
  for (const r of rows) {
    const p50 = num(r['Time horizon']);
    const date = isoDate(r['Release date']);
    if (p50 === null || p50 <= 0 || !date) continue;
    const alias = metrAlias(r['Model version'], displayNames);
    const entry = {
      alias,
      p50Minutes: p50,
      p80Minutes: num(r['Time Horizon (80%)']),
      ciLow: num(r.CI_low),
      ciHigh: num(r.CI_high),
      releaseDate: date,
      suite: r['METR version'] || 'unknown',
    };
    const prev = byModel.get(alias);
    const better =
      !prev ||
      (entry.suite.includes('v1.1') && !prev.suite.includes('v1.1')) ||
      (entry.suite.includes('v1.1') === prev.suite.includes('v1.1') && entry.p50Minutes > prev.p50Minutes);
    if (better) byModel.set(alias, entry);
  }
  return [...byModel.values()];
}

/**
 * Capability observation sources inside the Epoch archive. Each describes
 * how a benchmark maps to a Four Capabilities Watch metric; `kind` says
 * which card field it feeds.
 */
export const CAPABILITY_SOURCES = [
  {
    file: 'vending_bench_2_external.csv',
    capability: 'resource_acquisition',
    metric: 'vending_bench_2_balance',
    scoreCols: ['Score'],
    scale: 1,
    unit: 'USD_simulated',
    environment: 'simulation',
    sourceName: 'Vending-Bench 2 (Andon Labs, via Epoch AI)',
    sourceUrl: 'https://andonlabs.com/evals/vending-bench-2',
    notes: 'Simulated bank balance in a ~1-year (365-day) simulated vending business starting from $500 — not real income. The agent never left the simulation.',
    extra: { subcapability: 'economic_accumulation', startingBalance: 500, simulationDurationDays: 365 },
  },
  {
    file: 'posttrainbench_external.csv',
    capability: 'ai_improvement',
    metric: 'posttrainbench_average',
    scoreCols: ['Average (%)'],
    scale: 100,
    unit: 'percent',
    environment: 'controlled_lab',
    sourceName: 'PostTrainBench (via Epoch AI)',
    sourceUrl: 'https://epoch.ai/benchmarks/post-train-bench',
    notes: 'Agents (e.g. Claude Code, Codex CLI) autonomously post-train a small open base model within 10 hours on one H100; the score is the average benchmark performance of the model they produce (the best agents still trail official instruction-tuned models). One controlled improvement cycle on a small model — the result is not deployed and no further cycle is run on it, so this is not recursive self-improvement.',
    extra: { improvedAnotherModel: true, wasDeployed: false, improvementCycleFollowed: false },
  },
  {
    file: 'os_world_external.csv',
    capability: 'operational_autonomy',
    metric: 'computer_use_success',
    scoreCols: ['Score'],
    scale: 1, // already percent
    unit: 'percent',
    environment: 'sandbox',
    sourceName: 'OSWorld (via Epoch AI)',
    sourceUrl: 'https://os-world.github.io/',
    notes: 'Success rate on OSWorld desktop computer-use tasks in a virtual-machine sandbox.',
    extra: {},
  },
  {
    file: 'terminalbench_external.csv',
    capability: 'operational_autonomy',
    metric: 'terminal_task_success',
    scoreCols: ['Accuracy mean'],
    scale: 100,
    unit: 'percent',
    environment: 'sandbox',
    sourceName: 'Terminal-Bench 2.0 (via Epoch AI)',
    sourceUrl: 'https://www.tbench.ai/leaderboard/terminal-bench/2.0',
    notes: 'Best agent+model result on Terminal-Bench 2.0 terminal tasks. Agent scaffolds differ across entries.',
    extra: {},
  },
];
