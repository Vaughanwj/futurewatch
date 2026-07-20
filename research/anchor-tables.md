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

### `hendrycksAgiScore` — published AGI % (manual, per model generation)

Source: agidefinition.ai / arXiv:2510.18212. Their scale is already "% of well-educated-adult cognitive versatility," i.e., natively 0→AGI-line.

| Anchor | Score |
| --- | --- |
| Their published score, used directly | identity |
| 2019 check: GPT-2 unscored by them; treat pre-GPT-3 as ≈2 `[J]` | 2 |

Provisional current: **~58** (GPT-5, their number).
Challenge point: we inherit their methodology risk wholesale. Mitigated by it being one of five capability indicators, not the headline.

### `epochBenchmarks` — frontier benchmark basket (automated, weekly)

Source: Epoch AI Benchmarking Hub (CC-BY, CSV/API).
Recipe: versioned basket **B-2026.1** = mean of frontier SOTA on {GPQA Diamond, SWE-bench Verified, FrontierMath, Humanity's Last Exam}, each expressed as fraction of expert-human performance on that benchmark. Basket contents to be finalized against what Epoch actually serves at build time.

| Anchor | Score |
| --- | --- |
| 2019 frontier performance on basket-class tasks (≈ random / negligible) | 0 |
| Frontier averages 50% of expert-human across basket | 50 |
| Frontier matches expert-human across entire unsaturated basket | 100 |

Provisional current: **~55–65** (to be computed from Epoch data at build).
Challenge point: basket choice is the whole indicator. Rotation per ratchet rule when any member saturates >90%.

### `arcGap` — novel-reasoning gap (automated/scrape, per release)

Source: arcprize.org leaderboards; ARC Prize technical reports.
Recipe: mean over *active* ARC generations of (frontier score ÷ human score). A generation retires from the mean when frontier exceeds 85% of human performance on it (ratchet rule; retirement logged).

| Anchor | Score |
| --- | --- |
| Frontier ≈ 0% of human performance on active generations | 0 |
| Frontier at half of human performance | 50 |
| Frontier matches humans on every active generation (incl. interactive) | 100 |

Provisional current: **~15–25** — ARC-AGI-2 partially closed, ARC-AGI-3 near zero (frontier <1% vs. humans 100%). Exact figures need the [U]-flagged leaderboard claims verified first.
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

### Expectation — Metaculus (automated, weekly)
No anchors. Displayed as dates with the "forecast, not measurement" label. Weakly-general and full-AGI questions shown side by side with their definitions one click away.

### Safety — FLI AI Safety Index (manual, semiannual)
Divergence bar uses **best-lab existential-safety domain grade** (not overall GPA — overall flatters, since it mixes in PR-friendly domains): grade points ÷ 4 × 100.
Provisional current: **~42** (best existential-safety grade C−, 1.7/4.0).
Challenge point: fair to labs? Overall-GPA alternative would read ~66. I chose the harsher one because the divergence view exists to show the gap that matters. Your call.

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

## Open challenges (ranked by how much they move the needle)

1. `realTimeEngagement` rubric M1–M5: Vaughan sign-off required.
2. `epochBenchmarks` basket B-2026.1 contents.
3. Safety bar: existential-safety grade vs. overall GPA.
4. arcGap retirement threshold (85%).
5. P2 internal split (timeHorizon 70% / autonomyLevel 30%) `[J]`.
