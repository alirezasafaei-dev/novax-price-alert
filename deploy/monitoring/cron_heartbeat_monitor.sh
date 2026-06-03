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

# -e \u0639\u0645\u062f\u0627\u064b \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a: \u0627\u06cc\u0646 \u06cc\u06a9 \u0645\u0627\u0646\u06cc\u062a\u0648\u0631 \u0628\u0627\u06cc\u062f \u062f\u0631 \u0628\u0631\u0627\u0628\u0631 \u062e\u0637\u0627\u06cc curl/\u0634\u0628\u06a9\u0647 \u0645\u0642\u0627\u0648\u0645 \u0628\u0627\u0634\u062f\n# \u0648 \u062e\u0648\u062f\u0634 \u062e\u0637\u0627\u0647\u0627 \u0631\u0627 \u0645\u062f\u06cc\u0631\u06cc\u062a \u06a9\u0646\u062f (\u0646\u0647 \u0627\u06cc\u0646\u06a9\u0647 \u0648\u0633\u0637 \u06a9\u0627\u0631 \u0628\u0645\u06cc\u0631\u062f).\nset -uo pipefail

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
# نکته: عمداً از -f استفاده نمی‌کنیم، چون /status هنگام کهنه‌بودن عمداً 503 برمی‌گرداند
# و باید بدنه‌اش را بخوانیم. exit code خود curl را جدا می‌گیریم تا «در دسترس نبودن»
# (خطای شبکه) از «503» (پاسخِ معتبرِ کهنه) تفکیک شود.
BODY_FILE="$(mktemp "${STATE_DIR}/novax_status.XXXXXX")"
trap 'rm -f "$BODY_FILE"' EXIT
http_code="$(curl -sS -o "$BODY_FILE" -w '%{http_code}' "${WORKER_URL}/status" 2>/dev/null)"
curl_rc=$?

if [[ $curl_rc -ne 0 || -z "$http_code" || "$http_code" == "000" ]]; then
  send_alert "novax monitor: Worker در دسترس نیست (${WORKER_URL}/status بدون پاسخ، rc=${curl_rc})."
  exit 0
fi

# 503 = ضربان کهنه (طبق منطق /status).
status="$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d.get("status","?"),d.get("age_seconds","?"),d.get("last_cron_run","?"))' "$BODY_FILE" 2>/dev/null || echo "parse_error - -")"
read -r st age last <<<"$status"

if [[ "$http_code" == "503" || "$st" == "stale" || "$st" == "unknown" ]]; then
  send_alert "novax monitor: ضربان cron کهنه/نامشخص است (status=${st}, age=${age}s, last=${last})."
  exit 0
fi

echo "$(date -u +%FT%TZ) OK status=${st} age=${age}s last=${last}"
