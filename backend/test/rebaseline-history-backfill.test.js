import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRebaseline } from '../src/domain/rebaseline.js';
import { upsertPoint, applyBackfill } from '../src/domain/history.js';
import { dateRange, reconstructPoint, reconstructAutomated } from '../src/domain/backfill.js';
import { createPipeline } from '../src/app.js';
import { parseCsv } from '../src/domain/csv.js';
import { buildDisplayNames } from '../src/domain/epoch-extract.js';
import { buildArchiveFiles } from './epoch-fixtures.js';

const DECL = [{ id: 'r1', date: '2026-10-02', windowDays: 14, title: 'Inputs refreshed', note: 'because' }];
const FLAGGED = { flagged: true, previous: 48, current: 57, note: 'x' };

// ── rebaseline ───────────────────────────────────────────────────────────

test('a declared re-baseline absorbs an escalated move inside its window, once', () => {
  const r = resolveRebaseline({ declared: DECL, previous: { rebaselines: [] }, escalation: FLAGGED, generatedAt: '2026-10-03T17:00:00Z' });
  assert.equal(r.escalation.flagged, false);
  assert.equal(r.escalation.rebaselined, 'r1');
  assert.deepEqual(r.rebaselines.map((x) => [x.id, x.from, x.to, x.date]), [['r1', 48, 57, '2026-10-03']]);

  // next day, another big jump: the id is already recorded, so the gate fires again
  const again = resolveRebaseline({ declared: DECL, previous: { rebaselines: r.rebaselines }, escalation: FLAGGED, generatedAt: '2026-10-04T17:00:00Z' });
  assert.equal(again.escalation.flagged, true);
  assert.equal(again.rebaselines.length, 1);
});

test('an expired or not-yet-active declaration cannot absorb a jump', () => {
  const late = resolveRebaseline({ declared: DECL, previous: null, escalation: FLAGGED, generatedAt: '2026-11-20T17:00:00Z' });
  assert.equal(late.escalation.flagged, true);
  const early = resolveRebaseline({ declared: DECL, previous: null, escalation: FLAGGED, generatedAt: '2026-09-30T17:00:00Z' });
  assert.equal(early.escalation.flagged, true);
});

test('an unflagged run does not consume the declaration, and earlier rebaselines persist', () => {
  const prev = { rebaselines: [{ id: 'old' }] };
  const r = resolveRebaseline({ declared: DECL, previous: prev, escalation: { flagged: false }, generatedAt: '2026-10-03T00:00:00Z' });
  assert.deepEqual(r.escalation, { flagged: false });
  assert.deepEqual(r.rebaselines, [{ id: 'old' }]);
});

test('PIPELINE: declared re-baseline is accepted once and recorded; an undeclared jump still escalates', async () => {
  const adapter = {
    async fetch() {
      return {
        indicators: { agenticAutonomyLevel: { value: null, raw: { routineLevel: 'agent', nextDemonstrated: true }, asOf: '2026-10-03', source: 's', confidence: 'judgment' } },
        fetchMs: 1, errors: [],
      };
    },
  };
  const now = () => new Date('2026-10-03T12:00:00Z');
  const previous = { composite: { value: 10 } };

  const declared = await createPipeline({ adapters: { a: adapter }, now, rebaselines: DECL }).run(previous);
  assert.equal(declared.escalation.flagged, false);
  assert.equal(declared.rebaselines[0].id, 'r1');

  const undeclared = await createPipeline({ adapters: { a: adapter }, now }).run(previous);
  assert.equal(undeclared.escalation.flagged, true);
  assert.deepEqual(undeclared.rebaselines, []);

  const next = await createPipeline({ adapters: { a: adapter }, now, rebaselines: DECL })
    .run({ composite: { value: 10 }, rebaselines: declared.rebaselines });
  assert.equal(next.escalation.flagged, true, 'single use');
});

// ── history ──────────────────────────────────────────────────────────────

test('upsertPoint replaces the same-day point instead of appending a duplicate, and sorts', () => {
  let h = { schemaVersion: 1, points: [{ date: '2026-07-30', composite: 1 }, { date: '2026-07-29', composite: 2 }] };
  h = upsertPoint(h, { date: '2026-07-30', composite: 3 });
  assert.deepEqual(h.points.map((p) => [p.date, p.composite]), [['2026-07-29', 2], ['2026-07-30', 3]]);
});

