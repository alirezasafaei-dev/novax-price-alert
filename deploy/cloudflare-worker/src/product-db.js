export const FREE_ALERT_LIMIT = 3;
export const PRO_ALERT_LIMIT = 30;
export const PRO_PRICE_TOMAN = 99_000;
export const PRO_DURATION_DAYS = 30;

export function hasProductDb(env) {
  return Boolean(env?.DB?.prepare);
}

export function isD1Required(env) {
  return String(env?.REQUIRE_D1 || "false").toLowerCase() === "true";
}

export function assertProductDb(env, flow = "product") {
  if (!hasProductDb(env) && isD1Required(env)) {
    const error = new Error(`D1 is required for ${flow} flow but is unavailable`);
    error.code = "D1_REQUIRED";
    error.status = 503;
    throw error;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function rowToAlert(row) {
  if (!row) return null;
  return {
    ...row,
    user_id: String(row.telegram_user_id),
    operator: row.condition_type,
    target: Number(row.target_price),
    target_price_normalized: Number(row.target_price),
    enabled: Boolean(row.enabled),
  };
}

export async function upsertUser(env, user) {
  if (!hasProductDb(env)) return;
  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO users (
      telegram_user_id, username, first_name, last_name, language_code, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      language_code = excluded.language_code,
      updated_at = excluded.updated_at
  `).bind(
    String(user.telegram_user_id),
    user.username || null,
    user.first_name || null,
    user.last_name || null,
    user.language_code || null,
    now,
    now,
  ).run();
}

export async function getEntitlement(env, telegramUserId) {
  if (!hasProductDb(env)) {
    return {
      plan: "free",
      alert_limit: FREE_ALERT_LIMIT,
      check_interval_seconds: 600,
      subscription_expires_at: null,
    };
  }
  const now = nowIso();
  const subscription = await env.DB.prepare(`
    SELECT expires_at
    FROM subscriptions
    WHERE telegram_user_id = ? AND status = 'active' AND expires_at > ?
    ORDER BY expires_at DESC
    LIMIT 1
  `).bind(String(telegramUserId), now).first();
  if (subscription) {
    return {
      plan: "pro",
      alert_limit: PRO_ALERT_LIMIT,
      check_interval_seconds: 60,
      subscription_expires_at: subscription.expires_at,
    };
  }
  return {
    plan: "free",
    alert_limit: FREE_ALERT_LIMIT,
    check_interval_seconds: 600,
    subscription_expires_at: null,
  };
}

export async function getUserAlertCount(env, telegramUserId) {
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM alerts
    WHERE telegram_user_id = ?
      AND lifecycle_state IN ('active', 'paused', 'failed', 'delivery_in_progress')
  `).bind(String(telegramUserId)).first();
  return Number(row?.count || 0);
}

export async function insertAlert(env, telegramUserId, alertData, alertId) {
  const bootstrapNow = nowIso();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO users (telegram_user_id, created_at, updated_at)
    VALUES (?, ?, ?)
  `).bind(String(telegramUserId), bootstrapNow, bootstrapNow).run();
  const entitlement = await getEntitlement(env, telegramUserId);
  const count = await getUserAlertCount(env, telegramUserId);
  if (count >= entitlement.alert_limit) {
    const error = new Error(
      entitlement.plan === "free"
        ? "سقف ۳ هشدار رایگان پر شده است. برای ساخت تا ۳۰ هشدار، پلن Pro را فعال کن."
        : "به سقف ۳۰ هشدار پلن Pro رسیده‌ای.",
    );
    error.code = "MAX_ALERTS_REACHED";
    throw error;
  }
  const now = nowIso();
  const nextCheckAt = new Date(Date.now() + entitlement.check_interval_seconds * 1000).toISOString();
  await env.DB.prepare(`
    INSERT INTO alerts (
      id, telegram_user_id, canonical_asset_id, market, symbol,
      display_asset_name_at_creation, condition_type, target_price,
      target_price_display_unit, lifecycle_state, enabled, plan_snapshot,
      check_interval_seconds, cooldown_minutes, repeat_every_minutes,
      next_check_at, attempt_count, max_attempts, version,
      created_at, confirmed_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?, ?, 0, 3, 1, ?, ?, ?)
  `).bind(
    alertId,
    String(telegramUserId),
    alertData.canonical_asset_id,
    alertData.market,
    alertData.symbol,
    alertData.display_asset_name_at_creation,
    alertData.operator,
    alertData.target,
    alertData.target_price_display_unit,
    entitlement.plan,
    entitlement.check_interval_seconds,
    Number(alertData.cooldown_minutes || 60),
    alertData.repeat_every_minutes || null,
    nextCheckAt,
    now,
    now,
    now,
  ).run();
  return rowToAlert(await env.DB.prepare("SELECT * FROM alerts WHERE id = ?").bind(alertId).first());
}

export async function listUserAlertsDb(env, telegramUserId) {
  const result = await env.DB.prepare(`
    SELECT * FROM alerts WHERE telegram_user_id = ? ORDER BY created_at DESC
  `).bind(String(telegramUserId)).all();
  return (result.results || []).map(rowToAlert);
}

export async function getAlertDb(env, telegramUserId, alertId) {
  return rowToAlert(await env.DB.prepare(`
    SELECT * FROM alerts WHERE id = ? AND telegram_user_id = ?
  `).bind(alertId, String(telegramUserId)).first());
}

export async function deleteAlertDb(env, telegramUserId, alertId) {
  const result = await env.DB.prepare(`
    DELETE FROM alerts WHERE id = ? AND telegram_user_id = ?
  `).bind(alertId, String(telegramUserId)).run();
  return Number(result.meta?.changes || 0) === 1;
}

export async function setAlertStateDb(env, telegramUserId, alertId, fromState, toState) {
  const now = nowIso();
  const result = await env.DB.prepare(`
    UPDATE alerts SET
      lifecycle_state = ?,
      enabled = ?,
      paused_at = CASE WHEN ? = 'paused' THEN ? ELSE NULL END,
      next_check_at = CASE WHEN ? = 'active' THEN ? ELSE next_check_at END,
      version = version + 1,
      updated_at = ?
    WHERE id = ? AND telegram_user_id = ? AND lifecycle_state = ?
  `).bind(
    toState,
    toState === "active" ? 1 : 0,
    toState,
    now,
    toState,
    now,
    now,
    alertId,
    String(telegramUserId),
    fromState,
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) return null;
  return getAlertDb(env, telegramUserId, alertId);
}

export async function updateAlertTargetDb(env, telegramUserId, alertId, target, unit) {
  if (!Number.isFinite(Number(target)) || Number(target) <= 0) return null;
  const now = nowIso();
  const result = await env.DB.prepare(`
    UPDATE alerts SET
      target_price = ?,
      target_price_display_unit = COALESCE(?, target_price_display_unit),
      lifecycle_state = 'paused',
      enabled = 0,
      paused_at = ?,
      triggered_at = NULL,
      trigger_event_id = NULL,
      version = version + 1,
      updated_at = ?
    WHERE id = ? AND telegram_user_id = ?
  `).bind(Number(target), unit || null, now, now, alertId, String(telegramUserId)).run();
  if (Number(result.meta?.changes || 0) !== 1) return null;
  return getAlertDb(env, telegramUserId, alertId);
}

export async function setAlertRepeatDb(env, telegramUserId, alertId, repeatMinutes) {
  const entitlement = await getEntitlement(env, telegramUserId);
  if (repeatMinutes && entitlement.plan !== "pro") {
    const error = new Error("هشدار تکرارشونده مخصوص پلن Pro است.");
    error.code = "PRO_REQUIRED";
    throw error;
  }
  const now = nowIso();
  const result = await env.DB.prepare(`
    UPDATE alerts SET repeat_every_minutes = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND telegram_user_id = ?
  `).bind(repeatMinutes || null, now, alertId, String(telegramUserId)).run();
  if (Number(result.meta?.changes || 0) !== 1) return null;
  return getAlertDb(env, telegramUserId, alertId);
}

export async function listDueAlertsDb(env, limit = 500) {
  const now = nowIso();
  await env.DB.prepare(`
    UPDATE subscriptions SET status = 'expired', updated_at = ?
    WHERE status = 'active' AND expires_at <= ?
  `).bind(now, now).run();
  await env.DB.prepare(`
    UPDATE alerts SET plan_snapshot = 'free', check_interval_seconds = 600, updated_at = ?
    WHERE telegram_user_id NOT IN (
      SELECT telegram_user_id FROM subscriptions
      WHERE status = 'active' AND expires_at > ?
    ) AND plan_snapshot = 'pro'
  `).bind(now, now).run();
  await env.DB.prepare(`
    UPDATE alerts SET lifecycle_state = 'paused', enabled = 0, paused_at = ?, updated_at = ?
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
          ROW_NUMBER() OVER (PARTITION BY telegram_user_id ORDER BY created_at ASC) AS position
        FROM alerts
        WHERE lifecycle_state = 'active'
          AND telegram_user_id NOT IN (
            SELECT telegram_user_id FROM subscriptions
            WHERE status = 'active' AND expires_at > ?
          )
      ) ranked
      WHERE position > ?
    )
  `).bind(now, now, now, FREE_ALERT_LIMIT).run();
  await env.DB.prepare(`
    UPDATE alerts SET
      lifecycle_state = 'active',
      enabled = 1,
      triggered_at = NULL,
      lease_expires_at = NULL,
      next_retry_at = ?,
      updated_at = ?
    WHERE lifecycle_state = 'delivery_in_progress'
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at <= ?
      AND attempt_count < max_attempts
  `).bind(now, now, now).run();
  const result = await env.DB.prepare(`
    SELECT * FROM alerts
    WHERE enabled = 1
      AND lifecycle_state = 'active'
      AND (next_check_at IS NULL OR next_check_at <= ?)
      AND (next_trigger_at IS NULL OR next_trigger_at <= ?)
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
    ORDER BY next_check_at ASC
    LIMIT ?
  `).bind(now, now, now, limit).all();
  return (result.results || []).map((row) => ({ ...rowToAlert(row), chat_id: row.telegram_user_id }));
}

export async function advanceAlertCheckDb(env, alert) {
  const next = new Date(Date.now() + Number(alert.check_interval_seconds || 600) * 1000).toISOString();
  await env.DB.prepare(`
    UPDATE alerts SET next_check_at = ?, updated_at = ? WHERE id = ? AND lifecycle_state = 'active'
  `).bind(next, nowIso(), alert.id).run();
}

export async function claimAlertDb(env, alert, eventId, currentPrice) {
  const now = nowIso();
  const leaseExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const result = await env.DB.prepare(`
    UPDATE alerts SET
      lifecycle_state = 'delivery_in_progress',
      enabled = 0,
      trigger_event_id = ?,
      triggered_at = ?,
      lease_expires_at = ?,
      attempt_count = attempt_count + 1,
      next_retry_at = NULL,
      version = version + 1,
      updated_at = ?
    WHERE id = ? AND lifecycle_state = 'active' AND enabled = 1
  `).bind(eventId, now, leaseExpiresAt, now, alert.id).run();
  if (Number(result.meta?.changes || 0) !== 1) return null;
  await env.DB.prepare(`
    INSERT INTO alert_events (
      id, alert_id, telegram_user_id, event_id, idempotency_key, status,
      triggered_price, triggered_at, claimed_at, lease_expires_at,
      attempt_count, max_attempts, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'delivery_in_progress', ?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET
      status = 'delivery_in_progress',
      triggered_price = excluded.triggered_price,
      claimed_at = excluded.claimed_at,
      lease_expires_at = excluded.lease_expires_at,
      attempt_count = alert_events.attempt_count + 1,
      next_retry_at = NULL,
      error_message = NULL,
      updated_at = excluded.updated_at
  `).bind(
    crypto.randomUUID(),
    alert.id,
    String(alert.telegram_user_id || alert.chat_id),
    eventId,
    `notification:${eventId}`,
    currentPrice,
    now,
    now,
    leaseExpiresAt,
    Number(alert.max_attempts || 3),
    now,
    now,
  ).run();
  return rowToAlert(await env.DB.prepare("SELECT * FROM alerts WHERE id = ?").bind(alert.id).first());
}

export async function markDeliveredDb(env, alert, eventId, telegramMessageId = null) {
  const now = nowIso();
  const repeating = Number(alert.repeat_every_minutes || 0) > 0;
  const nextTriggerAt = repeating
    ? new Date(Date.now() + Number(alert.repeat_every_minutes) * 60 * 1000).toISOString()
    : null;
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE alerts SET
        lifecycle_state = ?,
        enabled = ?,
        delivered_at = ?,
        triggered_at = ?,
        trigger_event_id = ?,
        next_trigger_at = ?,
        lease_expires_at = NULL,
        error_message = NULL,
        updated_at = ?
      WHERE id = ? AND trigger_event_id = ?
    `).bind(
      repeating ? "active" : "delivered",
      repeating ? 1 : 0,
      now,
      repeating ? null : alert.triggered_at,
      repeating ? null : eventId,
      nextTriggerAt,
      now,
      alert.id,
      eventId,
    ),
    env.DB.prepare(`
      UPDATE alert_events SET status = 'sent', sent_at = ?, telegram_message_id = ?,
        lease_expires_at = NULL, error_message = NULL, updated_at = ?
      WHERE event_id = ?
    `).bind(now, telegramMessageId, now, eventId),
  ]);
}

