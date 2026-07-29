/**
 * Vending-Bench 2 / Andon Labs — live scraping pending. Verified during
 * this implementation that andonlabs.com/evals/vending-bench-2 is a
 * client-side-rendered SvelteKit app: the leaderboard table (model, balance)
 * does not appear anywhere in the server-rendered HTML, only in a rendered
 * DOM after JS execution. No public JSON/CSV export was found. A reliable
 * scraper would need a headless-browser dependency (e.g. Playwright) this
 * project doesn't currently carry, plus the explicit-selector/fixture/
 * change-detection scaffolding the brief calls for — worth building once,
 * not as a rushed addition here.
 *
 * Current result (verified by rendering the page directly, 2026-07):
 * Claude Opus 5 leads at $11,181.87 (avg of 5 runs, $500 start, 365-day
 * simulation). Seeded into capabilities-manual.json as a manual observation
 * with quarterly-recheck instructions until this live adapter exists.
 */
import { makePendingAdapter } from './pending-adapter.js';

export const vendingBenchLiveAdapter = makePendingAdapter(
  'vendingbench-live',
  'Leaderboard is client-rendered with no public export; no headless-browser dependency in this project yet. Seeded manually in capabilities-manual.json instead.'
);
