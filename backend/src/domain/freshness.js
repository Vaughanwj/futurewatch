/**
 * Input freshness — pure; no I/O.
 *
 * Why this exists: "sources healthy" only says an HTTP fetch succeeded. For
 * months 8 of the 9 scored inputs were hand-entered values with no signal
 * that they were aging, so the published number sat at 46.5 while the field
 * moved on. Every input now carries a `reviewBy` date and a derived status,
 * so staleness is visible on the page and can trip an alert.
 *
 * Manual entries set `reviewBy` explicitly in futurewatch-manual.json (from
 * their documented review cadence). Automated feeds have no human-set date,
 * so their freshness is the age of the newest data point against a max age.
 */

const DAY_MS = 86_400_000;

// An input this many days (or fewer) past its review date is "due"; beyond
// it, "stale". Due = someone should look soon; stale = the number on the
// page can no longer be trusted to reflect the current state of the field.
export const DUE_GRACE_DAYS = 30;

// Max age of the newest data point for automated feeds, keyed by indicator.
export const AUTOMATED_MAX_AGE_DAYS = { metrTimeHorizon: 120 };
export const DEFAULT_MAX_AGE_DAYS = 365;

function parseDay(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

export function addDays(iso, days) {
  const t = parseDay(iso);
  if (t === null) return null;
  return new Date(t + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @param {{slug?:string, asOf?:string|null, reviewBy?:string|null, now:Date}} input
 * @returns {{status:'fresh'|'due'|'stale'|'unknown', asOf:string|null, reviewBy:string|null, daysOverdue:number|null}}
 *   daysOverdue is days past reviewBy (<= 0 means still within it).
 */
export function assessFreshness({ slug, asOf = null, reviewBy = null, now }) {
  const by = reviewBy ?? (asOf ? addDays(asOf, AUTOMATED_MAX_AGE_DAYS[slug] ?? DEFAULT_MAX_AGE_DAYS) : null);
  const byMs = parseDay(by);
  if (byMs === null) return { status: 'unknown', asOf, reviewBy: null, daysOverdue: null };

  const daysOverdue = Math.floor((now.getTime() - byMs) / DAY_MS);
  const status = daysOverdue <= 0 ? 'fresh' : daysOverdue <= DUE_GRACE_DAYS ? 'due' : 'stale';
  return { status, asOf, reviewBy: by, daysOverdue };
}

/**
 * @param {Array<{slug:string, scored:boolean, freshness:ReturnType<typeof assessFreshness>}>} entries
 * @returns {{scored:{total:number,fresh:number,due:number,stale:number,unknown:number}, overdue:Array}}
 *   `scored` counts only inputs feeding the composite (what the headline number rests on);
 *   `overdue` lists every due/stale input, scored or not, worst first.
 */
export function summarizeFreshness(entries) {
  const scored = { total: 0, fresh: 0, due: 0, stale: 0, unknown: 0 };
  for (const e of entries) {
    if (!e.scored) continue;
    scored.total += 1;
    scored[e.freshness.status] += 1;
  }
  const overdue = entries
    .filter((e) => e.freshness.status === 'due' || e.freshness.status === 'stale')
    .map((e) => ({
      slug: e.slug,
      scored: e.scored,
      status: e.freshness.status,
      daysOverdue: e.freshness.daysOverdue,
      asOf: e.freshness.asOf,
      reviewBy: e.freshness.reviewBy,
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { scored, overdue };
}
