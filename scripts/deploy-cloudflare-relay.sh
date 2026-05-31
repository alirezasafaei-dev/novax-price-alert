#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN with Workers edit permission}"
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN for the relay Worker secret}"
: "${TELEGRAM_RELAY_SECRET:?Set TELEGRAM_RELAY_SECRET for the relay Worker secret}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="${SCRIPT_DIR}/../deploy/cloudflare-worker"

cd "${WORKER_DIR}"
if [[ ! -d node_modules ]]; then
  npm install
fi
npm test
printf '%s' "${TELEGRAM_BOT_TOKEN}" | npx wrangler secret put TELEGRAM_BOT_TOKEN
printf '%s' "${TELEGRAM_RELAY_SECRET}" | npx wrangler secret put RELAY_SECRET
npx wrangler deploy
