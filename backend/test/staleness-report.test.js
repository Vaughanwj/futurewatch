import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overdueCount, renderStalenessReport } from '../src/domain/staleness-report.js';

const freshness = {
  scored: { total: 9, fresh: 4, due: 1, stale: 4, unknown: 0 },
  overdue: [
    { slug: 'hendrycksAgiScore', scored: true, status: 'stale', daysOverdue: 164, asOf: '2025-10-21', reviewBy: '2026-04-21' },
    { slug: 'friLeapAgi', scored: false, status: 'stale', daysOverdue: 52, asOf: '2026-05-11', reviewBy: '2026-08-11' },
    { slug: 'anthropicEconIndex', scored: true, status: 'due', daysOverdue: 6, asOf: '2026-06-26', reviewBy: '2026-09-26' },
  ],
};

test('overdueCount counts every due or stale input, scored or not', () => {
  assert.equal(overdueCount(freshness), 3);
  assert.equal(overdueCount({ scored: {}, overdue: [] }), 0);
  assert.equal(overdueCount(undefined), 0);
});

test('report lists each overdue input with its dates and says how many scored inputs are affected', () => {
  const md = renderStalenessReport(freshness, '2026-10-02T21:00:00Z');
  assert.ok(md.includes('3 inputs past their review date'));
  assert.ok(md.includes('2 of 9 scored inputs'));
  assert.ok(md.includes('| `hendrycksAgiScore` | yes | stale | 2025-10-21 | 2026-04-21 | 164 |'));
  assert.ok(md.includes('| `friLeapAgi` | no | stale |'));
  assert.ok(md.includes('as of 2026-10-02'));
});

test('report tells the reader not to move reviewBy without re-checking the source', () => {
  assert.ok(renderStalenessReport(freshness, '2026-10-02').includes("don't move `reviewBy` without actually"));
});

test('singular wording for a single overdue input', () => {
  const md = renderStalenessReport({ scored: { total: 9 }, overdue: [freshness.overdue[0]] }, '2026-10-02');
  assert.ok(md.includes('1 input past their review date'));
});
