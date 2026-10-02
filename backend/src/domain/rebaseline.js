/**
 * Declared re-baselines — pure; no I/O.
 *
 * The >5-pt escalation gate exists so a wild reading is never auto-published.
 * Sometimes a large move is deliberate: inputs were swapped from stale
 * hand-entered values to live feeds (decision D7). Rather than loosening the
 * gate or hand-editing data, such a move is DECLARED in a committed file
 * (backend/config/rebaselines.json — reviewable in git) and the pipeline
 * recognises it exactly once:
 *
 *   - the run must have flagged escalation (an unflagged run doesn't consume it),
 *   - the run date must fall inside the declaration's window
 *     [date, date + windowDays] so a stale declaration can't absorb an
 *     unrelated jump weeks later,
 *   - its id must not already be in the previous snapshot's `rebaselines`
 *     list (single use).
 *
 * The applied re-baseline is recorded on the snapshot (`rebaselines`) so the
 * site can label the discontinuity, and persists in later snapshots.
 */
import { DAY_MS } from './epoch-extract.js';

/**
 * @param {{declared?: Array<{id:string, date:string, windowDays?:number, title?:string, note:string}>,
 *          previous?: object|null, escalation: object, generatedAt: string}} input
 * @returns {{escalation: object, rebaselines: Array}}
 */
export function resolveRebaseline({ declared = [], previous = null, escalation, generatedAt }) {
  const history = previous?.rebaselines ?? [];
  if (!escalation?.flagged) return { escalation, rebaselines: history };

  const runDay = generatedAt.slice(0, 10);
  const applied = new Set(history.map((r) => r.id));
  const match = declared.find((d) => {
    if (applied.has(d.id)) return false;
    const start = Date.parse(d.date);
    const end = start + (d.windowDays ?? 14) * DAY_MS;
    const t = Date.parse(runDay);
    return Number.isFinite(start) && t >= start && t <= end;
  });
  if (!match) return { escalation, rebaselines: history };

  const entry = {
    id: match.id,
    date: runDay,
    title: match.title ?? 'Re-baseline',
    note: match.note,
    from: escalation.previous,
    to: escalation.current,
  };
  return {
    escalation: {
      flagged: false,
      rebaselined: match.id,
      previous: escalation.previous,
      current: escalation.current,
      note: `Composite moved ${escalation.previous} → ${escalation.current}; accepted as declared re-baseline "${match.id}".`,
    },
    rebaselines: [...history, entry],
  };
}
