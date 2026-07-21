# FutureWatch Meter — Methodology Draft v0.1

**Status: DRAFT for discussion. Not locked.**
Companion to `framework-survey.md` (all sources and confidence tags there).
Date: 2026-07-20

---

## 1. Product statement

A public meter answering three questions a curious non-specialist actually asks:

1. **How far along are we?** — a 0–100 progress reading toward AGI.
2. **How far do we have to go?** — what's still missing, in plain language.
3. **How long did it take to get here?** — the road from 2019, the current pace, and a credible arrival window.

Audience: tech enthusiasts and the general public. Design values: good data, somewhat novel, highly legible. Not a research tool; every number must survive a "says who?" click.

---

## 2. Scale and thresholds

One scale, two marked lines (per survey finding #4):

- **0** = 2019 baseline (GPT-2 era; start of the METR-measurable record).
- **100 = AGI line**: cognitive versatility and proficiency of a well-educated adult (Hendrycks et al. 2025), equivalently Morris et al. "Competent General AI".
- **ASI line**: marked beyond 100 (display as a second zone, not a second meter). Definition: Morris et al. "Superhuman General" — outperforms 100% of humans across the full breadth of domains. The meter displays the zone; we don't pretend to measure position within it.

## 3. Pillars (signal classes, not cognitive faculties)

Composite = weighted mean of three *evidence* pillars. The fourth signal class (Expectation) is deliberately excluded from the composite — what-people-think must not contaminate what-is. It powers the arrival-window panel instead.

### P1 — Capability (weight 45%)
What frontier systems can do, cognitively.
- `hendrycksAgiScore` — published AGI % per frontier model (manual, per model generation)
- `epochBenchmarks` — aggregate of frontier benchmark suite via Epoch AI API (automated, weekly)
- `arcGap` — human-vs-frontier gap on ARC-AGI current generation (automated/scrape, per release)
- `selfLearning` — CL-Bench Gain metric + successor benchmarks (manual, sporadic)
- `realTimeEngagement` — constructed rubric: multi-user, real-time, spontaneous interaction milestones (manual rubric, quarterly) — written criteria required before lock
- Sub-view: **jaggedness profile** across the 10 cognitive domains (radar/bar chart; the "what's missing" engine)

### P2 — Autonomy (weight 35%)
How long and how independently systems act without a human.
- `metrTimeHorizon` — 50% time horizon in human-equivalent minutes, log-scaled (automated via METR public repo, per release)
- `metrDoublingTime` — trailing doubling rate (derived from same data)
- `agenticAutonomyLevel` — Morris et al. autonomy level rubric 0–5 (manual rubric, quarterly)

### P3 — Deployment (weight 20%)
AI doing economically real work in the wild.
- `anthropicEconIndex` — automation share + occupational breadth (manual, ~quarterly)
- `aiIndexEconomy` — Stanford AI Index adoption/labor metrics (manual, annual)
- Placement note: deployment lags capability by construction; its lower weight reflects that it *confirms* rather than *predicts*.

### Expectation (no composite weight — powers the ETA panel)
- `friLeapAgi` — median AGI-arrival year from FRI's LEAP panel, experts vs. superforecasters (manual, ~monthly wave / quarterly review; decision D4)
- Previously `metaculusWeakAgi`/`metaculusFullAgi` via API (automated) — retired 2026-07 when Metaculus stopped serving live aggregation data through the API

### Safety (beside the meter, not in it)
- `fliSafetyIndex` — best overall lab grade + existential-safety grade (manual, semiannual)
- Displayed as **Divergence view**: capability pace vs. safety-practice grade. Same pattern as Frokkle's Divergence tab.

## 4. Scoring mechanics

Frokkle pattern, reused deliberately:
- Each indicator normalized 0–100 against written anchors (anchor table required at lock; e.g., `metrTimeHorizon`: 1 min = 5, 1 work-day = 60, 1 work-month = 90, 1 work-year = 100).
- Each pillar = level component (latest normalized values) + trajectory component (slope over trailing window), same 2:1-style blend as Frokkle, ratio TBD.
- Composite: P1×0.45 + P2×0.35 + P3×0.20.
- **History backfill**: METR publishes horizons back to 2019 (GPT-2); Epoch's database is historical; Hendrycks scored GPT-4 (2023) and GPT-5 (2025). This makes the "road from 2019" chart real data, not decoration.
- Source-health panel carried over from Frokkle (on-schedule % + per-source detail). It earns trust and it's nearly free.

## 5. The front page (headline triptych)

1. **HOW FAR** — big composite number + progress bar from 2019 mark to AGI line, ASI zone beyond.
2. **WHAT'S LEFT** — top 3 deficits in plain language, driven by the jaggedness profile (today: long-term memory, learning-on-the-fly, handling truly novel interactive environments). Each links to its indicator.
3. **HOW FAST** — sparkline of composite since 2019, current doubling stat ("autonomous task horizon doubling every ~4 months"), and the LEAP-panel arrival window clearly labeled as *forecast, not measurement*.

Below the fold: pillar cards (Frokkle card pattern), Divergence view, curated-stories panel (RSS: labs, arXiv, FutureWatch YouTube), source health.

## 6. Cadence and pipeline

- Daily cron (GitHub Actions, ~noon US Central) → automated adapters (METR repo, RSS) → `futurewatch.json` (static).
- Manual file (`futurewatch-manual.json`) for Hendrycks scores, rubric indicators, FLI, Stanford, Anthropic Econ, and the FRI LEAP expectation panel — each entry carries `_instructions` and next-update month, per Frokkle discipline.
- Hex architecture throughout; Azure static hosting; same adapter contract as Frokkle (`{ indicators, fetchMs, errors }`).

## 7. Honesty rules (carry-overs and additions)

- "Not a prediction. A reading." disclaimer, analogous to Frokkle's "not financial advice."
- Forecast content (Expectation) visually distinct from measured content, always.
- Composite moves >5 pts between runs → escalate before publishing (Frokkle rule).
- Every indicator page links its primary source. No number without a "says who?".
- [U]-tagged claims from the survey are barred from scoring until verified.

## 8. Open items before lock

1. Anchor tables per indicator (the real work — where all the judgment lives).
2. `realTimeEngagement` rubric criteria — draft needed, Vaughan approves.
3. Level:trajectory ratio per pillar.
4. Backfill validation: compute 2019–2026 composite, sanity-check the curve shape against known history (GPT-3 2020, ChatGPT 2022, GPT-4 2023, reasoning models 2024–25).
5. Name the headline number (working title: **the FutureWatch Meter**).
