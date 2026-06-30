#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${WORKER_DIR}/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1091
  . "${REPO_ROOT}/scripts/load-dotenv-safe.sh"
  load_dotenv_safe "${ENV_FILE}"
fi

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

cd "${WORKER_DIR}"

resolve_namespace_id() {
  local title="$1"
  local existing
  existing="$(npx wrangler kv namespace list --json | TITLE="${title}" node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const rows = JSON.parse(input || "[]");
      const match = rows.find(row => row.title === process.env.TITLE);
      if (match) process.stdout.write(match.id);
    });
  ')"
  if [[ -n "${existing}" ]]; then
    printf '%s' "${existing}"
    return 0
  fi

  local output
  output="$(npx wrangler kv namespace create "${title}")"
  printf '%s\n' "${output}" >&2
  printf '%s' "${output}" | sed -n 's/.*id = "\([^"]*\)".*/\1/p' | head -1
}

ASSETS_KV_ID="${ASSETS_KV_ID:-$(resolve_namespace_id novax-miniapp-assets)}"
SESSIONS_KV_ID="${SESSIONS_KV_ID:-$(resolve_namespace_id novax-sessions)}"
USERS_KV_ID="${USERS_KV_ID:-$(resolve_namespace_id novax-users-cache)}"

if [[ -z "${ASSETS_KV_ID}" || -z "${SESSIONS_KV_ID}" || -z "${USERS_KV_ID}" ]]; then
  echo "Unable to resolve all KV namespace ids." >&2
  exit 1
fi

ASSETS_KV_ID="${ASSETS_KV_ID}" SESSIONS_KV_ID="${SESSIONS_KV_ID}" USERS_KV_ID="${USERS_KV_ID}" python3 - <<'PY'
import os
from pathlib import Path

path = Path("wrangler.toml")
content = path.read_text()
replacements = {
    "REPLACE_WITH_ASSETS_KV_NAMESPACE_ID": os.environ["ASSETS_KV_ID"],
    "REPLACE_WITH_SESSIONS_KV_NAMESPACE_ID": os.environ["SESSIONS_KV_ID"],
    "REPLACE_WITH_USERS_KV_NAMESPACE_ID": os.environ["USERS_KV_ID"],
}
for placeholder, value in replacements.items():
    content = content.replace(placeholder, value)
path.write_text(content)
PY

echo "KV namespaces are configured in wrangler.toml."
