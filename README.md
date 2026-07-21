# FutureWatch Meter

How far along are we? How far do we have to go? How long did it take to get here?

A public reading of progress toward AGI, built from peer-reviewed frameworks and live public data. One scale: 0 = the 2019 frontier (GPT-2 era), 100 = the AGI line (cognitive versatility and proficiency of a well-educated adult), with the ASI zone marked beyond.

> **Not a prediction. A reading.** Scores derive from public data and written anchor tables. Forecast content is displayed separately and never enters the composite.

## Structure

- **Composite** = Capability (45%) + Autonomy (35%) + Deployment (20%), level components only (Decision D3).
- **Expectation** (FRI LEAP panel forecasts) and **Safety** (FLI AI Safety Index) are displayed beside the meter, never inside it.
- Full methodology: `research/methodology-draft.md`. Normalization anchors with citations: `research/anchor-tables.md`. Source survey: `research/framework-survey.md`.

## Repo layout

```
backend/
  src/
    domain/        Pure scoring: anchors, pillar/composite scorer, METR logistic fit, snapshot builder
    adapters/      I/O: METR, manual file, RSS
    ports/         JSDoc type contracts
    app.js         Orchestrator (DI)
    index.js       Entry point → data/futurewatch.json + data/history.json
  data/
    futurewatch-manual.json   Manually-maintained indicators (self-documenting _instructions)
  config/feeds.json           Curated-stories RSS list
  scripts/probe.js            Dumps raw source responses for parser verification
  test/                       Fixture tests — no network in CI
.github/workflows/daily-fetch.yml    Daily 17:00 UTC → data branch
research/                     Methodology, anchors, survey, decision log
```

Hexagonal architecture throughout: `domain/` is pure (no I/O, no adapter imports); adapters return `{ indicators, fetchMs, errors }` and never throw.

## Running

```bash
cd backend
npm install
npm test          # 20 tests, fixtures only
npm start         # live fetch → data/futurewatch.json
npm run probe     # dump raw source responses to probe-output/
```

Exit code 2 = escalation: composite moved >5 pts vs. the previous snapshot — review before publishing.

## Maintenance

Manual indicators carry `_instructions` and `nextUpdate` inside `futurewatch-manual.json`. Quarterly: `realTimeEngagement` scoring session (rubric D2), `agenticAutonomyLevel`, ARC leaderboard check. Semiannual: FLI Safety Index. Annual: Stanford AI Index (~April).

## Known gaps (v0.1)

- `epochBenchmarks` is a judgment placeholder pending the Epoch adapter (basket B-2026.1 unconfirmed).
- ARC ratios flagged provisional — verify at arcprize.org before first publish.
- Frontend not yet built.
- 2019–2026 backfill validation not yet run.

## License

Private. Not for redistribution.
