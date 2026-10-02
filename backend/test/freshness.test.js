import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessFreshness, summarizeFreshness, addDays, DUE_GRACE_DAYS } from '../src/domain/freshness.js';
import { buildSnapshot } from '../src/domain/snapshot-builder.js';

const NOW = new Date('2026-10-02T12:00:00Z');

// ── domain ───────────────────────────────────────────────────────────────

test('on or before reviewBy is fresh (inclusive of the reviewBy day itself)', () => {
  assert.equal(assessFreshness({ asOf: '2026-07-01', reviewBy: '2026-10-03', now: NOW }).status, 'fresh');
  assert.equal(assessFreshness({ asOf: '2026-07-01', reviewBy: '2026-10-02', now: NOW }).status, 'fresh');
});

test('1-30 days past reviewBy is due; more than that is stale', () => {
  assert.equal(assessFreshness({ reviewBy: '2026-10-01', now: NOW }).status, 'due');
  assert.equal(assessFreshness({ reviewBy: '2026-09-02', now: NOW }).status, 'due');
  assert.equal(assessFreshness({ reviewBy: '2026-09-01', now: NOW }).status, 'stale');
  assert.equal(DUE_GRACE_DAYS, 30);
});

test('daysOverdue is reported (and is <= 0 while still within reviewBy)', () => {
  assert.equal(assessFreshness({ reviewBy: '2026-09-26', now: NOW }).daysOverdue, 6);
  assert.ok(assessFreshness({ reviewBy: '2026-10-20', now: NOW }).daysOverdue <= 0);
});

test('automated feeds with no reviewBy age out from asOf (METR: 120 days)', () => {
  const f = assessFreshness({ slug: 'metrTimeHorizon', asOf: '2026-02-05', now: NOW });
  assert.equal(f.reviewBy, addDays('2026-02-05', 120));
  assert.equal(f.status, 'stale');
  assert.equal(assessFreshness({ slug: 'metrTimeHorizon', asOf: '2026-09-20', now: NOW }).status, 'fresh');
});

test('no usable dates at all is "unknown", never silently "fresh"', () => {
  assert.equal(assessFreshness({ now: NOW }).status, 'unknown');
  assert.equal(assessFreshness({ asOf: 'garbage', reviewBy: 'also garbage', now: NOW }).status, 'unknown');
});

test('an explicit reviewBy beats the derived age-based one', () => {
  const f = assessFreshness({ slug: 'metrTimeHorizon', asOf: '2020-01-01', reviewBy: '2026-12-01', now: NOW });
  assert.equal(f.status, 'fresh');
});

test('summarizeFreshness counts only scored inputs in the headline and lists every overdue one, worst first', () => {
  const mk = (slug, scored, reviewBy) => ({ slug, scored, freshness: assessFreshness({ reviewBy, asOf: '2026-01-01', now: NOW }) });
  const s = summarizeFreshness([
    mk('a', true, '2026-04-21'), // stale, 164 d
    mk('b', true, '2026-09-26'), // due, 6 d
    mk('c', true, '2026-12-01'), // fresh
    mk('d', false, '2026-08-11'), // stale, 52 d, but NOT scored
  ]);
  assert.deepEqual(s.scored, { total: 3, fresh: 1, due: 1, stale: 1, unknown: 0 });
  assert.deepEqual(s.overdue.map((o) => o.slug), ['a', 'd', 'b']);
  assert.equal(s.overdue.find((o) => o.slug === 'd').scored, false);
});

// ── through the snapshot builder (controlled inputs) ─────────────────────

function results() {
  const ind = (asOf, reviewBy, raw) => ({ value: null, raw, asOf, reviewBy, source: 'stub', confidence: 'provisional' });
  return {
    manual: {
      indicators: {
        eciCapability: ind('2025-10-21', '2026-04-21', { publishedPct: 58 }),            // stale
        anthropicEconIndex: ind('2026-06-26', '2026-09-26', { breadth: 0.36, depth: 0.22 }), // due
        aiIndexEconomy: ind('2026-04-15', '2027-04-15', { adoption01: 0.55, postings01: 0.3 }), // fresh
        friLeapAgi: ind('2026-05-11', '2026-08-11', { superforecasterMedianYear: 2047, expertMedianYear: 2050 }), // stale, unscored
      },
      fetchMs: 1, errors: [],
    },
    metr: {
      indicators: {
        metrTimeHorizon: { value: null, raw: { p50Minutes: 719, frontierSeries: [] }, asOf: '2026-02-05', source: 'stub', confidence: 'verified' },
      },
      fetchMs: 1, errors: [],
    },
  };
}

test('snapshot attaches freshness to every indicator', () => {
  const snap = buildSnapshot({ results: results(), now: NOW });
  assert.equal(snap.indicators.eciCapability.freshness.status, 'stale');
  assert.equal(snap.indicators.anthropicEconIndex.freshness.status, 'due');
  assert.equal(snap.indicators.aiIndexEconomy.freshness.status, 'fresh');
  assert.equal(snap.indicators.metrTimeHorizon.freshness.status, 'stale', 'automated feed ages out from its newest data point');
});

test('snapshot freshness roll-up: scored counts exclude the unscored LEAP input but the overdue list includes it', () => {
  const snap = buildSnapshot({ results: results(), now: NOW });
  assert.deepEqual(snap.freshness.scored, { total: 4, fresh: 1, due: 1, stale: 2, unknown: 0 });
  const slugs = snap.freshness.overdue.map((o) => o.slug);
  assert.ok(slugs.includes('friLeapAgi'));
  assert.equal(snap.freshness.overdue.find((o) => o.slug === 'friLeapAgi').scored, false);
});

test('CRITICAL: sourceHealth stays "ok" while data is stale — the two signals are independent', () => {
  const snap = buildSnapshot({ results: results(), now: NOW });
  assert.ok(snap.sourceHealth.every((s) => s.ok), 'fetches all succeeded');
  assert.ok(snap.freshness.scored.stale > 0, 'yet staleness is still reported');
});
