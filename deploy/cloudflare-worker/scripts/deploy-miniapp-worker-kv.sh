#!/usr/bin/env bash
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  echo "Error: execute this script; do not source it."
  return 2
fi
set -euo pipefail

# Secret-safe full deploy for the Telegram Worker + mini-app.
# - builds the React mini-app for /mini-app/
# - uploads static assets to ALERTS_KV
# - deploys the Worker code
# - points Telegram webhook at the Worker
# It never prints secret values.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${WORKER_DIR}/../.." && pwd)"
MINI_DIR="${REPO_ROOT}/mini-app"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"
WORKER_URL="${WORKER_URL:-https://novax-telegram-relay.asdevelooper.workers.dev}"
MINI_APP_URL="${MINI_APP_URL:-${WORKER_URL%/}/mini-app/}"
KV_NAMESPACE_ID="${ALERTS_KV_ID:-9bfa7672e25d446aa0a24165cbd1848a}"

load_dotenv() {
  local line key value
  [[ -f "${ENV_FILE}" ]] || return 0
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

require_vars() {
  local missing=0
  for var_name in "$@"; do
    if [[ -z "${!var_name:-}" ]]; then
      echo "Error: required environment variable ${var_name} is not set." >&2
      missing=1
    fi
  done
  [[ "${missing}" -eq 0 ]]
}

run_wrangler_deploy() {
  local log_file="${TMPDIR:-/tmp}/novax-worker-deploy.log"
  set +e
  (
    cd "${WORKER_DIR}"
    timeout 360s npx wrangler deploy
  ) 2>&1 | tee "${log_file}"
  local status=${PIPESTATUS[0]}
  set -e
  if [[ "${status}" -eq 0 ]]; then
    return 0
  fi

  echo "Wrangler deploy failed; retrying once without proxy environment..."
  (
    cd "${WORKER_DIR}"
    env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
      CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN}" \
      CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}" \
      timeout 360s npx wrangler deploy
  )
}

load_dotenv
require_vars CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID TELEGRAM_BOT_TOKEN TELEGRAM_SECRET_TOKEN

if grep -q "REPLACE_WITH_D1_DATABASE_ID" "${WORKER_DIR}/wrangler.toml"; then
  echo "Error: D1 is not configured. Run deploy/cloudflare-worker/scripts/setup-d1.sh first." >&2
  exit 2
fi

if [[ -n "${ALERTS_KV_ID:-}" ]]; then
  KV_NAMESPACE_ID="${ALERTS_KV_ID}"
fi
export ALERTS_KV_ID="${KV_NAMESPACE_ID}"

echo "Building mini-app for ${MINI_APP_URL}"
(
  cd "${MINI_DIR}"
  VITE_NOVAX_API_BASE="${WORKER_URL%/}" npm run type-check
  VITE_NOVAX_API_BASE="${WORKER_URL%/}" npm run build:pages -- --base=/mini-app/
)

echo "Uploading mini-app assets to KV namespace ${KV_NAMESPACE_ID:0:6}..."
MINI_DIST_DIR="${MINI_DIR}/dist" python3 - <<'PY'
import hashlib
import json
import mimetypes
import os
import pathlib
import time
import urllib.parse
import urllib.request

account = os.environ["CLOUDFLARE_ACCOUNT_ID"]
token = os.environ["CLOUDFLARE_API_TOKEN"]
namespace = os.environ.get("ALERTS_KV_ID") or "9bfa7672e25d446aa0a24165cbd1848a"
root = pathlib.Path(os.environ["MINI_DIST_DIR"])

skipped = []
uploaded = []
manifest = {"assets": {}}
for path in sorted(root.rglob("*"), key=lambda item: item.stat().st_size if item.is_file() else 0):
    if not path.is_file():
        continue
    rel = path.relative_to(root).as_posix()
    key = f"miniapp:asset:{rel}"
    data = path.read_bytes()
    sha256 = hashlib.sha256(data).hexdigest()
    content_type = mimetypes.guess_type(rel)[0] or "application/octet-stream"
    manifest["assets"][rel] = {"bytes": len(data), "content_type": content_type, "sha256": sha256}

    checksum_key = f"miniapp:asset-checksum:{rel}"
    checksum_url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account}"
        f"/storage/kv/namespaces/{namespace}/values/{urllib.parse.quote(checksum_key, safe='')}"
    )
    existing_asset_matches = False
    try:
        request = urllib.request.Request(
            checksum_url,
            method="GET",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            existing_sha256 = response.read().decode()
        if existing_sha256 == sha256:
            skipped.append(rel)
            print(json.dumps({"skipped": rel, "reason": "unchanged"}, ensure_ascii=False), flush=True)
            continue
    except Exception:
        pass

    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account}"
        f"/storage/kv/namespaces/{namespace}/values/{urllib.parse.quote(key, safe='')}"
    )
    try:
        request = urllib.request.Request(
            url,
            method="GET",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(request, timeout=45) as response:
            existing_data = response.read()
        existing_asset_matches = hashlib.sha256(existing_data).hexdigest() == sha256
    except Exception:
        existing_asset_matches = False

    last_error = None
    if existing_asset_matches:
        skipped.append(rel)
        print(json.dumps({"skipped": rel, "reason": "remote_match"}, ensure_ascii=False), flush=True)
    else:
        for attempt in range(1, 8):
            try:
                request = urllib.request.Request(
                    url,
                    data=data,
                    method="PUT",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": content_type,
                    },
                )
                with urllib.request.urlopen(request, timeout=90) as response:
                    payload = json.loads(response.read().decode())
                if not payload.get("success"):
                    raise RuntimeError(payload)
                uploaded.append(rel)
                print(json.dumps({"uploaded": rel, "bytes": len(data), "attempt": attempt}, ensure_ascii=False), flush=True)
                break
            except Exception as exc:  # noqa: BLE001 - deploy script should retry broad network errors
                last_error = exc
                print(json.dumps({"retry": rel, "attempt": attempt, "error": type(exc).__name__}, ensure_ascii=False), flush=True)
                time.sleep(min(20, attempt * 3))
        else:
            raise SystemExit(f"KV upload failed for {rel}: {last_error!r}")

    checksum_last_error = None
    for attempt in range(1, 8):
        try:
            request = urllib.request.Request(
                checksum_url,
                data=sha256.encode(),
                method="PUT",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "text/plain; charset=utf-8",
                },
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.loads(response.read().decode())
            if not payload.get("success"):
                raise RuntimeError(payload)
            break
        except Exception as exc:  # noqa: BLE001 - deploy script should retry broad network errors
            checksum_last_error = exc
            print(json.dumps({"retry": checksum_key, "attempt": attempt, "error": type(exc).__name__}, ensure_ascii=False), flush=True)
            time.sleep(min(20, attempt * 3))
    else:
        raise SystemExit(f"KV checksum upload failed for {rel}: {checksum_last_error!r}")

