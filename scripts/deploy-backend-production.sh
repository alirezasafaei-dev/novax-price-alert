#!/usr/bin/env bash
set -Eeuo pipefail

# Safe, non-interactive backend rollout helper for the Novax FastAPI backend.
# It deploys the current branch to a VPS over SSH, applies migrations, restarts
# the API/worker services, and runs release health gates.
#
# Required:
#   NOVAX_DEPLOY_HOST       SSH host or IP of the backend server
#   NOVAX_DEPLOY_PATH       Absolute project path on the server
#   NOVAX_API_BASE_URL      Public HTTPS API base URL, e.g. https://api.example.com
#
# Optional:
#   NOVAX_DEPLOY_USER       SSH user; omit to use local ssh defaults
#   NOVAX_DEPLOY_BRANCH     Branch to deploy; default current local branch
#   NOVAX_API_SERVICE       systemd unit for API; default novax-price-alert-api
#   NOVAX_WORKER_SERVICE    systemd unit for worker; default novax-price-alert-worker
#   NOVAX_RELAY_BASE_URL    Relay URL; default production Worker URL
#   NOVAX_RUN_SEED          1 to run seed_mvp; default 1
#   NOVAX_SKIP_BACKUP       1 to skip PostgreSQL backup; default 0
#   NOVAX_SKIP_LOCAL_CHECKS 1 to skip local checks; default 0
#   METRICS_ACCESS_TOKEN    Optional token for /metrics verification

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { printf '\n[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"; }
require_env() { [[ -n "${!1:-}" ]] || fail "$1 is required"; }

require_cmd git
require_cmd ssh
require_cmd curl

require_env NOVAX_DEPLOY_HOST
require_env NOVAX_DEPLOY_PATH
require_env NOVAX_API_BASE_URL

cd "${REPO_ROOT}"

BRANCH="${NOVAX_DEPLOY_BRANCH:-$(git branch --show-current)}"
[[ -n "${BRANCH}" ]] || fail "Could not determine branch; set NOVAX_DEPLOY_BRANCH"

API_SERVICE="${NOVAX_API_SERVICE:-novax-price-alert-api}"
WORKER_SERVICE="${NOVAX_WORKER_SERVICE:-novax-price-alert-worker}"
RELAY_BASE_URL="${NOVAX_RELAY_BASE_URL:-https://novax-telegram-relay.asdevelooper.workers.dev}"
RUN_SEED="${NOVAX_RUN_SEED:-1}"
SKIP_BACKUP="${NOVAX_SKIP_BACKUP:-0}"
SKIP_LOCAL_CHECKS="${NOVAX_SKIP_LOCAL_CHECKS:-0}"

for value_name in NOVAX_DEPLOY_PATH BRANCH API_SERVICE WORKER_SERVICE RUN_SEED SKIP_BACKUP; do
  if [[ "${!value_name}" == *"'"* ]]; then
    fail "${value_name} must not contain single quotes for safe SSH transport"
  fi
done

SSH_TARGET="${NOVAX_DEPLOY_HOST}"
if [[ -n "${NOVAX_DEPLOY_USER:-}" ]]; then
  SSH_TARGET="${NOVAX_DEPLOY_USER}@${NOVAX_DEPLOY_HOST}"
fi

if [[ "${SKIP_LOCAL_CHECKS}" != "1" ]]; then
  log "Running local release checks"
  git diff --check
  uv run ruff check src tests
  uv run mypy src
  uv run pytest -q
  (cd deploy/cloudflare-worker && npm test)
else
  log "Skipping local release checks because NOVAX_SKIP_LOCAL_CHECKS=1"
fi

log "Verifying relay edge before backend rollout"
curl -fsS "${RELAY_BASE_URL%/}/health" >/dev/null
curl -fsS "${RELAY_BASE_URL%/}/status" >/dev/null

log "Deploying branch '${BRANCH}' to ${SSH_TARGET}:${NOVAX_DEPLOY_PATH}"
ssh -o BatchMode=yes "${SSH_TARGET}" \
  "NOVAX_DEPLOY_PATH='${NOVAX_DEPLOY_PATH}' NOVAX_DEPLOY_BRANCH='${BRANCH}' NOVAX_API_SERVICE='${API_SERVICE}' NOVAX_WORKER_SERVICE='${WORKER_SERVICE}' NOVAX_RUN_SEED='${RUN_SEED}' NOVAX_SKIP_BACKUP='${SKIP_BACKUP}' bash -se" <<'REMOTE_SCRIPT'
set -Eeuo pipefail
log() { printf '\n[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
cd "${NOVAX_DEPLOY_PATH}"

command -v git >/dev/null 2>&1 || fail "git is not installed on target"
command -v uv >/dev/null 2>&1 || fail "uv is not installed on target"
command -v systemctl >/dev/null 2>&1 || fail "systemctl is not available on target"

log "Fetching release branch"
git fetch --prune origin
if [[ -n "$(git status --porcelain)" ]]; then
  fail "Target working tree has uncommitted changes; aborting to avoid overwriting operator changes"
fi
git checkout "${NOVAX_DEPLOY_BRANCH}"
git pull --ff-only origin "${NOVAX_DEPLOY_BRANCH}"

log "Installing/syncing dependencies"
uv sync

if [[ "${NOVAX_SKIP_BACKUP}" != "1" ]]; then
  log "Creating PostgreSQL backup when DATABASE_URL is available"
  database_url="${DATABASE_URL:-}"
  if [[ -z "${database_url}" && -f .env ]]; then
    database_url="$(sed -nE 's/^[[:space:]]*DATABASE_URL[[:space:]]*=[[:space:]]*//p' .env | head -n 1)"
    database_url="$(printf '%s' "${database_url}" | sed -E "s/^['\"]//; s/['\"]$//")"
  fi
  if [[ -n "${database_url}" ]]; then
    command -v pg_dump >/dev/null 2>&1 || fail "pg_dump is not installed on target"
    backup_dir="${NOVAX_DEPLOY_PATH}/backups"
    mkdir -p "${backup_dir}"
    backup_file="${backup_dir}/backup-$(date -u +%Y%m%d-%H%M%S).sql"
    pg_dump "${database_url}" > "${backup_file}"
    chmod 600 "${backup_file}"
    log "Backup created at ${backup_file}"
  else
    log "DATABASE_URL not available; backup skipped"
  fi
else
  log "Skipping backup because NOVAX_SKIP_BACKUP=1"
fi

log "Applying migrations"
uv run alembic upgrade head

if [[ "${NOVAX_RUN_SEED}" == "1" ]]; then
  log "Seeding MVP assets"
  uv run python -m novax_price_alert.scripts.seed_mvp
fi

log "Restarting services"
sudo systemctl restart "${NOVAX_API_SERVICE}"
sudo systemctl restart "${NOVAX_WORKER_SERVICE}"
sudo systemctl is-active --quiet "${NOVAX_API_SERVICE}"
sudo systemctl is-active --quiet "${NOVAX_WORKER_SERVICE}"
REMOTE_SCRIPT

log "Verifying backend public API"
curl -fsS "${NOVAX_API_BASE_URL%/}/health" >/dev/null
curl -fsS "${NOVAX_API_BASE_URL%/}/api/v1/prices/latest" >/dev/null

if [[ -n "${METRICS_ACCESS_TOKEN:-}" ]]; then
  log "Verifying protected metrics endpoint"
  curl -fsS -H "X-Metrics-Token: ${METRICS_ACCESS_TOKEN}" "${NOVAX_API_BASE_URL%/}/metrics" >/dev/null
else
  log "Skipping /metrics verification because METRICS_ACCESS_TOKEN is not set"
fi

log "Production backend rollout completed successfully"
