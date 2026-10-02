/**
 * Renders the "stale inputs" tracking-issue body from a snapshot's freshness
 * roll-up. Pure; no I/O — the daily workflow decides when to open, update, or
 * close the issue; this only decides what it says.
 */

const REPO_URL = 'https://github.com/Vaughanwj/futurewatch';

/** Number of inputs past their review date (due or stale, scored or not). */
export function overdueCount(freshness) {
  return freshness?.overdue?.length ?? 0;
}

/**
 * @param {{scored:{total:number,stale:number,due:number}, overdue:Array}} freshness snapshot.freshness
 * @param {string} generatedAt ISO timestamp of the snapshot
 */
export function renderStalenessReport(freshness, generatedAt) {
  const overdue = freshness?.overdue ?? [];
  const scoredOverdue = overdue.filter((o) => o.scored).length;
  const day = String(generatedAt ?? '').slice(0, 10) || 'unknown date';

  const rows = overdue.map(
    (o) => `| \`${o.slug}\` | ${o.scored ? 'yes' : 'no'} | ${o.status} | ${o.asOf ?? '—'} | ${o.reviewBy ?? '—'} | ${o.daysOverdue} |`
  );

  return [
    `**${overdue.length} input${overdue.length === 1 ? '' : 's'} past their review date** as of ${day}` +
      ` — ${scoredOverdue} of ${freshness?.scored?.total ?? '?'} scored inputs feeding the composite are affected.`,
    '',
    'The number on futurewatch.ai rests partly on values that may no longer reflect the field. ' +
      '"Sources healthy" on the site only means fetches succeeded; this is the freshness check.',
    '',
    '| Input | Feeds composite | Status | As of | Review by | Days overdue |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '**To clear an item:** re-check the source named in that entry\'s `_instructions` in ' +
      `[\`backend/data/futurewatch-manual.json\`](${REPO_URL}/blob/main/backend/data/futurewatch-manual.json), ` +
      'update the value and `asOf`, then move `reviewBy` forward. Please don\'t move `reviewBy` without actually ' +
      're-checking — that just hides the problem. Automated inputs (e.g. `metrTimeHorizon`) clear themselves ' +
      'when upstream publishes newer data.',
    '',
    '_`due` = 1–30 days past review; `stale` = more than 30. Maintained by the Daily Fetch workflow; ' +
      'it closes itself when nothing is overdue._',
    '',
  ].join('\n');
}
