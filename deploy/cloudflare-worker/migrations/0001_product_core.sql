PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  telegram_user_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('pro')),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  source TEXT NOT NULL,
  payment_request_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_subscriptions_user_status_expires
  ON subscriptions(telegram_user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
  amount_toman INTEGER NOT NULL,
  reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_payment_requests_status_created
  ON payment_requests(status, created_at);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
  canonical_asset_id TEXT NOT NULL,
  market TEXT NOT NULL,
  symbol TEXT NOT NULL,
  display_asset_name_at_creation TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('above', 'below')),
  target_price REAL NOT NULL CHECK (target_price > 0),
  target_price_display_unit TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  plan_snapshot TEXT NOT NULL CHECK (plan_snapshot IN ('free', 'pro')),
  check_interval_seconds INTEGER NOT NULL,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  repeat_every_minutes INTEGER,
  next_check_at TEXT,
  next_trigger_at TEXT,
  triggered_at TEXT,
  delivered_at TEXT,
  paused_at TEXT,
  trigger_event_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TEXT,
  lease_expires_at TEXT,
  error_message TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_alerts_due
  ON alerts(enabled, lifecycle_state, next_check_at);
CREATE INDEX IF NOT EXISTS ix_alerts_user_state
  ON alerts(telegram_user_id, lifecycle_state, created_at);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  triggered_price REAL,
  triggered_at TEXT NOT NULL,
  claimed_at TEXT,
  lease_expires_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TEXT,
  sent_at TEXT,
  telegram_message_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_alert_events_user_created
  ON alert_events(telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_alert_events_status_retry
  ON alert_events(status, next_retry_at);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_asset_id TEXT NOT NULL,
  price REAL NOT NULL,
  display_unit TEXT NOT NULL,
  provider TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_price_snapshots_asset_observed
  ON price_snapshots(canonical_asset_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_telegram_user_id TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL
);