export async function markDeliveryFailedDb(env, alert, eventId, errorMessage) {
  const attempts = Number(alert.attempt_count || 0);
  const maxAttempts = Number(alert.max_attempts || 3);
  const retryable = attempts < maxAttempts;
  const now = nowIso();
  const nextRetry = retryable ? new Date(Date.now() + 60_000).toISOString() : null;
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE alerts SET lifecycle_state = ?, enabled = ?, triggered_at = NULL,
        lease_expires_at = NULL, next_retry_at = ?, error_message = ?, updated_at = ?
      WHERE id = ? AND trigger_event_id = ?
    `).bind(
      retryable ? "active" : "failed",
      retryable ? 1 : 0,
      nextRetry,
      String(errorMessage).slice(0, 500),
      now,
      alert.id,
      eventId,
    ),
    env.DB.prepare(`
      UPDATE alert_events SET status = ?, next_retry_at = ?, lease_expires_at = NULL,
        error_message = ?, updated_at = ? WHERE event_id = ?
    `).bind(
      retryable ? "failed" : "exhausted",
      nextRetry,
      String(errorMessage).slice(0, 500),
      now,
      eventId,
    ),
  ]);
  return { retryable, attempts, maxAttempts };
}

export async function listAlertEventsDb(env, telegramUserId, limit = 20) {
  const result = await env.DB.prepare(`
    SELECT e.*, a.canonical_asset_id AS asset_code,
      a.display_asset_name_at_creation AS asset_name
    FROM alert_events e
    JOIN alerts a ON a.id = e.alert_id
    WHERE e.telegram_user_id = ?
    ORDER BY e.created_at DESC
    LIMIT ?
  `).bind(String(telegramUserId), limit).all();
  return result.results || [];
}

export async function recordPriceSnapshots(env, items) {
  if (!hasProductDb(env) || !items.length) return;
  const now = nowIso();
  await env.DB.batch(items.map((item) => env.DB.prepare(`
    INSERT INTO price_snapshots (
      canonical_asset_id, price, display_unit, provider, observed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    item.canonical_asset_id,
    item.price,
    item.display_unit,
    item.provider,
    item.observed_at || now,
    now,
  )));
  await env.DB.prepare(`
    DELETE FROM price_snapshots WHERE observed_at < ?
  `).bind(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).run();
}

