# Four Capabilities Watch — methodology

A separate panel tracking precursor evidence for four capabilities discussed in the AI safety literature as
components of autonomous self-expansion: **AI Improvement**, **Goal Autonomy**, **Operational Autonomy**,
**Resource Acquisition**. Never averaged into the composite meter — the evidence types are too heterogeneous
(benchmark scores, an evidence ladder, qualitative reports) to combine into one honest number, and combining them
would itself be a form of overclaiming.

## Core principle

Do not claim that recursive self-improvement, genuinely self-originated goals, autonomous replication in the
wild, or autonomous resource accumulation have occurred unless the source evidence directly supports that
conclusion. Most currently available evidence measures precursor capabilities under controlled conditions.

## Architecture

This repo has no database, no running API server, and no authentication system — the whole site is a static
Vite/React frontend fed by a daily GitHub Actions job that writes JSON. Four Capabilities Watch is adapted to that
reality rather than the reverse:

| Spec concept | This repo's equivalent |
| --- | --- |
| Domain layer (entities, value objects, services, policies) | `backend/src/domain/capabilities/*` — pure, no I/O, unit tested |
| Application layer (ports, use cases) | `backend/src/app-capabilities.js` (orchestrator) + `backend/src/ports/capabilities-types.js` (JSDoc port contracts) |
| Outbound adapters | `backend/src/adapters/capabilities/*` |
| Database + migrations | None. The published `capabilities.json` snapshot itself holds the full observation history; each daily run reads the previous snapshot back (restored from the `data` branch — see DEPLOY.md), dedupes against it by `sourceHash`, and appends only genuinely new observations |
| Admin review API + UI | `backend/data/capabilities-review-queue.json` — a human-edited workspace file, never written to by the pipeline. Pending items from automated sources already show up directly in the published snapshot (`reviewStatus: 'pending'`), excluded from every public card field. See `capabilities-review-workflow.md` |
| Scheduler | The existing daily GitHub Actions cron (`.github/workflows/daily-fetch.yml`), same run as the main pipeline |
| Public API endpoints | Static JSON at `/data/capabilities.json`, same pattern as the existing `/data/futurewatch.json` |

## Domain model

See `backend/src/domain/capabilities/value-objects.js` for the full enum set (Capability, Environment, GoalOrigin,
SourceKind, Confidence, ReviewStatus, RecursiveLoopStatus) and `observation.js` for the normalized
`CapabilityObservation` shape. Every observation carries `sourceHash` (source identity + version + model + metric
+ date + value + unit), `humanReviewRequired`, and `reviewStatus` — the publication rule (`card-service.js`) only
lets `not_required`/`approved` observations drive a public card field; `pending`/`needs_more_evidence`/`rejected`
are counted but never asserted.

## The four capabilities

**AI Improvement** — whether a system can improve another model, improve AI-development processes, or contribute
to its own future development. Tracks a `recursiveLoopStatus` (none observed / single cycle / repeated
human-supervised cycles / repeated AI-directed cycles / sustained autonomous loop) that defaults to
`none_observed` unless an *approved* observation explicitly asserts otherwise.

**Goal Autonomy** — a five-level evidence ladder (0-4, see `value-objects.js` / the methodology page for the exact
wording), not a percentage. Levels 2-4 always require human review before publication
(`policies.js` `reviewRequired`).

**Operational Autonomy** — METR task horizons at 50% ("frontier") and 80% ("reliable") success, reusing the exact
same fitted curve as the scored `metrTimeHorizon` indicator on the home page
(`backend/src/domain/metr-fit.js` `horizonAtSuccessRate`, extracted from the existing `fitP50Horizon`). METR task
horizons are the human-expert duration of a task at a given success probability — not literal uninterrupted agent
runtime; this caveat is surfaced via the card's tooltip.

**Resource Acquisition** — tracks distinct subcapabilities (economic accumulation, account/compute/credential
acquisition, financial transaction, independent deployment, persistence, replication, resource retention/
reinvestment). A simulated balance and a real balance are structurally incompatible with each other's environment
(`policies.js` `validateIntegrity` rejects the mismatch outright) — a simulated result can never be labeled
real-world, and vice versa.

## Sources

### Live, automated
- **METR** (`backend/src/adapters/capabilities/metr-capabilities-adapter.js`) — reuses `fetchMetrSource()` from
  `metr-adapter.js`. Preferred source is METR's published horizons as mirrored in Epoch's archive (p50, p80 and
  confidence interval as METR reports them); if that is unreachable it falls back to refitting METR's public
  `eval-analysis-public` runs, and says so in `errors`. METR's own caveat applies: its task set is thin above
  ~16 hours, so very long horizons are low-confidence.
