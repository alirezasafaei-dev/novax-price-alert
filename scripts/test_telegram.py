import json
import urllib.request
from pathlib import Path

# Read token
token = None
for line in Path('.env').read_text().split('\n'):
    line = line.strip()
    if line.startswith('TELEGRAM_BOT_TOKEN=') and '***' not in line and len(line) > 20:
        token = line.split('=', 1)[1].strip()
        break

print('Token found:', token[:20] + '...' if token else 'NO')

# Test Telegram API
url = f'https://api.telegram.org/bot{token}/getMe'
with urllib.request.urlopen(url, timeout=10) as resp:
    data = json.loads(resp.read())
    bot = data['result']
    print(f'Bot: @{bot["username"]} (ID: {bot["id"]})')

# Get webhook info
url = f'https://api.telegram.org/bot{token}/getWebhookInfo'
with urllib.request.urlopen(url, timeout=10) as resp:
    data = json.loads(resp.read())
    wh = data.get('result', {})
    print(f'Webhook: {wh.get("url", "none")}')
    print(f'Pending: {wh.get("pending_update_count", 0)}')
    if wh.get('last_error_message'):
        print(f'Error: {wh["last_error_message"]}')

# Test backend API (if running)
print()
print('--- Backend API (localhost:8000) ---')
try:
    with urllib.request.urlopen('http://localhost:8000/health', timeout=3) as resp:
        print(f'Health: {resp.status}')
except Exception as e:
    print(f'Health: not running ({e})')

print()
print('Done.')
