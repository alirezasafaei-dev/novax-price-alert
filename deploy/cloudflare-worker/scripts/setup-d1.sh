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

database_id="$(
  npx wrangler d1 list --json |
    node -e '
      let input = "";
      process.stdin.on("data", chunk => input += chunk);
      process.stdin.on("end", () => {
        const rows = JSON.parse(input);
        const db = rows.find(row => row.name === "novax-product");
        if (db) process.stdout.write(db.uuid || db.id);
      });
    '
)"

if [[ -z "${database_id}" ]]; then
  create_output="$(npx wrangler d1 create novax-product)"
  database_id="$(
    printf '%s' "${create_output}" |
      sed -n 's/.*database_id = "\([^"]*\)".*/\1/p' |
      head -1
  )"
fi

if [[ -z "${database_id}" ]]; then
  echo "Unable to resolve D1 database id." >&2
  exit 1
fi

DB_ID="${database_id}" python3 - <<'PY'
import os
from pathlib import Path

path = Path("wrangler.toml")
content = path.read_text()
content = content.replace("REPLACE_WITH_D1_DATABASE_ID", os.environ["DB_ID"])
path.write_text(content)
PY

npx wrangler d1 migrations apply novax-product --remote
echo "D1 is configured and migrations are applied."
