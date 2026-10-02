# Deployment — futurewatch.ai (FutureWatch Meter)

Same pattern as Frokkle (see recdash-v2/DEPLOY.md): static Vite/React frontend \+ a one-shot pipeline that writes static JSON. GitHub Actions runs the pipeline daily, builds the frontend, and pushes both to the `data` branch; the VM pulls on a cron and nginx serves everything.

Use startssh.ps1 for access to the VM where [futurewatch.ai](http://futurewatch.ai) is pointed. 

## What's deployed

1. **Frontend** — `frontend/dist/` static build. Fetches `/data/futurewatch.json` and `/data/capabilities.json` same-origin at runtime.  
2. **Pipeline** — `backend/src/index.js`, daily 17:00 UTC (~noon US Central) via `.github/workflows/daily-fetch.yml`. Fetches METR + RSS; reads `futurewatch-manual.json`; writes `backend/data/futurewatch.json` \+ `history.json`.
3. **Four Capabilities Watch pipeline** — `backend/src/capabilities-index.js` (`npm run capabilities`), same workflow run, same cadence. Separate output file (`backend/data/capabilities.json`) and separate frontend panel — never merged into the composite above. See `research/capabilities-methodology.md`.

No API keys required — every automated source is public and unauthenticated.

## nginx

server {

    listen 80;

    server\_name futurewatch.ai www.futurewatch.ai;

    root /var/www/futurewatch/dist;

    index index.html;

    location / {

        try\_files $uri $uri/ /index.html;

    }

    location /data/futurewatch.json {

        alias /var/www/futurewatch/data/futurewatch.json;

        add\_header Cache-Control "public, max-age=3600";

        add\_header Access-Control-Allow-Origin "\*";

    }

    location /data/history.json {

        alias /var/www/futurewatch/data/history.json;

        add\_header Cache-Control "public, max-age=3600";

        add\_header Access-Control-Allow-Origin "\*";

    }

    location /data/capabilities.json {

        alias /var/www/futurewatch/data/capabilities.json;

        add\_header Cache-Control "public, max-age=3600";

        add\_header Access-Control-Allow-Origin "\*";

    }

}

Then `nginx -t && systemctl reload nginx`, and certbot for TLS as usual.

## VM pull cron (Option A, same as Frokkle)

\# /etc/cron.d/futurewatch-data — pipeline runs daily 17:00 UTC

30 17 \* \* \* futurewatch cd /opt/futurewatch && git fetch origin data && \\

  rm -rf dist && git checkout origin/data \-- futurewatch.json history.json capabilities.json dist && \\

  cp futurewatch.json history.json capabilities.json /var/www/futurewatch/data/ && \\

  rsync \-a \--checksum \--delete dist/ /var/www/futurewatch/dist/

(`rm -rf dist` before the checkout is required — `dist/` isn't tracked on `main`, so `git checkout <ref> -- dist` only ever adds/updates files and never prunes ones from a prior pull that the latest snapshot no longer has, e.g. an old content-hashed JS bundle.)

(The data branch holds `futurewatch.json`, `history.json`, and the built `dist/` at its root — the workflow puts them there.)

## First deploy checklist

### GitHub (Spock / Vaughan)

- [ ] Push this repo to github.com/Vaughanwj/futurewatch (`main`)  
- [ ] Settings → Actions → General → Workflow permissions → "Read and write"  
- [ ] Trigger `daily-fetch.yml` manually (workflow\_dispatch) — verify: tests pass, both pipelines run with live METR data, `data` branch appears with futurewatch.json \+ capabilities.json \+ dist/  
- [ ] Inspect futurewatch.json from the data branch — sanity-check composite (\~46 expected) and that `errors` is empty or explainable  
- [ ] Inspect capabilities.json from the data branch — sanity-check the four cards and that `sourceHealth` shows the pending sources as `pending: true`, not `ok: false`

### VM (over ssh)

- [ ] `git clone` the repo to `/opt/futurewatch`  
- [ ] `mkdir -p /var/www/futurewatch/data /var/www/futurewatch/dist`  
- [ ] Seed once: pull the data branch and copy futurewatch.json \+ dist/ per the cron lines above  
- [ ] Install the nginx server block; `nginx -t`; reload  
- [ ] Add the cron file  
- [ ] Confirm `http://futurewatch.ai/data/futurewatch.json` returns JSON  
- [ ] Confirm `http://futurewatch.ai/` renders the meter  
- [ ] certbot for TLS

### Escalation behavior

The pipeline exits code 2 if the composite moves \>5 pts between runs (methodology §7). The Actions job then fails **before committing**, so a wild reading is never auto-published. Review the run log, and if the move is real (e.g., a manual-file update you made deliberately), re-run the workflow — the second run compares against the same previous snapshot and will flag again; if so, temporarily accept by deleting `futurewatch.json` from the data branch checkout the pipeline reads, or update the manual file in smaller steps. Log the event in `research/anchor-tables.md` decision log.

**Expect this to trip once:** the 2026-10-02 corrections move the composite only ~1.5 pts (METR join fix), but the planned input refresh (ARC, Epoch basket, METR — decision D7) is a ~+9 to +12 pt jump. That is deliberately larger than the gate; it will be applied as a logged, labeled re-baseline rather than by editing around the check.

**Fixed 2026-07-29:** this check silently never fired before that date — the workflow never restored the previous published `futurewatch.json`/`history.json` into the checkout before running the pipeline, so `previous` was always `null`, `history.json` never accumulated past one point, and the >5pt escalation comparison had nothing to compare against. The "Restore previously published data" step now fetches them from the `data` branch first. Same restore now backs `capabilities.json`'s observation dedup (below).

### Input freshness (added 2026-10-02)

"Sources healthy" on the site only means HTTP fetches succeeded. It said 100% for months while 8 of the 9 scored inputs — hand-entered values — sat unchanged and the composite read 46.5 on every one of 64 consecutive days. Freshness is now tracked separately:

- Every manual entry in `futurewatch-manual.json` has a `reviewBy` ISO date, set from that entry's own documented cadence. Automated feeds (`metrTimeHorizon`) derive theirs from the age of the newest data point (120 days).
- Status (`backend/src/domain/freshness.js`): **fresh** = within `reviewBy`; **due** = 1–30 days past; **stale** = more than 30 days past. Each indicator in `futurewatch.json` carries `freshness`, plus a top-level `freshness` roll-up.
- The site shows an "as of … · stale" marker per input, a warning line under the headline number, and an "N/9 scored inputs within their review date" line in the Source Health panel.
- The Daily Fetch workflow's **Report stale inputs** step keeps one GitHub issue (label `stale-inputs`) open and edited in place while anything is overdue, and closes it when nothing is. The step is non-blocking and needs the workflow's `issues: write` permission (declared at the top of `daily-fetch.yml`).
- **Clearing an item** means re-checking the source named in the entry's `_instructions`, updating the value and `asOf`, and only then moving `reviewBy` forward. Moving `reviewBy` without re-checking defeats the point.

Automated inputs clear themselves when upstream publishes newer data — but upstream can lag. METR's public data last gained a model on 2026-04-07 and its task suite saturates above ~16 h, so `metrTimeHorizon` is expected to show stale until METR publishes again.

## Maintenance cadence

Authoritative dates live in each entry's `reviewBy` (above); this table is the human summary.

| When | What |
| :---- | :---- |
| Quarterly | `realTimeEngagement` scoring session (rubric D2, Vaughan signs off); `agenticAutonomyLevel`; ARC ratios from arcprize.org; `friLeapAgi` review (forecastingresearch.substack.com, publishes ~monthly); Vending-Bench 2 leaderboard recheck (andonlabs.com/evals/vending-bench-2 — client-rendered, use a real browser) |
| Semiannual | FLI AI Safety Index (summer/winter releases). Read the scorecard TABLE for grades, not the prose — see decision D5 |
| Annual (\~April) | Stanford AI Index economy chapter |
| Per frontier model | `hendrycksAgiScore` from agidefinition.ai — being replaced by an ECI-based indicator (D8) |
| Next (Tier 1) | Automate `epochBenchmarks`, ARC (v3 JSON), METR (YAML), and the capability cards from Epoch's CC-BY `benchmark_data.zip` (epoch.ai/data/benchmark_data.zip, refreshed daily) |
| As evidence appears | Review qualitative AI-improvement / goal-autonomy evidence (research/capabilities-review-workflow.md) and promote to `backend/data/capabilities-manual.json` |

All manual entries carry `_instructions` inside `backend/data/futurewatch-manual.json` or `backend/data/capabilities-manual.json`.  
