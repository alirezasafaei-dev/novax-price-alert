# Novax Price Alert - Live Status

**🟢 LIVE on novax.alirezasafeidev.ir (<redacted-vps-host>)**

---

## ✅ Health Check Results (2026-06-12)

### API Health: ✅ PASS
```
curl https://novax.alirezasafeidev.ir/health
Response: {"status":"ok","db":"connected"}
```

### Prices API: ✅ PASS
```
curl -k https://novax.alirezasafeidev.ir/api/v1/prices/latest
8 assets live (USD, EUR, Gold, SEKKEH, USDT, BTC, ETH, BNB)
```

### TWA: ✅ PASS
```
curl -k https://novax.alirezasafeidev.ir/
Full HTML response with tabs (prices, assets, portfolio, alerts, chart, create)
```

### SSL: ✅ VALID
Let's Encrypt certificate active for novax.alirezasafeidev.ir

---

## 🏗️ Server Configuration

- **VPS**: <redacted-vps-host>
- **Path**: `/home/ubuntu/novax-price-alert`
- **Service Manager**: systemd (not PM2)
- **Services**:
  - novax-price-alert-api
  - novax-price-alert-worker
  - novax-mini-app

---

## 🤖 Bot

- **ID**: 8858674032
- **Username**: @novax_price_bot
- **Status**: Ready for Telegram testing

---

## 🔧 Quick Commands

```bash
# SSH to VPS
ssh ubuntu@<redacted-vps-host>
cd /home/ubuntu/novax-price-alert

# Check status
sudo systemctl status novax-price-alert-api
sudo systemctl status novax-price-alert-worker
sudo systemctl status novax-mini-app

# Restart services
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker
sudo systemctl restart novax-mini-app

# View logs
sudo journalctl -u novax-price-alert-api -f
sudo journalctl -u novax-price-alert-worker -f
```

---

## 📊 Current Prices (Live)

- USD_IRT: 1,801,800 تومان
- EUR_IRT: 2,078,100 تومان
- GOLD_18K_IRT: 178,669,000 تومان
- SEKKEH_EMAMI_IRT: 1,820,100,000 تومان
- USDT_IRT: 1,757,010 تومان
- BTC_USDT: 95.92 USDT (mock)
- ETH_USDT: 102.42 USDT (mock)
- BNB_USDT: 95.58 USDT (mock)

---

## ✅ Deployment Complete

**System is live and operational.**

For detailed server status, see `docs/SERVER_STATUS.md`.