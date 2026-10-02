import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/domain/csv.js';
import {
  extractEci, extractBasket, extractMetrHorizons, frontierRow, recordSeries,
  prettifyModelVersion, buildDisplayNames, BASKET_MEMBERS,
} from '../src/domain/epoch-extract.js';
import { fetchEpochArchive, createCachedEpochFetcher } from '../src/adapters/epoch-source.js';
import { createEpochAdapter, EPOCH_MAX_DATA_AGE_DAYS } from '../src/adapters/epoch-adapter.js';
import { createEpochCapabilitiesAdapter } from '../src/adapters/capabilities/epoch-capabilities-adapter.js';
import { normalizeObservation } from '../src/domain/capabilities/observation.js';
import { buildCapabilityCards } from '../src/domain/capabilities/card-service.js';
import { fetchMetrSource } from '../src/adapters/metr-adapter.js';
import {
  buildArchiveFiles, buildArchiveZip, toCsv, scoreRows, eciRows, ECI_COLS,
} from './epoch-fixtures.js';

const NOW = new Date('2026-10-02T12:00:00Z');
const tablesFrom = (files) => Object.fromEntries(Object.entries(files).filter(([, v]) => v !== null).map(([k, v]) => [k, parseCsv(v)]));
const archiveOf = (overrides) => async () => ({ tables: tablesFrom(buildArchiveFiles(overrides)), errors: [] });

// ── frontier / record helpers ────────────────────────────────────────────

test('frontierRow skips unscored and undated rows, breaks ties toward the earlier release', () => {
  const rows = [
    { s: '0.9', d: '' },            // undated: can't be placed on a timeline
    { s: '', d: '2026-01-01' },     // unscored
    { s: '0.8', d: '2026-03-01' },
    { s: '0.8', d: '2026-02-01' },
    { s: '0.5', d: '2026-04-01' },
  ].map((r) => ({ 'Model version': 'x', score: r.s, 'Release date': r.d }));
  const f = frontierRow(rows, { scoreCols: ['score'] });
  assert.equal(f.score, 0.8);
  assert.equal(f.date, '2026-02-01');
  assert.equal(f.n, 3);
});

test('recordSeries keeps only models that beat everything released before them', () => {
  const rows = [
    ['a', '0.4', '2026-01-01'], ['b', '0.3', '2026-02-01'], ['c', '0.6', '2026-03-01'], ['d', '0.6', '2026-04-01'], ['e', '0.9', '2026-05-01'],
  ].map(([m, s, d]) => ({ 'Model version': m, score: s, 'Release date': d }));
  assert.deepEqual(recordSeries(rows, { scoreCols: ['score'] }).map((r) => r.model), ['a', 'c', 'e']);
});

test('prettifyModelVersion turns effort suffixes into readable labels', () => {
  assert.equal(prettifyModelVersion('claude-opus-5-5_max'), 'claude-opus-5-5 (max)');
  assert.equal(prettifyModelVersion('gpt-5.5_unknown'), 'gpt-5.5');
  assert.equal(prettifyModelVersion('gemini-3-pro-preview'), 'gemini-3-pro-preview');
});

// ── ECI ──────────────────────────────────────────────────────────────────

test('extractEci returns the top model and the data-through date', () => {
  const r = extractEci(eciRows());
  assert.equal(r.eci, 167.35);
  assert.equal(r.model, 'Top Model');
  assert.equal(r.dataThrough, '2026-09-22');
  assert.equal(r.ciLow, 164);
  assert.deepEqual(r.errors, []);
});

test('REGRESSION GUARD: extractEci refuses when Epoch re-anchors the index (calibration would be silently wrong)', () => {
  const r = extractEci(eciRows({ gpt5: 100 }));
  assert.equal(r.eci, null);
  assert.ok(r.errors.some((e) => e.includes('re-anchored') && e.includes('GPT-5')), r.errors.join('|'));
});

test('extractEci refuses when an anchor model disappears from the table', () => {
  const rows = eciRows().filter((r) => r['Display name'] !== 'GPT-4 (Mar 2023)');
  const r = extractEci(rows);
  assert.equal(r.eci, null);
  assert.ok(r.errors.some((e) => e.includes('not found')));
});

test('extractEci refuses a collapsed table', () => {
  const r = extractEci(eciRows({ n: 5 }).slice(0, 8));
  assert.equal(r.eci, null);
  assert.ok(r.errors[0].includes('usable rows'));
});

// ── basket ───────────────────────────────────────────────────────────────

