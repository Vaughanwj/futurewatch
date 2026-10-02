import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReleaseDates, fetchMetrSource, findUndatedModels } from '../src/adapters/metr-adapter.js';

// The Epoch mirror is the preferred source; these tests exercise the GitHub
// refit path, so they switch the mirror off (and never touch the network).
const noMirror = async () => ({ horizons: [], errors: [] });

// ── fixtures in METR's real file shapes ──────────────────────────────────

// Mirrors the real release_dates.yaml: older models appear twice (plain and
// "(Inspect)", same date), newer ones — Claude Opus 4.6 — only with the suffix.
const DATES_YAML = [
  'date:',
  '  GPT-5.2: 2025-12-11',
  '  Claude Opus 4.5: 2025-11-24',
  '  Claude Opus 4.5 (Inspect): 2025-11-24',
  '  Claude Opus 4.6 (Inspect): 2026-02-05',
].join('\n');

function runsFor(alias, trueP50Minutes) {
  const lines = [];
  for (const m of [1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 960, 1800]) {
    const p = 1 / (1 + Math.exp(1.2 * (Math.log2(m) - Math.log2(trueP50Minutes))));
    const successes = Math.round(p * 20);
    for (let i = 0; i < 20; i++) {
      lines.push(JSON.stringify({
        alias, human_minutes: m, score_binarized: i < successes ? 1 : 0, invsqrt_task_weight: 1,
      }));
    }
  }
  return lines.join('\n');
}

function stubGetText({ runs, dates = DATES_YAML, legacy = '' }) {
  return async (url) => {
    if (url.includes('time-horizon-1-1')) return runs;
    if (url.includes('time-horizon-1-0')) return legacy;
    if (url.includes('release_dates')) {
      if (dates === null) throw new Error('boom: dates unavailable');
      return dates;
    }
    throw new Error(`unexpected url ${url}`);
  };
}

// ── release-date parsing ─────────────────────────────────────────────────

test('parseReleaseDates canonicalizes "(Inspect)" keys so they match run aliases', () => {
  const d = parseReleaseDates(DATES_YAML);
  assert.equal(d['Claude Opus 4.6'], '2026-02-05');
  assert.equal(d['Claude Opus 4.5'], '2025-11-24');
  assert.equal(d['GPT-5.2'], '2025-12-11');
  assert.equal(d['Claude Opus 4.6 (Inspect)'], undefined, 'raw suffixed key should not survive');
});

test('parseReleaseDates: first entry wins when a model is listed twice', () => {
  const d = parseReleaseDates(['date:', '  X: 2025-01-01', '  X (Inspect): 2025-02-02'].join('\n'));
  assert.equal(d.X, '2025-01-01');
});

// ── the regression ───────────────────────────────────────────────────────

test('REGRESSION: a model listed only as "(Inspect)" in release_dates reaches the frontier series', async () => {
  const runs = [
    runsFor('GPT-5.2', 350),
    runsFor('Claude Opus 4.5 (Inspect)', 290),
    runsFor('Claude Opus 4.6 (Inspect)', 720),
  ].join('\n');
  const { series, models, errors } = await fetchMetrSource({ getText: stubGetText({ runs }), getHorizons: noMirror });

  assert.deepEqual(errors, []);
  assert.ok(models.every((m) => m.releaseDate), 'every fitted model should have a date');
  assert.equal(series[series.length - 1].alias, 'Claude Opus 4.6', 'the highest-horizon model must be the frontier');
  assert.ok(series[series.length - 1].value > series.find((p) => p.alias === 'GPT-5.2').value);
});

test('a fitted model with no release date is surfaced as an error, not dropped silently', async () => {
  const runs = [runsFor('GPT-5.2', 350), runsFor('Mystery Model (Inspect)', 900)].join('\n');
  const { series, errors } = await fetchMetrSource({ getText: stubGetText({ runs }), getHorizons: noMirror });

  assert.ok(errors.some((e) => e.includes('no release date') && e.includes('Mystery Model')), `errors: ${errors}`);
  assert.ok(!series.some((p) => p.alias === 'Mystery Model'));
});

test('the human baseline rows are neither a model nor a warning', async () => {
  const runs = [runsFor('GPT-5.2', 350), runsFor('human', 100)].join('\n');
  const { models, errors } = await fetchMetrSource({ getText: stubGetText({ runs }), getHorizons: noMirror });
  assert.ok(!models.some((m) => m.alias === 'human'));
  assert.deepEqual(errors, []);
});

test('if the dates file itself fails, report that once instead of flagging every model undated', async () => {
  const runs = runsFor('GPT-5.2', 350);
  const { errors } = await fetchMetrSource({ getText: stubGetText({ runs, dates: null }), getHorizons: noMirror });
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('release_dates'));
});

test('findUndatedModels lists only models without a date', () => {
  assert.deepEqual(
    findUndatedModels([{ alias: 'a', releaseDate: '2025-01-01' }, { alias: 'b', releaseDate: null }]),
    ['b']
  );
});
