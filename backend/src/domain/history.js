/**
 * history.json maintenance — pure; no I/O.
 *
 * One point per date. Re-running the pipeline on the same day replaces that
 * day's point (before this, a second run appended a duplicate). Backfilled
 * points (domain/backfill.js) are merged in idempotently, and the value that
 * was actually published for that date is kept alongside as `published`, so
 * the rewrite of history is never silent.
 */

const byDate = (a, b) => a.date.localeCompare(b.date);

/** Insert or replace the point for point.date. Returns a new history object. */
export function upsertPoint(history, point) {
  const points = (history?.points ?? []).filter((p) => p.date !== point.date);
  points.push(point);
  return { ...history, schemaVersion: history?.schemaVersion ?? 1, points: points.sort(byDate) };
}

/**
 * Merge reconstructed points into history. For each date:
 *   - no existing point        → add the backfilled point
 *   - existing live point      → replace it, preserving its numbers as `published`
 *   - existing backfilled point→ replace it (idempotent re-run), keeping any `published` it carried
 * Points on or after `before` (the re-baseline date) are never touched: from
 * then on history is live data.
 * @param {{points: Array}} history
 * @param {Array} backfillPoints
 * @param {string} before ISO date, exclusive
 */
export function applyBackfill(history, backfillPoints, before) {
  const existing = new Map((history?.points ?? []).map((p) => [p.date, p]));
  for (const bp of backfillPoints) {
    if (bp.date >= before) continue;
    const old = existing.get(bp.date);
    const published = old?.backfilled
      ? old.published
      : old
        ? { composite: old.composite, pillars: old.pillars }
        : undefined;
    existing.set(bp.date, { ...bp, ...(published ? { published } : {}) });
  }
  return { ...history, schemaVersion: history?.schemaVersion ?? 1, points: [...existing.values()].sort(byDate) };
}
