/**
 * Prints the stale-inputs report for the latest futurewatch.json.
 *   node scripts/staleness-report.js          markdown issue body
 *   node scripts/staleness-report.js --count  just the number of overdue inputs
 * Used by the Daily Fetch workflow to open / update / close a tracking issue.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { overdueCount, renderStalenessReport } from '../src/domain/staleness-report.js';

const SNAPSHOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'futurewatch.json');
const snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'));

if (process.argv.includes('--count')) {
  console.log(overdueCount(snapshot.freshness));
} else {
  console.log(renderStalenessReport(snapshot.freshness, snapshot.generatedAt));
}