test('extractBasket returns one frontier fraction per member, in basket order', () => {
  const b = extractBasket(tablesFrom(buildArchiveFiles()));
  assert.deepEqual(b.errors, []);
  assert.equal(b.members.length, BASKET_MEMBERS.length);
  assert.deepEqual(b.members.map((m) => m.key), ['gpqa', 'swe', 'fm', 'hle']);
  assert.ok(Math.abs(b.fractions[0] - 0.95) < 1e-9);
  assert.ok(Math.abs(b.fractions[3] - 0.55) < 1e-9);
  assert.equal(b.members[0].saturated, true);  // 0.95 ≥ 0.9
  assert.equal(b.members[1].saturated, false);
});

test('a partial basket is refused, never averaged over fewer members', () => {
  const t = tablesFrom(buildArchiveFiles({ 'hle_external.csv': null }));
  const b = extractBasket(t);
  assert.equal(b.fractions, null);
  assert.ok(b.errors.some((e) => e.includes('hle_external.csv')));
});

test('a member table that has collapsed to a few rows is refused', () => {
  const t = tablesFrom(buildArchiveFiles({ 'gpqa_diamond.csv': toCsv(['Model version', 'mean_score', 'Release date'], scoreRows(4, 0.9)) }));
  const b = extractBasket(t);
  assert.equal(b.fractions, null);
  assert.ok(b.errors.some((e) => e.includes('GPQA Diamond') && e.includes('expected ≥20')));
});

// ── METR horizons (mirror) ───────────────────────────────────────────────

test('extractMetrHorizons: one row per model, v1.1 preferred over variants, undated rows dropped, names cleaned', () => {
  const rows = parseCsv(buildArchiveFiles()['metr_time_horizons_external.csv']);
  const names = buildDisplayNames(parseCsv(buildArchiveFiles()['model_metadata.csv']));
  const h = extractMetrHorizons(rows, { displayNames: names });
  const byAlias = Object.fromEntries(h.map((x) => [x.alias, x]));
  assert.ok(!('undated' in byAlias), 'undated rows cannot join the timeline');
  assert.equal(byAlias['Model A'].p50Minutes, 300, 'the v1.1 row wins over the higher-scoring unversioned variant');
  assert.equal(byAlias['Model A'].p80Minutes, 60);
  assert.equal(byAlias['Model B (Early)'].p50Minutes, 1044.78);
  assert.equal(byAlias['Model B (Early)'].ciHigh, 3304);
  assert.ok('gpt2-xl' in byAlias);
});

