/**
 * Epoch AI — pending. No verified machine-readable API or downloadable
 * dataset was confirmed for Epoch's benchmark pages (PostTrainBench,
 * Vending-Bench 2 mirror, Remote Labor Index, OSWorld, Terminal-Bench)
 * during this implementation; epoch.ai rendered as a client-side app when
 * checked, with no documented public API endpoint found. This repo already
 * carries the same caveat for the scored epochBenchmarks indicator (see
 * backend/data/futurewatch-manual.json). Revisit if Epoch publishes a
 * documented API or downloadable dataset.
 */
import { makePendingAdapter } from './pending-adapter.js';

export const epochCapabilitiesAdapter = makePendingAdapter(
  'epoch-capabilities',
  'No verified machine-readable API or downloadable dataset for Epoch AI benchmark pages as of this implementation.'
);
