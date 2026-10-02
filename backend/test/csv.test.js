import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/domain/csv.js';

test('parses header + rows into objects', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n3,4\n'), [{ a: '1', b: '2' }, { a: '3', b: '4' }]);
});

test('quoted cells keep embedded commas, newlines and escaped quotes (Epoch compute notes look like this)', () => {
  const text = 'id,notes,score\nx,"line one,\nline ""two""",0.5\ny,plain,0.7\n';
  const rows = parseCsv(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].notes, 'line one,\nline "two"');
  assert.equal(rows[0].score, '0.5');
  assert.equal(rows[1].id, 'y');
});

test('handles CRLF, a BOM, a missing trailing newline and short rows', () => {
  const rows = parseCsv('﻿a,b\r\n1,2\r\n3');
  assert.deepEqual(rows, [{ a: '1', b: '2' }, { a: '3', b: '' }]);
});

test('empty input and blank lines yield no rows', () => {
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv('a,b\n\n\n'), []);
});