test('fetchMetrSource prefers the Epoch mirror and exposes p80 / CI', async () => {
  const rows = parseCsv(buildArchiveFiles()['metr_time_horizons_external.csv']);
  const horizons = extractMetrHorizons(rows);
  const r = await fetchMetrSource({
    getHorizons: async () => ({ horizons, errors: [] }),
    getText: async () => { throw new Error('GitHub must not be consulted when the mirror works'); },
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.series.at(-1).value, 1044.78);
  assert.equal(r.series[0].date, '2019-11-05');
  assert.equal(r.models.find((m) => m.alias === 'm-b').p80Minutes, 185.9);
});

test('fetchMetrSource falls back to GitHub when the mirror is down, and says so', async () => {
  const r = await fetchMetrSource({
    getHorizons: async () => ({ horizons: [], errors: ['epoch: download failed: boom'] }),
    getText: async () => { throw new Error('offline'); },
  });
  assert.ok(r.errors.some((e) => e.includes('download failed')));
  assert.ok(r.errors.some((e) => e.includes('falling back to METR GitHub')));
});

// ── archive fetch (real ZIP, no network) ─────────────────────────────────

test('fetchEpochArchive unzips only the wanted CSVs and parses them', async () => {
  const bytes = buildArchiveZip();
  const { tables, errors } = await fetchEpochArchive({ getBuffer: async () => bytes });
  assert.deepEqual(errors, []);
  assert.ok(tables['gpqa_diamond.csv'].length === 30);
  assert.ok(tables['epoch_capabilities_index/eci_scores.csv']);
  assert.ok(!('README.md' in tables));
});

test('fetchEpochArchive reports a failed download and a corrupt archive rather than throwing', async () => {
  const down = await fetchEpochArchive({ getBuffer: async () => { throw new Error('503'); } });
  assert.deepEqual(down.tables, {});
  assert.ok(down.errors[0].includes('download failed'));
  const bad = await fetchEpochArchive({ getBuffer: async () => new Uint8Array([1, 2, 3, 4, 5]) });
  assert.ok(bad.errors[0].includes('not a readable ZIP'));
});

test('createCachedEpochFetcher downloads once per process', async () => {
  let calls = 0;
  const get = createCachedEpochFetcher(async () => { calls++; return { tables: {}, errors: [] }; });
  await get(); await get(); await get();
  assert.equal(calls, 1);
});

// ── scored adapter ───────────────────────────────────────────────────────

test('epoch adapter produces eciCapability and epochBenchmarks with data-through dates', async () => {
  const res = await createEpochAdapter({ fetchArchive: archiveOf(), now: () => NOW }).fetch();
  assert.deepEqual(res.errors, []);
  assert.equal(res.indicators.eciCapability.raw.eci, 167.35);
  assert.equal(res.indicators.eciCapability.asOf, '2026-09-22');
  assert.equal(res.indicators.epochBenchmarks.raw.basket, 'B-2026.1');
  assert.equal(res.indicators.epochBenchmarks.raw.fractions.length, 4);
  assert.deepEqual(res.indicators.epochBenchmarks.raw.saturated, ['GPQA Diamond']);
});

test('a download failure yields no indicators and an error (the pipeline then carries forward)', async () => {
  const res = await createEpochAdapter({
    fetchArchive: async () => ({ tables: {}, errors: ['epoch: download failed: 503'] }), now: () => NOW,
  }).fetch();
  assert.deepEqual(res.indicators, {});
  assert.deepEqual(res.errors, ['epoch: download failed: 503']);
});

test('a feed that stopped updating is refused instead of re-asserted as current', async () => {
  const stale = toCsv(ECI_COLS, eciRows().map((r) => ({ ...r, date: '2025-03-01' })));
  const res = await createEpochAdapter({
    fetchArchive: archiveOf({ 'epoch_capabilities_index/eci_scores.csv': stale }), now: () => NOW,
  }).fetch();
  assert.equal(res.indicators.eciCapability, undefined);
  assert.ok(res.errors.some((e) => e.includes('may have stopped updating')));
  assert.ok(EPOCH_MAX_DATA_AGE_DAYS > 0);
});

// ── capabilities adapter ─────────────────────────────────────────────────

test('capabilities adapter emits the last record-setters per metric and every candidate normalizes', async () => {
  const res = await createEpochCapabilitiesAdapter({ fetchArchive: archiveOf() }).fetch();
  assert.deepEqual(res.errors, []);
  const metrics = [...new Set(res.candidates.map((c) => c.metric))].sort();
  assert.deepEqual(metrics, ['computer_use_success', 'posttrainbench_average', 'terminal_task_success', 'vending_bench_2_balance']);
  assert.equal(res.candidates.filter((c) => c.metric === 'vending_bench_2_balance').length, 3);

  const normalized = res.candidates.map((c) => normalizeObservation(c));
  const bad = normalized.filter((n) => !n.observation);
  assert.equal(bad.length, 0, bad.map((b) => b.errors.join(';')).join(' | '));
  assert.ok(normalized.every((n) => n.observation.reviewStatus === 'not_required'));
});

test('capabilities adapter: OSWorld skips undated agent rows; Terminal-Bench takes the best agent per record', async () => {
  const res = await createEpochCapabilitiesAdapter({ fetchArchive: archiveOf() }).fetch();
  const osw = res.candidates.filter((c) => c.metric === 'computer_use_success');
  assert.deepEqual(osw.map((c) => c.value), [50, 72.1]);
  const tb = res.candidates.filter((c) => c.metric === 'terminal_task_success');
  assert.deepEqual(tb.map((c) => c.value), [60, 84.7]);
});

test('capabilities cards fill from Epoch observations, and keep simulation / controlled-lab labelling', async () => {
  const res = await createEpochCapabilitiesAdapter({ fetchArchive: archiveOf() }).fetch();
  const obs = res.candidates.map((c) => normalizeObservation(c).observation);
  const cards = buildCapabilityCards(obs);
  assert.equal(cards.resourceAcquisition.bestSimulatedResult, 6000);
  assert.equal(cards.resourceAcquisition.realWorldResourceAcquisitionObserved, false);
  assert.equal(cards.operationalAutonomy.computerUseSuccess, 72.1);
  assert.equal(cards.operationalAutonomy.terminalTaskSuccess, 84.7);
  assert.equal(cards.aiImprovement.benchmark, 'posttrainbench_average');
  assert.equal(cards.aiImprovement.wasDeployed, false);
  assert.equal(cards.aiImprovement.recursiveLoopStatus, 'none_observed');
  assert.ok(cards.aiImprovement.previousScore !== null && cards.aiImprovement.change > 0);
});

test('unchanged source data hashes identically on re-runs (so the pipeline deduplicates)', async () => {
  const a = await createEpochCapabilitiesAdapter({ fetchArchive: archiveOf() }).fetch();
  const b = await createEpochCapabilitiesAdapter({ fetchArchive: archiveOf() }).fetch();
  assert.deepEqual(a.candidates.map((c) => c.sourceHash), b.candidates.map((c) => c.sourceHash));
});
