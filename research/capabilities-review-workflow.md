# Four Capabilities Watch — review workflow

This repo has no admin authentication system or review API. This document is the substitute: how a human
(Vaughan) reviews and publishes evidence for Four Capabilities Watch using plain files and normal git.

## When something needs review

An observation is held out of the public cards (shown only as a `pendingCount`, never asserted) when:

- It's a **Goal Autonomy** candidate at level 2, 3, or 4 (levels 0-1 publish automatically).
- Its proposed summary or excerpt contains any of the high-risk phrases in
  `backend/src/domain/capabilities/policies.js` (`HIGH_RISK_PHRASES`) — e.g. "recursive self-improvement",
  "self-replicated", "escaped", "obtained real money", "removed oversight", "acted without authorization".

This is enforced structurally (`domain/capabilities/observation.js` → `policies.js` `reviewRequired`), not by
convention — every candidate is checked against this rule regardless of which adapter produced it or how
confident that adapter claims to be.

## Where pending items show up

Automated candidates that need review are **not** written anywhere special — they're already visible in the
published `capabilities.json`, in the `observations` array, with `reviewStatus: 'pending'`. Each capability card
in `ingestion`/`cards.*.pendingCount` tells you how many exist without exposing the unreviewed content as if it
were verified.

To find them: pull the latest `capabilities.json` (from the `data` branch, or run `npm run capabilities` locally)
and filter `observations` for `reviewStatus === 'pending'`.

## Reviewing a pending automated candidate

1. Find the entry in `observations` (or in the CI job's console output — the pipeline logs a count of newly
   pending items each run).
2. Read its `sourceUrl` yourself. Confirm the `environment`, `goalOrigin`, `value`, and `unit` fields actually
   match what the source says — this is the same check a reviewer would do against an admin-UI's "exact
   supporting excerpt" field.
3. Decide:
   - **Approve** — add an equivalent entry to `backend/data/capabilities-manual.json`'s `observations` array with
     `"reviewStatus": "approved"` and your notes, so the next pipeline run's manual-adapter fetch picks it up
     with review already granted. (The original automated candidate itself is not separately "approved" in
     place — it stays `pending` in its own source's next fetch unless that source starts asserting a `not_required`
     confidence; approving via the manual file is the durable, human-attributed record.)
   - **Reject** — do nothing; leave it `pending` in the historical record (it's never published either way) or
     note the rejection reason in a commit message if you want it documented.
   - **Needs more evidence** — same as reject for now; there's no separate holding state beyond `pending` in this
     lightweight design.

## Evidence you found yourself (not from an adapter)

`backend/data/capabilities-review-queue.json` is a pure scratch workspace — the pipeline never reads or writes
it. Use it to jot down candidate evidence from a system card, an Apollo Research report, a news report, etc.
before you're confident enough to promote it. When ready, add the corresponding entry directly to
`capabilities-manual.json` with `"reviewStatus": "approved"` (or `"not_required"` if it doesn't hit the
review-required rules) and cite the exact supporting excerpt in `notes`.

## Rules for editing `capabilities-manual.json` yourself

- Never hand-set `reviewStatus: "approved"` for anything you have not personally verified against the cited
  `sourceUrl` (this is enforced by convention/discipline, not code — same trust model as `futurewatch-manual.json`).
- Never set `unit: "USD_real"` unless the source is explicitly about real-world money — the domain layer's
  `validateIntegrity` will reject `USD_real` paired with `environment: "simulation"` outright, but the reverse
  (a plausible-looking real claim you haven't checked) isn't structurally catchable — that's a human
  responsibility.
- A goal_autonomy entry at level 2+ still requires review even if you write it directly into the manual file —
  the `reviewRequired` policy runs on every candidate at normalization time regardless of source, so set
  `reviewStatus` honestly; the domain layer will still mark `humanReviewRequired: true` on the published record.

## Testing your review

After editing `capabilities-manual.json`, run:

```bash
cd backend
node --test test/capabilities/manual-capabilities-adapter.test.js
npm run capabilities
```

The second command regenerates `backend/data/capabilities.json` locally so you can inspect the resulting cards
before pushing.
