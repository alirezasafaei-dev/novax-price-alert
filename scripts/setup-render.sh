#!/usr/bin/env bash
set -euo pipefail

# Render Deployment Setup Helper
# This script helps prepare your project for deployment to Render

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { printf '\n[INFO] %s\n' "$*"; }
warn() { printf '\n[WARN] %s\n' "$*"; }
error() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

cd "${REPO_ROOT}"

log "=== Render Deployment Setup Helper ==="

log "Checking prerequisites..."

# Check if required files exist
if [[ ! -f "render.yaml" ]]; then
    error "render.yaml not found. Please run this from the project root."
fi

if [[ ! -f "pyproject.toml" ]]; then
    error "pyproject.toml not found. Please run this from the project root."
fi

# Check if .env file exists
if [[ ! -f ".env" ]]; then
    warn ".env file not found. Copying from .env.example..."
    cp .env.example .env
    warn "Please edit .env file with your actual values before deploying."
fi

log "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    error "Python 3 not found. Please install Python 3.10 or higher."
fi

log "Checking uv installation..."
if ! command -v uv &> /dev/null; then
    log "uv not found. Installing uv..."
    pip install uv
fi

log "Installing dependencies..."
uv sync

log "Installing development dependencies required for migrations..."
uv sync --extra dev

log "Running database migrations (if DATABASE_URL is set)..."
if grep -q "^DATABASE_URL=" .env; then
    uv run alembic upgrade head
else
    warn "DATABASE_URL not set in .env. Skipping migrations."
fi

log "Seeding MVP assets (if DATABASE_URL is set)..."
if grep -q "^DATABASE_URL=" .env; then
    uv run python -m novax_price_alert.scripts.seed_mvp
else
    warn "DATABASE_URL not set in .env. Skipping seed."
fi

log "=== Setup Complete ==="
log ""
log "Next steps:"
log "1. Create a Render account at https://render.com"
log "2. Connect your GitHub repository to Render"
log "3. Render will detect render.yaml automatically"
log "4. Set environment variables in Render dashboard:"
log "   - DATABASE_URL (from Neon or Render PostgreSQL)"
log "   - TELEGRAM_BOT_TOKEN (from BotFather)"
log "   - TELEGRAM_RELAY_URL (https://novax-telegram-relay.asdevelooper.workers.dev)"
log "   - TELEGRAM_RELAY_SECRET (from your .env)"
log "   - ENVIRONMENT=production"
log "   - DEBUG=false"
log ""
log "For detailed instructions, see: docs/CLOUDFLARE_RENDER_DEPLOYMENT.md"
log ""
log "For environment variables reference, see: docs/RENDER_ENV_VARS.md"
log ""
log "For database setup, see: docs/NEON_SETUP.md"
