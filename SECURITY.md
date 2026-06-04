# Security Policy

## Supported Versions

Security fixes are maintained for the current main branch and the latest released production deployment.

Older snapshots and archived docs are kept for reference only and are not treated as supported release lines.

## Security Practices

- Never commit `.env`, API tokens, webhook secrets, or Cloudflare credentials.
- Keep Telegram bot tokens and relay secrets out of logs, issue comments, and screenshots.
- Review webhook, relay, and cron changes carefully before production rollout.
- Prefer least-privilege access for Cloudflare and deployment credentials.

## Reporting a Vulnerability

If you find a security issue in the project, report it to the maintainer through the same private channel you already use for operational coordination.

Include:

- the affected component
- the observed behavior
- reproduction steps
- whether the issue affects production data, secrets, or message delivery

We will validate the report, assess impact, and prioritize a fix before public disclosure.
