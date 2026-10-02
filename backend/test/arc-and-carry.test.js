import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractArc2, extractArc3, HUMAN_PANEL_ID } from '../src/domain/arc-extract.js';
import { createArcAdapter, ARC_EVALUATIONS_URL, ARC_V3_URL } from '../src/adapters/arc-adapter.js';
import { normalizeArcGap } from '../src/domain/anchors.js';
import { carryForward } from '../src/domain/carry-forward.js';
import { createPipeline } from '../src/app.js';

// ── fixtures in arcprize.org's real shapes ───────────────────────────────

const v2 = (modelId, score, extra = {}) => ({ datasetId: 'v2_Semi_Private', modelId, score, costPerTask: 1, resultsUrl: '', display: true, ...extra });
const EVALS = [
  v2(HUMAN_PANEL_ID, 1),
  v2('m-a', 0.4), v2('m-b', 0.95), v2('m-c', 0.2), v2('m-d', 0.1), v2('m-e', 0.05),
  { datasetId: 'v2_Public_Eval', modelId: 'm-public', score: 0.99, display: true }, // wrong set: must be ignored
  v2('hidden', 0.999, { display: false }),
];

const v3 = (modelId, score, extra = {}) => ({
  datasetId: 'v3_Semi_Private', modelId, modelDisplayName: modelId.toUpperCase(), score, display: true, ...extra,
});
const V3 = {
  generatedAt: '2026-09-30T13:12:37.194Z',
  evaluations: [
    v3('opus-max', 0.627), v3('gpt-high', 0.4), v3('g-1', 0.1), v3('g-2', 0.05), v3('g-3', 0.01),
    v3('gpt-astra-high-provider-adapter', 0.999), v3('gpt-astra-max-provider-adapter', 0.98),
  ],
};

const getJsonFrom = (map) => async (url) => {
  if (!(url in map)) throw new Error(`unexpected url ${url}`);
  const v = map[url];
  if (v instanceof Error) throw v;
  return v;
};

// ── extractors ───────────────────────────────────────────────────────────

test('ARC-AGI-2: held-out Semi-Private set only, best model ÷ human panel', () => {
  const { generation, errors } = extractArc2(EVALS);
  assert.deepEqual(errors, []);
  assert.equal(generation.frontierScore, 0.95);
  assert.equal(generation.model, 'm-b');
  assert.equal(generation.frontierOverHuman, 0.95);
});

test('ARC-AGI-2 refuses without a human baseline', () => {
  const { generation, errors } = extractArc2(EVALS.filter((e) => e.modelId !== HUMAN_PANEL_ID));
  assert.equal(generation, null);
  assert.ok(errors.some((e) => e.includes('human panel')));
});

test('D6: ARC-AGI-3 scores the Standard harness; Provider Adapter result is carried for display only', () => {
  const { generation } = extractArc3(V3);
  assert.equal(generation.frontierScore, 0.627);
  assert.equal(generation.frontierOverHuman, 0.627);
  assert.equal(generation.harness, 'standard');
  assert.equal(generation.providerAdapter.score, 0.999);
});

test('ARC-AGI-3 refuses when too few Standard-harness results exist (adapter rows must not stand in)', () => {
  const onlyAdapter = { generatedAt: V3.generatedAt, evaluations: V3.evaluations.filter((e) => /provider-adapter/.test(e.modelId)) };
  assert.equal(extractArc3(onlyAdapter).generation, null);
});

// ── adapter + scoring ────────────────────────────────────────────────────

test('arc adapter: ARC-AGI-2 retires under the ratchet, so arcGap equals the ARC-AGI-3 Standard ratio', async () => {
  const res = await createArcAdapter({
    getJson: getJsonFrom({ [ARC_EVALUATIONS_URL]: EVALS, [ARC_V3_URL]: V3 }),
  }).fetch();
  assert.deepEqual(res.errors, []);
  const ind = res.indicators.arcGap;
  assert.equal(ind.asOf, '2026-09-30');
  assert.equal(ind.raw.generations.length, 2);
  assert.ok(Math.abs(normalizeArcGap(ind.raw.generations) - 62.7) < 1e-9);
});

test('arc adapter withholds the indicator if either generation is missing (a one-generation mean would move for no real reason)', async () => {
  const res = await createArcAdapter({
    getJson: getJsonFrom({ [ARC_EVALUATIONS_URL]: EVALS, [ARC_V3_URL]: new Error('503') }),
  }).fetch();
  assert.deepEqual(res.indicators, {});
  assert.ok(res.errors.some((e) => e.includes('503')));
});

// ── carry-forward ────────────────────────────────────────────────────────

const PREV = {
  indicators: {
    eciCapability: { value: 78.6, raw: { eci: 167.35 }, asOf: '2026-09-22', source: 's', confidence: 'verified' },
    arcGap: { value: 62.7, raw: { generations: [] }, asOf: '2026-09-30', source: 's', confidence: 'verified' },
    hendrycksAgiScore: { value: 57, raw: { publishedPct: 57 }, asOf: '2025-10-21', source: 'old' },
  },
};

test('carryForward re-uses the previous raw reading with its ORIGINAL asOf, only for listed automated slugs', () => {
  const { indicators, errors } = carryForward({ arcGap: { raw: {} } }, PREV);
  assert.deepEqual(Object.keys(indicators), ['eciCapability']); // arcGap present; hendrycks is retired and never carried
  assert.equal(indicators.eciCapability.asOf, '2026-09-22');
  assert.equal(indicators.eciCapability.value, null, 're-normalized later from raw');
  assert.equal(indicators.eciCapability.carriedForward, true);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('carried forward'));
});

test('carryForward is a no-op with no previous snapshot', () => {
  assert.deepEqual(carryForward({}, null), { indicators: {}, errors: [] });
});

test('PIPELINE: a failed automated feed does not renormalize the composite — the previous reading is carried and flagged', async () => {
  const good = {
    async fetch() {
      return { indicators: { eciCapability: { value: null, raw: { eci: 167.35 }, asOf: '2026-09-22', source: 's', confidence: 'verified' } }, fetchMs: 1, errors: [] };
    },
  };
  const down = { async fetch() { return { indicators: {}, fetchMs: 1, errors: ['epoch: download failed: 503'] }; } };
  const now = () => new Date('2026-10-03T00:00:00Z');

  const first = await createPipeline({ adapters: { epoch: good }, now }).run(null);
  const second = await createPipeline({ adapters: { epoch: down }, now }).run(first);

  assert.equal(second.indicators.eciCapability.carriedForward, true);
  assert.equal(second.indicators.eciCapability.value, first.indicators.eciCapability.value);
  assert.equal(second.composite.value, first.composite.value);
  assert.ok(second.errors.some((e) => e.includes('carried forward')));
  assert.equal(second.sourceHealth[0].ok, false);
});
