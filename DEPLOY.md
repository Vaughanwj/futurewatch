# Deployment — futurewatch.ai (FutureWatch Meter)

Same pattern as Frokkle (see recdash-v2/DEPLOY.md): static Vite/React frontend \+ a one-shot pipeline that writes static JSON. GitHub Actions runs the pipeline daily, builds the frontend, and pushes both to the `data` branch; the VM pulls on a cron and nginx serves everything.

Use startssh.ps1 for access to the VM where [futurewatch.ai](http://futurewatch.ai) is pointed. 

## What's deployed

1. **Frontend** — `frontend/dist/` static build. Fetches `/data/futurewatch.json` same-origin at runtime.  
2. **Pipeline** — `backend/src/index.js`, daily 17:00 UTC (~noon US Central) via `.github/workflows/daily-fetch.yml`. Fetches METR + RSS; reads `futurewatch-manual.json`; writes `backend/data/futurewatch.json` \+ `history.json`.

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

}

Then `nginx -t && systemctl reload nginx`, and certbot for TLS as usual.

## VM pull cron (Option A, same as Frokkle)

\# /etc/cron.d/futurewatch-data — pipeline runs daily 17:00 UTC

30 17 \* \* \* futurewatch cd /opt/futurewatch && git fetch origin data && \\

  git checkout origin/data \-- futurewatch.json history.json dist && \\

  cp futurewatch.json history.json /var/www/futurewatch/data/ && \\

  rsync \-a \--delete dist/ /var/www/futurewatch/dist/

(The data branch holds `futurewatch.json`, `history.json`, and the built `dist/` at its root — the workflow puts them there.)

## First deploy checklist

### GitHub (Spock / Vaughan)

- [ ] Push this repo to github.com/Vaughanwj/futurewatch (`main`)  
- [ ] Settings → Actions → General → Workflow permissions → "Read and write"  
- [ ] Trigger `daily-fetch.yml` manually (workflow\_dispatch) — verify: tests pass, pipeline runs with live METR data, `data` branch appears with futurewatch.json \+ dist/  
- [ ] Inspect futurewatch.json from the data branch — sanity-check composite (\~46 expected) and that `errors` is empty or explainable

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

## Maintenance cadence

| When | What |
| :---- | :---- |
| Quarterly | `realTimeEngagement` scoring session (rubric D2, Vaughan signs off); `agenticAutonomyLevel`; ARC ratios from arcprize.org; `friLeapAgi` review (forecastingresearch.substack.com, publishes ~monthly) |
| Semiannual | FLI AI Safety Index (summer/winter releases) |
| Annual (\~April) | Stanford AI Index economy chapter |
| Per frontier model | `hendrycksAgiScore` from agidefinition.ai |
| Once, soon | Replace `epochBenchmarks` placeholder with the Epoch adapter (basket B-2026.1) |

All manual entries carry `_instructions` inside `backend/data/futurewatch-manual.json`.  