- **Epoch AI** (`epoch-capabilities-adapter.js`, shared download in `adapters/epoch-source.js`) — the CC-BY 4.0
  `epoch.ai/data/benchmark_data.zip` archive (refreshed daily, no key). The last three record-setting results per
  metric become observations: **PostTrainBench** → AI Improvement (controlled lab; explicitly *not* recursive
  self-improvement — one cycle on a small open model, not deployed); **Vending-Bench 2** → Resource Acquisition
  (simulated USD, simulation); **OSWorld** → `computer_use_success` and **Terminal-Bench 2.0** →
  `terminal_task_success` (sandbox). Epoch's coverage lags the benchmarks' own leaderboards for some models (OSWorld
  in particular), so these show the best result *in Epoch's table*, not necessarily the best in the world.

### Manual, human-reviewed
- **Vending-Bench 2 / Andon Labs** — one hand-entered observation (Claude Opus 5, $11,181.87, 2026-07) remains in
  `backend/data/capabilities-manual.json` from before the Epoch feed existed; it matches Epoch's figure for the same
  model and is harmless history. Andon's own leaderboard is client-rendered with no public export, so it is not scraped.
- **Goal Autonomy** — intentionally unpopulated. It requires a specific reviewed piece of qualitative evidence (a
  system card, an Apollo Research report), and levels 2–4 always wait for a human. It shows "no verified data yet"
  rather than an invented number.

### Not yet implemented (pending, per adapter)
- **Vending-Bench 2 first-party feed** (`vendingbench-live-adapter.js`) — Andon Labs' own leaderboard is
  client-rendered; a scraper would need a headless browser. Results already arrive via Epoch, so this is low priority.
- **GitHub release monitoring** (`github-release-adapter.js`) — straightforward against the GitHub API, but needs
  a persisted "last seen release" cursor this database-less pipeline doesn't have a home for yet.
- **Official-publication monitoring** (`publication-monitor-adapter.js`) — automated evidence extraction from
  system cards / research reports / incident reports (UK AI Security Institute, METR, Apollo Research, Anthropic,
  OpenAI, Google DeepMind). Building a claim-extraction step reliable enough not to mischaracterize high-stakes
  claims is a substantial undertaking on its own and is genuinely Phase-3-scale work.

Each pending adapter still conforms to the `CapabilitySourcePort` shape (`sourceName()`/`fetch()`) and returns
`{ candidates: [], pending: true, pendingReason: '...' }` rather than fabricating a response — see
`backend/test/capabilities/pending-adapters.test.js`.

## Public wording rules

Prefer: "The model completed controlled replication tasks." / "The agent increased its simulated balance." /
"The system preserved an assigned goal in an evaluation." / "The model demonstrated the ability to improve
another model." / "The agent completed tasks equivalent to a human expert taking several hours."

Avoid unless directly proven: "The AI reproduced itself." / "The AI made money for itself." / "The AI developed
its own desires." / "The AI became self-aware." / "The AI escaped." / "The AI is recursively self-improving."
/ "The AI took control of external resources."

## Known limitations

1. No live integration for GitHub releases or official-publication monitoring — see "pending" adapters above. All
   conform to the port contract and are covered by conformance tests, but produce no data.
2. Goal Autonomy has no populated observations. AI Improvement is populated from PostTrainBench only, which measures
   one controlled improvement cycle on a small model; it is a proxy for the capability, not evidence of a loop.
   Epoch's benchmark tables can lag the benchmarks' own leaderboards (OSWorld notably), so card values are "best in
   Epoch's data".
3. `capabilities.json`'s observation history lives entirely in the published static file — there is no database.
   A daily job restores the previous snapshot from the `data` branch before running (see DEPLOY.md), so dedup and
   accumulation work correctly in production, but this is a file, not a queryable store.
4. The review queue is a manually-maintained JSON file, not a web UI — see `capabilities-review-workflow.md`.
5. No automated claim-extraction from narrative text exists; qualitative evidence only enters the system via a
   human directly writing an entry into `capabilities-manual.json`.
6. `recursiveLoopStatus` and `goalAutonomyLevel` beyond the defaults have never been exercised against real
   production data in this implementation (no adapter currently proposes either) — the policy/domain logic is
   fully unit-tested with synthetic data, but hasn't been proven against a real high-stakes candidate yet.

## Environment variables

None. Every source used in this implementation (METR) is public and unauthenticated, matching the rest of this
project's pipeline.
