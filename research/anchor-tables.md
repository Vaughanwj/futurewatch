# FutureWatch Meter — Anchor Tables v0.1

**Status: DRAFT. This is where the judgment lives — challenge every row.**
Companion to `methodology-draft.md` and `framework-survey.md`.
Date: 2026-07-20

---

## 0. Anchor-writing principles

1. **Every indicator is normalized so the 2019 frontier reads ≈ 0 and the AGI-line condition reads 100.** The rebasing lives in the anchors themselves, not in a post-hoc adjustment.
2. **Every anchor cites its "says who."** Anchors without citable grounding are marked `[J]` = judgment call, and there should be as few of those as we can manage.
3. **Between anchors, interpolate linearly** (on log scale where noted).
4. **Provisional current readings** below are back-of-envelope, marked ~. They exist to sanity-check anchor placement, not to publish. Final readings come from the pipeline.
5. **Ratchet rule for rotating benchmarks:** when a benchmark generation saturates or its basket changes, the indicator's history is *not* rewritten; the change is recorded in a decision log and the series marked with a break glyph (Frokkle escalation discipline applies).

---

## P1 — Capability (45%)

### `eciCapability` — Epoch Capabilities Index (automated, daily; replaced `hendrycksAgiScore`, D8)

Source: Epoch AI Capabilities Index (epoch.ai/benchmarks, CC-BY 4.0; `epoch_capabilities_index/eci_scores.csv` in the daily archive). Value = ECI of the top model.

The ECI is an open scale pinned by Epoch at GPT-5 = 150 and GPT-4 (Mar 2023) = 125.89. We map it to the 0–100 scale by a straight line through the two AGI-score points that Hendrycks et al. (agidefinition.ai, arXiv:2510.18212) published for those same two models:

| Anchor | ECI | Score |
| --- | --- | --- |
| GPT-4 (Mar 2023) — Hendrycks et al. 27% | 125.89 | 27 |
| GPT-5 (Aug 2025) — Hendrycks et al. 57% | 150.00 | 57 |
| Extrapolation | slope 1.244 score-pts per ECI pt; clamp 0–100; reaches 100 at ECI ≈ 184.6 | |

Provisional current: **78.6** (Claude Opus 5.5, ECI 167.35, 2026-09-22).
Challenge points: (1) the line is extrapolated beyond its two anchor points — the further ECI runs past 150, the more this is Epoch's scale wearing Hendrycks's units; (2) it overlaps with `epochBenchmarks` (ECI is built partly from the same benchmarks), so capability is partly double-counted; (3) a re-anchoring of the ECI by Epoch would silently change the mapping — the adapter verifies both anchor values on every fetch and refuses the reading if they move. The old manual entry is kept under `_retired_hendrycksAgiScore` in futurewatch-manual.json.

### `epochBenchmarks` — frontier benchmark basket (automated, weekly)

