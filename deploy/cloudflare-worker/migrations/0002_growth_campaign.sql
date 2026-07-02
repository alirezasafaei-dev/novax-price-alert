PRAGMA foreign_keys = ON;

-- Campaign attribution: first-touch (immutable) and latest-touch per user.
CREATE TABLE IF NOT EXISTS user_campaigns (
  telegram_user_id TEXT PRIMARY KEY REFERENCES users(telegram_user_id) ON DELETE CASCADE,
  first_source TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  latest_source TEXT NOT NULL,
  latest_seen_at TEXT NOT NULL
);

-- Referral relationships.
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
  invited_telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'valid', 'rejected')),
  created_at TEXT NOT NULL,
  validated_at TEXT,
  UNIQUE(invited_telegram_user_id)
);
CREATE INDEX IF NOT EXISTS ix_referrals_referrer
  ON referrals(referrer_telegram_user_id, status);

-- Referral rewards (Pro subscriptions granted for referrals).
CREATE TABLE IF NOT EXISTS referral_rewards (
  id TEXT PRIMARY KEY,
  referrer_telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  referrals_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_referral_rewards_referrer
  ON referral_rewards(referrer_telegram_user_id);

-- Marketing posts: idempotent daily channel posting.
CREATE TABLE IF NOT EXISTS marketing_posts (
  id TEXT PRIMARY KEY,
  campaign_source TEXT NOT NULL UNIQUE,
  channel_message_id TEXT,
  posted_at TEXT NOT NULL,
  content_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_marketing_posts_source
  ON marketing_posts(campaign_source);
