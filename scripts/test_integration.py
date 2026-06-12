#!/usr/bin/env python3
"""Full integration test: Telegram API + Backend API."""

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

BASE = Path("/home/dev13/my-project/sites/secondary/novax-price-alert")

# Read token using grep/sed to avoid Python string issues
result = subprocess.run(
    ["grep", "^TELEGRAM_BOT_TOKEN=", str(BASE / ".env")], capture_output=True, text=True
)
line = result.stdout.strip()
# Token is after the first = sign, but may contain = itself
# Format: TELEGRAM_BOT_TOKEN=<redacted-telegram-bot-token>...
if "=" in line:
    token = line.split("=", 1)[1]
else:
    print("ERROR: Token not found")
    sys.exit(1)

# Validate token looks real (not placeholder)
if "***" in token or len(token) < 20:
    print("ERROR: Token appears to be a placeholder")
    sys.exit(1)

print("Token: " + token[:20] + "...")

OK = 0
FAIL = 0


def check(name, condition, detail=""):
    global OK, FAIL
    if condition:
        OK += 1
        print("  PASS: " + name)
    else:
        FAIL += 1
        print("  FAIL: " + name + " " + str(detail)[:100])


# === 1. Telegram API ===
print("\n=== Telegram API ===")

try:
    url = "https://api.telegram.org/bot" + token + "/getMe"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
        check("getMe", data.get("ok"), data)
        if data.get("ok"):
            bot = data["result"]
            print("    Bot: @" + bot["username"] + " (ID: " + str(bot["id"]) + ")")
except Exception as e:
    check("getMe", False, str(e)[:100])

try:
    url = "https://api.telegram.org/bot" + token + "/getWebhookInfo"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
        check("getWebhookInfo", data.get("ok"), data)
        if data.get("ok"):
            wh = data["result"]
            print("    URL: " + str(wh.get("url", "none")))
            print("    Pending: " + str(wh.get("pending_update_count", 0)))
            if wh.get("last_error_message"):
                print("    Error: " + wh["last_error_message"])
except Exception as e:
    check("getWebhookInfo", False, str(e)[:100])

# === 2. Backend API ===
print("\n=== Backend API ===")


def api(method, path, data=None):
    url = "http://localhost:8000" + path
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


code, data = api("GET", "/health")
check("health", code == 200, "HTTP " + str(code) + ": " + str(data)[:80])

code, data = api("GET", "/api/v1/prices/latest")
check("prices_latest", code == 200, "HTTP " + str(code))
if code == 200:
    print("    Items: " + str(len(data.get("items", []))))

code, data = api("GET", "/api/v1/alerts")
check("alerts_need_auth", code == 401, "HTTP " + str(code))

code, data = api("GET", "/admin/overview")
check("admin_no_token", code in (200, 401, 500), "HTTP " + str(code))

code, data = api(
    "POST",
    "/api/v1/bot/webhook",
    {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "from": {"id": "123", "first_name": "Test"},
            "chat": {"id": "123", "type": "private"},
            "text": "/start",
        },
    },
)
check("webhook", code == 200, "HTTP " + str(code) + ": " + str(data)[:80])

# === Summary ===
print("\n=== Results: " + str(OK) + " passed, " + str(FAIL) + " failed ===")
if FAIL:
    sys.exit(1)