Source: Epoch AI Benchmarking Hub (CC-BY, CSV/API).
Recipe (implemented 2026-10-02): versioned basket **B-2026.1** = mean of the best published score on {GPQA Diamond, SWE-bench Verified, FrontierMath Tiers 1–3 (v2), Humanity's Last Exam}, each as a raw 0–1 fraction. **Correction to the original recipe:** these are raw benchmark scores, *not* normalized to expert-human performance — Epoch publishes no human baseline for them. A member scoring ≥ 90% is flagged `saturated` in the data (ratchet rule: rotate it out under a new basket version). All four members must resolve or the indicator is withheld — a partial basket is a different indicator.

| Anchor | Score |
| --- | --- |
| 2019 frontier performance on basket-class tasks (≈ random / negligible) | 0 |
| Frontier averages 50% of expert-human across basket | 50 |
| Frontier matches expert-human across entire unsaturated basket | 100 |

Current: **81.9** (GPQA 95.8%, SWE-bench Verified 83.5%, FrontierMath T1–3 93.7%, HLE 54.8%; 2026-10-02). GPQA and FrontierMath already sit near the ceiling, so this indicator is close to saturated and the next real movement will come from rotating the basket.
Challenge point: basket choice is the whole indicator. Rotation per ratchet rule when any member saturates >90%.

### `arcGap` — novel-reasoning gap (automated/scrape, per release)

Source: arcprize.org leaderboards; ARC Prize technical reports.
Recipe: mean over *active* ARC generations of (frontier score ÷ human score). A generation retires from the mean when frontier exceeds 85% of human performance on it (ratchet rule; retirement logged).

| Anchor | Score |
| --- | --- |
| Frontier ≈ 0% of human performance on active generations | 0 |
| Frontier at half of human performance | 50 |
| Frontier matches humans on every active generation (incl. interactive) | 100 |

Current (automated, 2026-10-02): **62.7**. ARC-AGI-2 (Semi-Private) is at 95.0% of the human panel and has retired under the ratchet; only ARC-AGI-3 remains active, scored on the Standard harness at 62.7% (Provider-Adapter harness: 99.9%, displayed not scored — D6). Note the indicator is now a mean over a single generation, so its next large move happens when ARC-AGI-3 retires (then 100) or a new generation is added.
Challenge point: is 85% the right retirement threshold?

### `selfLearning` — learning from experience (manual, sporadic)

Source: CL-Bench Gain metric (arXiv:2606.05661); successors as they appear.

| Anchor | Score |
| --- | --- |
| Zero/negative Gain: stateful ≈ stateless (the 2019–2024 condition) | 0 |
| Gain reliably positive across most domains, but modest | 30 |
| Gain ≈ half of the human learning-curve improvement on comparable task sequences `[J]` until human baselines published | 60 |
| Gain matches human learning-curve improvement; skills persist across sessions | 100 |

Provisional current: **~10–15** — Gain is barely positive; naive in-context beats dedicated memory systems.
Challenge point: the 60-anchor leans on human baselines that CL-Bench hasn't published yet. Until then it's `[J]`.

### `realTimeEngagement` — multi-user real-time rubric (manual, quarterly)

Constructed. Five milestones, 20 points each; partial credit 0/10/20 per milestone with written justification per scoring session. **These criteria need Vaughan's sign-off — this is the indicator he named.**

| # | Milestone | Points |
| --- | --- | --- |
| M1 | Real-time voice conversation with natural latency, interruption handling, and repair — single user | 20 |
| M2 | Multi-party group conversation: tracks speakers, addresses individuals, follows threaded topics | 20 |
| M3 | Spontaneous initiative: contributes unprompted, appropriately, without dominating (measured in group settings) | 20 |
| M4 | Persistent social memory: recalls people, running jokes, prior commitments across sessions without being re-told | 20 |
| M5 | Sustained membership: holds a valued role in a live human group (team, community, band…) over ≥4 weeks without novelty decay | 20 |

Evidence standard: public demonstrations or peer-reviewed evaluations, not vendor marketing.
Provisional current: **~30** — M1 ≈ 20 (voice mode is there), M2 ≈ 10 (demos, not robust), M3–M5 ≈ 0.
Challenge point: is M5 too anthropocentric, or is that exactly the point?

---

## P2 — Autonomy (35%)

### `metrTimeHorizon` — 50% time horizon (automated, per METR release)

Source: METR eval-analysis-public (verified primary).
Recipe: log-linear between two anchors; midpoints are derived, not asserted.

| Anchor | Score |
| --- | --- |
| ~4 seconds — GPT-2, 2019 (METR TH1 estimate) | 0 |
| 1 human work-month (~170 h) of autonomous work | 100 |
| *Derived:* 1 min ≈ 23 · 1 work-day ≈ 74 | — |

Provisional current: **~71** (Opus 4.5, 320 min, TH1.1 verified).
**Decision D1 (Vaughan, 2026-07-20): month-scale, not year-scale.** Rationale: a month of unsupervised work is rubiconic — it requires every autonomy faculty (context retention, error recovery, re-planning across thousands of steps); everything beyond is iteration of what already exists, not new capability. The gauge saturates at the Rubicon by design.
Known implication, accepted: at the current ~4-month doubling rate, this indicator could hit 100 around 2028 while capability deficits remain. That is the story, not a bug — autonomy stops being the binding constraint and the meter's remaining distance becomes entirely about the jagged deficits.

Trajectory component for this pillar = trailing doubling time computed from the same series (replaces the separate `metrDoublingTime` indicator — one source, level + slope, cleaner).

### `agenticAutonomyLevel` — Morris et al. autonomy rubric (manual, quarterly)

Source: arXiv:2311.02462 autonomy levels. Scored on what's *routine in deployed general-purpose systems*, not best demo. +10 if the next level is credibly demonstrated in limited settings.

| Anchor | Condition | Score |
| --- | --- | --- |
| AI as tool | human does the work, AI assists mechanically (2019) | 0 |
| AI as consultant | substantive advice when asked (2022–23 chat era) | 25 |
| AI as collaborator | shared goals, AI executes chunks with human checkpoints (2025 agent era) | 50 |
| AI as expert | AI drives day-scale work, human reviews outcomes | 75 |
| AI as autonomous agent | trusted with open-ended multi-week goals, human sets direction only | 100 |

Provisional current: **~55** (collaborator routine, expert demonstrated).
Challenge point: "routine in deployment" vs. "demonstrated" — I chose routine because the meter claims what *is*, not what's teased. Agree?

---

## P3 — Deployment (20%)

### `anthropicEconIndex` — real work footprint (manual, ~quarterly)

Source: Anthropic Economic Index reports.
Recipe: geometric mean of **breadth** (fraction of occupational categories with material AI task usage) and **depth** (automation share of usage — directive patterns, not augmentation). Geometric mean so neither wide-but-shallow nor deep-but-narrow scores well.

| Anchor | Score |
| --- | --- |
| Negligible real economic work by AI (2019) | 0 |
| AI performs a meaningful minority of tasks in a majority of occupations | 50 |
| AI performs the majority of economically valuable tasks across occupations (OpenAI-charter AGI framing) | 100 |

Provisional current: **~25–30** (breadth growing, depth 77% *of AI usage* but AI usage is still a small slice of total work — the formula must use share-of-total-work, not share-of-AI-traffic. Exact operationalization at build.)
Challenge point: this is the hardest indicator to make honest — Anthropic's data measures Claude usage, not the economy. Flagged as proxy, weight kept low.

### `aiIndexEconomy` — adoption and labor signal (manual, annual)

Source: Stanford AI Index, Economy chapter.
Recipe: mean of (a) firm genAI adoption rate and (b) AI share of job postings, each rebased 2019=0.

| Anchor | Score |
| --- | --- |
| 2019 baseline values of (a) and (b) | 0 |
| Adoption near-universal AND AI-exposed roles restructured at scale | 100 |

Provisional current: **~35–45** (compute from 2026 report at build).
Challenge point: weakest anchor set in the document — the 100-condition is qualitative. Candidate for replacement if a better public series appears. Kept because Deployment needs a non-Anthropic cross-check.

---

## Beside the meter (unscored in composite)

### Expectation — FRI LEAP panel (manual, ~monthly wave / quarterly review)
No anchors. Displayed as median AGI-arrival years with the "forecast, not measurement" label — superforecaster median and expert median shown side by side (D4). Previously sourced live from the Metaculus API; retired 2026-07 when Metaculus stopped serving aggregation data through the API for anti-abuse reasons (confirmed via their own "Changes to the Metaculus API" notice — not fixable client-side, tested both endpoint families and the `with_cp` param their own official client uses).

### Safety — FLI AI Safety Index (manual, semiannual)
Divergence bar uses **best-lab existential-safety domain grade** (not overall GPA — overall flatters, since it mixes in PR-friendly domains): grade points ÷ 4 × 100.
Current: **~32** (best existential-safety grade **D+**, 1.3/4.0 — Anthropic and OpenAI tied; Summer 2026 scorecard row reads D+ D+ D F F F F F F).
Correction 2026-10-02 (D5): this previously read ~42 / C−. FLI's page text says "No company exceeds C−", which is a loose upper bound; the scorecard table is the actual grade. The earlier value took the bound as the grade.
Challenge point: fair to labs? Overall-GPA alternative would read ~66 (Anthropic 2.66). I chose the harsher one because the divergence view exists to show the gap that matters. Your call.

---

## Composite sanity check (provisional, pre-pipeline)

P1 ≈ (58 + 60 + 20 + 12 + 30)/5 = **36** · P2 ≈ (71×0.7 + 55×0.3) = **66** · P3 ≈ **32**
Composite ≈ 36×0.45 + 66×0.35 + 32×0.20 = **46** (±10 easily, given provisional inputs)

Note this lands *lower* than the mockup's illustrative 61 and lower than Hendrycks's 58 — because the capability pillar carries the near-floor indicators (self-learning, real-time engagement, novel reasoning) that a pure-benchmark view ignores. That's the meter having a point of view: **the jagged deficits count.** If that reading feels wrong, the fix is arguing anchors, not nudging weights.

## Decision log

| # | Date | Decision | By |
| --- | --- | --- | --- |
| D1 | 2026-07-20 | `metrTimeHorizon` 100-anchor = 1 work-month (rubiconic threshold; beyond it is iteration, not novelty) | Vaughan |
| D2 | 2026-07-20 | `realTimeEngagement` rubric M1–M5 approved with equal 20-pt weights; revisit weighting only if live scoring reveals a dominant milestone | Vaughan |
| D4 | 2026-07-21 | Retired Metaculus API for the Expectation panel (data withheld by their own anti-abuse policy change); replaced with `friLeapAgi`, a manual quarterly entry from FRI's LEAP panel (experts + superforecasters), cf. Samotsvety Forecasting as secondary citation | Vaughan |
| D5 | 2026-10-02 | Corrections found in the Oct 2026 staleness audit: (a) METR release-date join dropped models listed only as "(Inspect)" in `release_dates.yaml` — Claude Opus 4.6 (719 min) was excluded, so the autonomy frontier read 352 min (GPT-5.2) instead of 719; fixed, composite 46.5 → ~48.0. (b) FLI existential-safety grade corrected C− → D+ (Safety bar 42.5 → 32.5). History before 2026-10-02 reflects the uncorrected values. Same audit adds per-input `reviewBy` freshness tracking | Vaughan (approved) |
| D6 | 2026-10-02 | ARC-AGI-3 harness policy: score the **Standard** harness (conservative); record and display the Provider Adapter harness result alongside it. ARC Prize lists both. Implemented 2026-10-02 (`domain/arc-extract.js`): ARC-AGI-2 = Semi-Private set vs. the human panel; ARC-AGI-3 Standard-harness rows are scored, rows whose id contains `provider-adapter` are carried as `providerAdapter` for display only. Current: ARC-AGI-2 95.0% (retired under the 85% ratchet), ARC-AGI-3 Standard 62.7% → arcGap 62.7 | Vaughan |
| D7 | 2026-10-02 | One-time re-baseline of the composite with refreshed inputs (ARC, Epoch basket, METR), shown on the site as a labeled discontinuity, plus a backfill of July–Oct from dated sources so history shows the real trajectory. Implementation pending (Tier 2) | Vaughan |
| D8 | 2026-10-02 | Replace `hendrycksAgiScore` (no scores published after GPT-5, Oct 2025) with an Epoch Capabilities Index–based indicator. Mapping approved (two-point linear calibration, see `eciCapability` above). Implemented 2026-10-02 | Vaughan |

## Open challenges (ranked by how much they move the needle)

1. `realTimeEngagement` rubric M1–M5: Vaughan sign-off required.
2. `epochBenchmarks` basket B-2026.1 contents.
3. Safety bar: existential-safety grade vs. overall GPA.
4. arcGap retirement threshold (85%).
5. P2 internal split (timeHorizon 70% / autonomyLevel 30%) `[J]`.
| D9 | 2026-10-02 | Tier 1 adapters built (branch `tier1-adapters`, not yet published). METR horizons now come from Epoch's mirror of METR's published numbers (p50/p80/CI), with METR's GitHub runs as fallback; automated inputs that return nothing are **carried forward** from the previous snapshot with their original `asOf` (never silently dropped — that would renormalize the composite) plus an error line. Local dry run against live data: composite 48.0 → 57.0 (capability 53.0, autonomy 74.6, deployment 35.3). Exceeds the 5-pt escalation gate, so publishing needs the labeled re-baseline (D7) | Claude (publication awaits Vaughan) |
