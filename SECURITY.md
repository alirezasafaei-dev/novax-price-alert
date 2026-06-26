# Security Policy

## Supported Versions

Security fixes are maintained for the current main branch and the latest released production deployment.

Older snapshots and archived docs are kept for reference only and are not treated as supported release lines.

## Security Practices

- Never commit `.env`, API tokens, webhook secrets, or Cloudflare credentials.
- Keep Telegram bot tokens and relay secrets out of logs, issue comments, and screenshots.
- Review webhook, relay, and cron changes carefully before production rollout.
- Prefer least-privilege access for Cloudflare and deployment credentials.

## Secret Exposure Response

If a secret reaches git history, removing it from the latest file is not enough.

Required response:

1. Revoke or rotate the exposed credential at the provider.
2. Update runtime secret stores such as Cloudflare Worker secrets and GitHub Actions secrets.
3. Redeploy or restart the affected runtime.
4. Rewrite and force-push git history only after the credential has been rotated.
5. Tell collaborators to re-clone or hard-resync because old clones can retain the secret.

2026-06-26 incident note: historical documentation contained a Telegram bot token pattern.
The repository history was rewritten and force-pushed, but the provider-side token must still
be rotated from BotFather before the incident is fully closed.

## Reporting a Vulnerability

If you find a security issue in the project, report it to the maintainer through the same private channel you already use for operational coordination.

Include:

- the affected component
- the observed behavior
- reproduction steps
- whether the issue affects production data, secrets, or message delivery

We will validate the report, assess impact, and prioritize a fix before public disclosure.
