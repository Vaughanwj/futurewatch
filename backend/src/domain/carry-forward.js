/**
 * Carry-forward — pure; no I/O.
 *
 * Composite scoring renormalizes over whichever indicators are present, so an
 * automated feed that fails for a day would not just leave a gap: it would
 * silently reweight the composite toward the remaining inputs. Instead, when
 * an automated indicator is missing this run, the last published reading is
 * re-used with its ORIGINAL asOf (so the freshness model ages it honestly)
 * and an error line says so. Only listed slugs are carried — never retired
 * inputs or manual entries removed on purpose.
 */

export const CARRY_FORWARD_SLUGS = ['metrTimeHorizon', 'eciCapability', 'epochBenchmarks', 'arcGap'];

/**
 * @param {Object<string, object>} present indicators produced this run, by slug
 * @param {object|null} previousSnapshot last published futurewatch.json
 * @returns {{indicators: Object<string, object>, errors: string[]}}
 */
export function carryForward(present, previousSnapshot, slugs = CARRY_FORWARD_SLUGS) {
  const indicators = {};
  const errors = [];
  for (const slug of slugs) {
    if (present[slug]) continue;
    const prev = previousSnapshot?.indicators?.[slug];
    if (!prev || prev.raw === undefined || prev.raw === null) continue;
    indicators[slug] = {
      value: null, // re-normalized from raw by the builder
      raw: prev.raw,
      asOf: prev.asOf,
      source: prev.source,
      confidence: prev.confidence,
      carriedForward: true,
    };
    errors.push(`${slug}: no reading this run — carried forward the previous one (as of ${prev.asOf ?? 'unknown'})`);
  }
  return { indicators, errors };
}
