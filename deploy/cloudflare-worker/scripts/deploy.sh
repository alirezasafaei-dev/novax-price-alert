#!/usr/bin/env bash
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  echo "Error: execute this script; do not source it."
  return 2
fi
set -euo pipefail

# Secret-safe deploy script for the Telegram alert Worker.
# It loads ../../.env when present, but also supports secrets provided by the
# caller's environment/CI. It never prints secret values.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${WORKER_DIR}/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"
WORKER_URL="${WORKER_URL:-https://novax-telegram-relay.asdevelooper.workers.dev}"
DELETE_ENV_AFTER_DEPLOY="${DELETE_ENV_AFTER_DEPLOY:-0}"

if [[ "${DELETE_ENV_AFTER_DEPLOY}" == "1" && -f "${ENV_FILE}" ]]; then
  cleanup_env_file() {
    rm -f "${ENV_FILE}"
  }
  trap cleanup_env_file EXIT
fi

cd "${WORKER_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  load_dotenv() {
    local line key value
    while IFS= read -r line || [[ -n "${line}" ]]; do
      line="${line%%$'\r'}"
      [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
      [[ "${line}" =~ ^[[:space:]]*export[[:space:]]+ ]] && line="${line#[[:space:]]export }"
      [[ "${line}" == *"="* ]] || continue

      key="${line%%=*}"
      value="${line#*=}"
      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      value="${value#"${value%%[![:space:]]*}"}"

      if [[ "${value}" =~ ^\".*\"$ || "${value}" =~ ^\'.*\'$ ]]; then
        value="${value:1:${#value}-2}"
      fi

      if [[ ! "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        echo "Skipping invalid dotenv key: ${key}" >&2
        continue
      fi

      printf -v "${key}" '%s' "${value}"
      export "${key}"
    done < "${ENV_FILE}"
  }

  load_dotenv
else
  echo "No .env file found at ${ENV_FILE}; using current environment variables."
fi

required_vars=(
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID
  TELEGRAM_BOT_TOKEN
  TELEGRAM_SECRET_TOKEN
)

missing=0
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Error: required environment variable ${var_name} is not set."
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  echo "Aborting before deploy. Provide secrets via a local .env file or CI/environment secrets."
  exit 2
fi

redact_json() {
  python3 -c '''
import json
import sys

try:
    payload = json.load(sys.stdin)
except json.JSONDecodeError:
    print("<non-json response omitted>")
    raise SystemExit(0)

result = payload.get("result")
if isinstance(result, dict):
    result = {
        "url": result.get("url"),
        "pending_update_count": result.get("pending_update_count"),
        "last_error_date": result.get("last_error_date"),
        "last_error_message": result.get("last_error_message"),
    }

print(json.dumps(
    {
        "ok": payload.get("ok"),
        "result": result,
        "description": payload.get("description"),
    },
    ensure_ascii=False,
))
'''
}

echo "Uploading Worker secrets..."
printf '%s' "${TELEGRAM_BOT_TOKEN}" | npx wrangler secret put TELEGRAM_BOT_TOKEN
printf '%s' "${TELEGRAM_SECRET_TOKEN}" | npx wrangler secret put TELEGRAM_SECRET_TOKEN

echo "Deploying Worker..."
npx wrangler deploy

echo "Setting Telegram webhook..."
set_webhook_response="$(curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WORKER_URL}/webhook\",\"secret_token\":\"${TELEGRAM_SECRET_TOKEN}\"}")"
printf '%s' "${set_webhook_response}" | redact_json

echo "Verifying Worker health..."
curl -fsS "${WORKER_URL}/health"
echo

echo "Verifying Telegram webhook..."
webhook_info_response="$(curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")"
printf '%s' "${webhook_info_response}" | redact_json

echo "Deployment complete. Webhook: ${WORKER_URL}/webhook"
