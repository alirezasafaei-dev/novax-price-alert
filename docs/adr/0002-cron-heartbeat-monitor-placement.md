# ADR 0002: Cron Heartbeat Monitor Placement

## Status

Accepted.

## Context

The production bot runs entirely on the Cloudflare Worker, and alert delivery
depends on the Worker's scheduled (cron) handler running every ~10 minutes. A
critical observability gap is that **the absence of a cron run cannot be
detected from inside the Worker** — if the scheduler stops firing, no code runs
and therefore no event/log/alert is emitted. Detecting "cron stopped" requires
an **external** checker.

To support this, the Worker records a heartbeat in KV at the end of every
scheduled run (`cron:last_run`) and exposes a `GET /status` endpoint that
reports the heartbeat age and returns HTTP `503` when the heartbeat is stale
(default: older than 3 missed ticks = 30 minutes). See
`deploy/cloudflare-worker/src/heartbeat.js`.

The external monitor (`deploy/monitoring/cron_heartbeat_monitor.sh`) polls
`/status` and, if the Worker is unreachable or the heartbeat is stale, sends an
alert to the Telegram ops group. The open question was **where to run it**.

## Decision

Run the external monitor on **GitHub Actions** (scheduled workflow
`.github/workflows/cron-heartbeat-monitor.yml`, every 15 minutes), not on the
in-Iran VPS.

## Rationale

- An in-Iran VPS (MabnaHost) was evaluated and **rejected**: `api.telegram.org`
  is filtered from inside Iran, so the monitor could poll Cloudflare but could
  **not deliver the alert to Telegram** (verified: the `curl` to the Telegram
  API timed out). A monitor that cannot send its alert is useless.
- GitHub Actions runners are outside Iran and can reach **both** Cloudflare
  (`/status`) and `api.telegram.org`, so the full detect→alert chain works.
- It is serverless, free for this volume, version-controlled with the code, and
  independent of Cloudflare (so it can still alert when Cloudflare cron is the
  thing that failed).

## Tradeoffs

- GitHub's scheduled workflows can be delayed or skipped under load and are
  auto-disabled after ~60 days of repository inactivity. For a heartbeat that
  tolerates 30 minutes of staleness this is acceptable, but it is not a
  hard-real-time guarantee.
- The runner is stateless, so the script's file-based alert cooldown does not
  persist between runs; `COOLDOWN_SEC=0` is used and de-duplication relies on
  the 15-minute schedule instead.

## Operational notes

- Required repository secrets: `OPS_BOT_TOKEN` (Telegram bot token) and
  `OPS_CHAT_ID` (ops group, e.g. `-1003773212865`).
- Healthy runs are **silent** — the monitor only messages the ops group on a
  stale heartbeat or an unreachable Worker. A green workflow run with no Telegram
  message is the normal healthy state.
- The script reports a failed Telegram send (e.g. if run from a network where
  Telegram is blocked) instead of falsely logging "ALERT sent", and exits
  non-zero so the CI job turns red as a fallback signal.

## Revisit triggers

- GitHub Actions scheduling proves too unreliable or gets auto-disabled.
- A second, always-on egress outside Iran becomes available (e.g. a non-Iran
  VPS or an uptime service such as UptimeRobot/healthchecks.io pointed at
  `/status`), at which point a redundant checker could be added.