export async function getPriceHistoryDb(env, canonicalAssetId, since, limit = 500) {
  const result = await env.DB.prepare(`
    SELECT canonical_asset_id, price, display_unit, provider, observed_at
    FROM price_snapshots
    WHERE canonical_asset_id = ? AND observed_at >= ?
    ORDER BY observed_at ASC
    LIMIT ?
  `).bind(canonicalAssetId, since, limit).all();
  return result.results || [];
}

export async function createPaymentRequest(env, telegramUserId, reference) {
  const cleanReference = String(reference || "").trim().slice(0, 200);
  if (cleanReference.length < 3) throw new Error("کد پیگیری یا توضیح پرداخت معتبر نیست.");
  const bootstrapNow = nowIso();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO users (telegram_user_id, created_at, updated_at)
    VALUES (?, ?, ?)
  `).bind(String(telegramUserId), bootstrapNow, bootstrapNow).run();
  const existing = await env.DB.prepare(`
    SELECT id FROM payment_requests
    WHERE telegram_user_id = ? AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1
  `).bind(String(telegramUserId)).first();
  if (existing) return { id: existing.id, already_pending: true };
  const id = crypto.randomUUID().split("-")[0];
  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO payment_requests (
      id, telegram_user_id, amount_toman, reference, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).bind(id, String(telegramUserId), PRO_PRICE_TOMAN, cleanReference, now, now).run();
  return { id, already_pending: false };
}

export async function listPendingPayments(env, limit = 20) {
  const result = await env.DB.prepare(`
    SELECT p.*, u.username, u.first_name
    FROM payment_requests p
    LEFT JOIN users u ON u.telegram_user_id = p.telegram_user_id
    WHERE p.status = 'pending'
    ORDER BY p.created_at ASC LIMIT ?
  `).bind(limit).all();
  return result.results || [];
}

export async function reviewPayment(env, paymentId, adminId, approved) {
  const request = await env.DB.prepare(`
    SELECT * FROM payment_requests WHERE id = ? AND status = 'pending'
  `).bind(paymentId).first();
  if (!request) return null;
  const now = nowIso();
  if (!approved) {
    await env.DB.prepare(`
      UPDATE payment_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).bind(String(adminId), now, now, paymentId).run();
    return { ...request, status: "rejected" };
  }
  const active = await env.DB.prepare(`
    SELECT expires_at FROM subscriptions
    WHERE telegram_user_id = ? AND status = 'active' AND expires_at > ?
    ORDER BY expires_at DESC LIMIT 1
  `).bind(request.telegram_user_id, now).first();
  const startsAt = now;
  const baseTime = active ? new Date(active.expires_at).getTime() : Date.now();
  const expiresAt = new Date(baseTime + PRO_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const subscriptionId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE payment_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).bind(String(adminId), now, now, paymentId),
    env.DB.prepare(`
      INSERT INTO subscriptions (
        id, telegram_user_id, plan, status, starts_at, expires_at,
        source, payment_request_id, created_at, updated_at
      ) VALUES (?, ?, 'pro', 'active', ?, ?, 'manual_payment', ?, ?, ?)
    `).bind(
      subscriptionId,
      request.telegram_user_id,
      startsAt,
      expiresAt,
      paymentId,
      now,
      now,
    ),
    env.DB.prepare(`
      UPDATE alerts SET plan_snapshot = 'pro', check_interval_seconds = 60,
        next_check_at = ?, updated_at = ?
      WHERE telegram_user_id = ? AND lifecycle_state IN ('active', 'paused')
    `).bind(now, now, request.telegram_user_id),
  ]);
  return { ...request, status: "approved", expires_at: expiresAt };
}

export async function auditAdminAction(env, adminId, action, targetType, targetId, details = {}) {
  await env.DB.prepare(`
    INSERT INTO admin_audit_logs (
      id, action, actor_telegram_user_id, target_type, target_id, details_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    action,
    String(adminId),
    targetType || null,
    targetId || null,
    JSON.stringify(details),
    nowIso(),
  ).run();
}
