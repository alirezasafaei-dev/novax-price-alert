# Release Checklist (فاز چهار T-504)

## Pre-release
- [ ] All P0 done (policies, locking, metrics/logs, freshness).
- [ ] Tests green (pytest 38+).
- [ ] Lint clean (ruff).
- [ ] Docs audit: roadmap + progress + contracts match runtime (code review + test matrix executed).
- [ ] Deploy stable: health 200, no break on 3 live sites, PM2 novax only.
- [ ] Walkthrough executed (ingest -> create via TWA/bot -> confirm -> eval -> deliver, no dups, fresh respected).
- [ ] Metrics visible, runbooks updated, no high error in logs.
- [ ] Git clean, main up to date, branches merged.

## Post-release
- [ ] Monitor /metrics/summary, stale counts, duplicate=0.
- [ ] Check TWA UX, suggestions, charts.
- [ ] Update baseline in roadmap if needed.
- [ ] Archive any temp branches.

Baseline: current state after auto execution of report roadmap (all phases complete, no critical gaps).
