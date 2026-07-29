/**
 * GitHub release monitoring — pending. Watching official repos
 * (METR/eval-analysis-public, METR/RE-Bench, etc.) for tagged releases via
 * the GitHub API is straightforward, but this static daily-pipeline has no
 * persisted "last seen release" cursor to build against yet, and adding one
 * means deciding where that state lives (this repo has no database — see
 * research/capabilities-methodology.md known limitations). Port defined so
 * the pipeline can wire it in once that's settled.
 */
import { makePendingAdapter } from './pending-adapter.js';

export const githubReleaseAdapter = makePendingAdapter(
  'github-releases',
  'Release-cursor persistence not yet designed for this static, database-less pipeline.'
);