test('applyBackfill keeps the published values, is idempotent, and never touches the re-baseline date or later', () => {
  const history = {
    schemaVersion: 1,
    points: [
      { date: '2026-07-29', composite: 46.5, pillars: { capability: 34.6 } },
      { date: '2026-10-02', composite: 57, pillars: {} },
    ],
  };
  const bf = [
    { date: '2026-07-28', composite: 52, pillars: {}, backfilled: true },
    { date: '2026-07-29', composite: 53.3, pillars: { capability: 44.7 }, backfilled: true },
    { date: '2026-10-02', composite: 99, pillars: {}, backfilled: true },
  ];
  const once = applyBackfill(history, bf, '2026-10-02');
  assert.deepEqual(once.points.map((p) => p.date), ['2026-07-28', '2026-07-29', '2026-10-02']);
  const p29 = once.points[1];
  assert.equal(p29.composite, 53.3);
  assert.equal(p29.backfilled, true);
  assert.deepEqual(p29.published, { composite: 46.5, pillars: { capability: 34.6 } });
  assert.equal(once.points[0].published, undefined);
  assert.equal(once.points[2].composite, 57, 'live point on/after the cut is untouched');

  const twice = applyBackfill(once, bf, '2026-10-02');
  assert.deepEqual(twice, once);
});

// ── backfill reconstruction ──────────────────────────────────────────────

test('dateRange is inclusive of both ends', () => {
  assert.deepEqual(dateRange('2026-07-30', '2026-08-01'), ['2026-07-30', '2026-07-31', '2026-08-01']);
});

const files = buildArchiveFiles();
const tables = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, parseCsv(v)]));
const displayNames = buildDisplayNames(tables['model_metadata.csv']);
const arcIds = ['a', 'b', 'c', 'd', 'e', 'f'];
const arcEvaluations = [
  { datasetId: 'v2_Semi_Private', modelId: '2025_human_panel', score: 1, display: true },
  ...arcIds.map((m, i) => ({ datasetId: 'v2_Semi_Private', modelId: m, score: 0.1 * (i + 1), display: true })),
];
const arcModels = arcIds.map((id, i) => ({ id, modelReleaseDate: `2026-0${i + 1}-01T00:00:00.000Z` }));
const arcV3 = {
  evaluations: ['p', 'q', 'r', 's', 't', 'u'].map((id, i) => ({
    datasetId: 'v3_Semi_Private', modelId: id, modelReleaseDate: `2026-0${i + 1}-15T00:00:00.000Z`, score: 0.05 * (i + 1), display: true,
  })),
};

test('reconstruction uses only rows released on or before the date (no look-ahead)', () => {
  const early = reconstructAutomated({ asOf: '2026-05-20', tables, arcEvaluations, arcModels, arcV3 });
  const late = reconstructAutomated({ asOf: '2026-12-31', tables, arcEvaluations, arcModels, arcV3, displayNames });
  // fixture scores rise with release date, so a later date can only see a higher or equal frontier
  assert.ok(early.indicators.epochBenchmarks.raw.fractions[0] <= late.indicators.epochBenchmarks.raw.fractions[0]);
  assert.ok(early.indicators.metrTimeHorizon.raw.p50Minutes <= late.indicators.metrTimeHorizon.raw.p50Minutes);
  assert.equal(late.indicators.metrTimeHorizon.raw.frontierModel, 'Model B (Early)');
  assert.equal(late.indicators.arcGap.raw.generations[0].model, 'f');
  assert.equal(early.indicators.arcGap.raw.generations[0].model, 'e', 'models a–e are released by May 20');
});

test('an indicator with too little early data is reported missing, not guessed', () => {
  const r = reconstructAutomated({ asOf: '2019-01-01', tables, arcEvaluations, arcModels, arcV3 });
  assert.ok(r.missing.includes('eciCapability'));
  assert.ok(r.missing.includes('arcGap'));
});

test('reconstructPoint yields a labelled composite from reconstructed + held manual inputs', () => {
  const manualIndicators = { selfLearning: { raw: { gainRatio: 0.06 }, asOf: '2026-06-05', source: 's', confidence: 'judgment' } };
  const p = reconstructPoint({ asOf: '2026-12-31', manualIndicators, tables, arcEvaluations, arcModels, arcV3 });
  assert.equal(p.backfilled, true);
  assert.equal(p.date, '2026-12-31');
  assert.ok(Number.isFinite(p.composite));
  assert.ok(Number.isFinite(p.pillars.capability) && Number.isFinite(p.pillars.autonomy));
});
