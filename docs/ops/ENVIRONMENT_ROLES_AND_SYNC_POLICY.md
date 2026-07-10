# ASDEV Environment Roles and Sync Policy — Novax

**Status:** Mandatory by reference  
**Canonical policy:** `alirezasafaei-dev/alirezasafaeisystems/docs/governance/ENVIRONMENT_ROLES_AND_SYNC_POLICY.md`

Novax agents must use the ASDEV canonical environment names:

- `LOCAL_PC` — owner's workstation and MiMo command center.
- `AUTOMATION_SERVER` — external automation server `asdev@91.107.153.223` for always-on sync, queue, MCP, agents, and reporting.
- `IRAN_PROD_SERVER` — Iran live production deployment server. Use only if Novax has a deployment there; otherwise mark not applicable.
- `GITHUB_MAIN` — GitHub main branch source of truth.

## Required behavior

- Do not say "local" or "server" without the canonical name.
- Do not mutate production endpoints, webhook, DNS, secrets, or storage without the correct approval path.
- Do not call deploy successful until `docs/ops/POST_DEPLOY_LIVE_VERIFICATION_POLICY.md` passes.
- Prompt/policy/queue changes belong in GitHub and must be pulled by `AUTOMATION_SERVER` sync automation.
- Hermes is the Telegram reporting owner unless explicitly changed.
- OpenClaw must not poll Telegram while Hermes is active.

## Novax-specific note

Novax includes Telegram/Worker/mini-app behavior. Post-deploy verification must cover bot privacy, group/private payment behavior, receipt notification, Worker health, webhook status, and analytics.