manifest_key = "miniapp:asset-manifest"
manifest_url = (
    f"https://api.cloudflare.com/client/v4/accounts/{account}"
    f"/storage/kv/namespaces/{namespace}/values/{urllib.parse.quote(manifest_key, safe='')}"
)
manifest_data = json.dumps(manifest, ensure_ascii=False, sort_keys=True).encode()
last_error = None
for attempt in range(1, 8):
    try:
        request = urllib.request.Request(
            manifest_url,
            data=manifest_data,
            method="PUT",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=utf-8",
            },
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = json.loads(response.read().decode())
        if not payload.get("success"):
            raise RuntimeError(payload)
        print(json.dumps({"uploaded": manifest_key, "bytes": len(manifest_data), "attempt": attempt}, ensure_ascii=False), flush=True)
        break
    except Exception as exc:  # noqa: BLE001 - deploy script should retry broad network errors
        last_error = exc
        print(json.dumps({"retry": manifest_key, "attempt": attempt, "error": type(exc).__name__}, ensure_ascii=False), flush=True)
        time.sleep(min(20, attempt * 3))
else:
    raise SystemExit(f"KV upload failed for {manifest_key}: {last_error!r}")

print(json.dumps({"uploaded_count": len(uploaded), "skipped_count": len(skipped)}, ensure_ascii=False))
PY

echo "Uploading Worker secrets..."
(
  cd "${WORKER_DIR}"
  printf '%s' "${TELEGRAM_BOT_TOKEN}" | npx wrangler secret put TELEGRAM_BOT_TOKEN
  printf '%s' "${TELEGRAM_SECRET_TOKEN}" | npx wrangler secret put TELEGRAM_SECRET_TOKEN
  printf '%s' "${MINI_APP_URL}" | npx wrangler secret put NOVAX_MINI_APP_URL
  printf '%s' "${TELEGRAM_SECRET_TOKEN}" | npx wrangler secret put SETUP_SECRET
  if [[ -n "${ADMIN_TELEGRAM_USER_IDS:-}" ]]; then
    printf '%s' "${ADMIN_TELEGRAM_USER_IDS}" | npx wrangler secret put ADMIN_TELEGRAM_USER_IDS
  fi
  if [[ -n "${PAYMENT_INSTRUCTIONS:-}" ]]; then
    printf '%s' "${PAYMENT_INSTRUCTIONS}" | npx wrangler secret put PAYMENT_INSTRUCTIONS
  fi
)

echo "Running Worker tests..."
(
  cd "${WORKER_DIR}"
  npm test
)

echo "Deploying Worker..."
(
  cd "${WORKER_DIR}"
  npx wrangler d1 migrations apply novax-product --remote
)
run_wrangler_deploy

echo "Setting Telegram webhook and commands..."
setup_response="$(curl -fsS -X POST -H "X-Setup-Secret: ${TELEGRAM_SECRET_TOKEN}" "${WORKER_URL%/}/setup-bot")"
printf '%s' "${setup_response}" | python3 -c '
import json, sys
p = json.load(sys.stdin)
print(json.dumps({
    "webhook_ok": p.get("webhook", {}).get("ok"),
    "commands_ok": p.get("commands", {}).get("ok"),
    "webhook_url": p.get("webhook_url"),
}, ensure_ascii=False))
'

echo "Verifying production endpoints..."
first_asset="$(find "${MINI_DIR}/dist/assets" -maxdepth 1 -type f -name 'index-*.js' -printf '/mini-app/assets/%f\n' | sort | head -1)"
for path in /health /api/v1/prices/latest /mini-app/ "${first_asset:-/mini-app/}"; do
  status="$(curl -fsS -o /tmp/novax-verify-body -w '%{http_code}' "${WORKER_URL%/}${path}")"
  sample="$(head -c 120 /tmp/novax-verify-body)"
  VERIFY_PATH="${path}" VERIFY_STATUS="${status}" VERIFY_SAMPLE="${sample}" python3 -c 'import json, os; print(json.dumps({"path": os.environ["VERIFY_PATH"], "status": int(os.environ["VERIFY_STATUS"]), "sample": os.environ["VERIFY_SAMPLE"]}, ensure_ascii=False))'
done

echo "Deployment complete. Mini-app: ${MINI_APP_URL}"
