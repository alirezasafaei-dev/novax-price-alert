#!/usr/bin/env bash
#
# مانیتور بیرونیِ ضربان cron برای novax-telegram-relay.
#
# چرا بیرونی؟ نبودِ اجرای cron از داخل خود Worker قابل‌تشخیص نیست (نبودِ اجرا
# رویدادی تولید نمی‌کند). این اسکریپت endpoint `/status` را چک می‌کند و اگر Worker
# در دسترس نباشد یا ضربان cron کهنه شده باشد، یک هشدار به گروه ops تلگرام می‌فرستد.
#
# اجرا با cron (مثلاً هر ۱۵ دقیقه) روی یک ماشین مستقل (مثل VPS):
#   */15 * * * * BOT_TOKEN=xxx OPS_CHAT_ID=-100xxx /path/to/cron_heartbeat_monitor.sh >> /var/log/novax_monitor.log 2>&1
#
# متغیرهای محیطی:
#   BOT_TOKEN     (الزامی)  توکن همان بات تلگرام
#   OPS_CHAT_ID   (الزامی)  chat id گروه/کانال ops (عددی، معمولاً منفی)
#   WORKER_URL    (اختیاری) پیش‌فرض: https://novax-telegram-relay.asdevelooper.workers.dev
#   COOLDOWN_SEC  (اختیاری) حداقل فاصله بین دو هشدار، پیش‌فرض 3600 (۱ ساعت)
#   STATE_DIR     (اختیاری) محل فایل cooldown، پیش‌فرض /tmp

set -euo pipefail

WORKER_URL="${WORKER_URL:-https://novax-telegram-relay.asdevelooper.workers.dev}"
COOLDOWN_SEC="${COOLDOWN_SEC:-3600}"
STATE_DIR="${STATE_DIR:-/tmp}"
STATE_FILE="${STATE_DIR}/novax_cron_monitor.last_alert"

if [[ -z "${BOT_TOKEN:-}" || -z "${OPS_CHAT_ID:-}" ]]; then
  echo "ERROR: BOT_TOKEN and OPS_CHAT_ID must be set" >&2
  exit 2
fi

send_alert() {
  local text="$1"
  # cooldown: از اسپم جلوگیری کن.
  local now last=0
  now="$(date +%s)"
  if [[ -f "$STATE_FILE" ]]; then last="$(cat "$STATE_FILE" 2>/dev/null || echo 0)"; fi
  if (( now - last < COOLDOWN_SEC )); then
    echo "$(date -u +%FT%TZ) suppressed (cooldown): $text"
    return 0
  fi
  curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"chat_id":"%s","text":%s,"disable_web_page_preview":true}' \
        "$OPS_CHAT_ID" "$(printf '%s' "🚨 $text" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')")" \
    >/dev/null && echo "$now" > "$STATE_FILE"
  echo "$(date -u +%FT%TZ) ALERT sent: $text"
}

# 1) در دسترس بودن Worker + وضعیت ضربان.
http_code="$(curl -fsS -o /tmp/novax_status.json -w '%{http_code}' "${WORKER_URL}/status" 2>/dev/null || echo "000")"

if [[ "$http_code" == "000" ]]; then
  send_alert "novax monitor: Worker در دسترس نیست (${WORKER_URL}/status بدون پاسخ)."
  exit 0
fi

# 503 = ضربان کهنه (طبق منطق /status). هر کد >=500 یا 503 را به‌عنوان کهنگی هشدار بده.
status="$(python3 -c 'import json;d=json.load(open("/tmp/novax_status.json"));print(d.get("status","?"),d.get("age_seconds","?"),d.get("last_cron_run","?"))' 2>/dev/null || echo "parse_error - -")"
read -r st age last <<<"$status"

if [[ "$http_code" == "503" || "$st" == "stale" || "$st" == "unknown" ]]; then
  send_alert "novax monitor: ضربان cron کهنه/نامشخص است (status=${st}, age=${age}s, last=${last})."
  exit 0
fi

echo "$(date -u +%FT%TZ) OK status=${st} age=${age}s last=${last}"
