# 🚀 Novax Price Alert - Quick Start

**Status**: ✅ Live on https://novax.alirezasafeidev.ir
**VPS**: <redacted-vps-host> (ubuntu)
**Bot**: @novax_price_bot (ID: 8858674032)

---

## 📊 Current Status (Production)

### ✅ What's Working:
- API Health: https://novax.alirezasafeidev.ir/health
- Prices API: https://novax.alirezasafeidev.ir/api/v1/prices/latest
- TWA: https://novax.alirezasafeidev.ir/
- SSL: Valid (Let's Encrypt)
- All 3 systemd services running

### 📈 Live Prices:
- USD_IRT: 1,801,800 تومان
- EUR_IRT: 2,078,100 تومان
- GOLD_18K_IRT: 178,669,000 تومان
- SEKKEH_EMAMI_IRT: 1,820,100,000 تومان
- USDT_IRT: 1,757,010 تومان
- BTC/ETH/BNB: Currently mock data

---

## 🔄 Sync Latest Changes (Optional)

**Latest commit**: `dc50924` - Added deployment docs and scripts

**To sync new documentation and scripts to VPS:**

```bash
cd /home/dev13/my-project/sites/secondary/novax-price-alert
bash scripts/ONE-COMMAND-SYNC.sh
```

**Or manually:**
```bash
rsync -avz --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' --exclude='.venv' --exclude='node_modules' --exclude='.next' --exclude='dist' --exclude='deploy/cloudflare-worker' . ubuntu@<redacted-vps-host>:/home/ubuntu/novax-price-alert/
```

**Note**: No restart needed - only docs changed. Production continues normally.

---

## 🔧 Management Commands

### SSH to VPS:
```bash
ssh ubuntu@<redacted-vps-host>
cd /home/ubuntu/novax-price-alert
```

### Check Services:
```bash
sudo systemctl status novax-price-alert-api
sudo systemctl status novax-price-alert-worker
sudo systemctl status novax-mini-app
```

### Restart Services:
```bash
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker
sudo systemctl restart novax-mini-app
```

### View Logs:
```bash
sudo journalctl -u novax-price-alert-api -f
sudo journalctl -u novax-price-alert-worker -f
```

---

## 🤖 BotFather Setup

Complete setup guide in `docs/BOTFATHER_SETUP.md`

Quick commands for BotFather:
```
/newbot
NovaX Price Alert Bot
NovaxPriceAlertBot

/setabouttext
📊 Novax Price Alert - ربات هشدار قیمت
• هشدار قیمت کریپتو و طلا/ارز
• هشدار مرحله‌ای با تایید صریح
• داشبورد هوشمند با چارت زنده
🌐 https://novax.alirezasafeidev.ir

/setcommands
start - شروع استفاده از بات 🚀
price - دیدن قیمت‌های فعلی 💰
alert - ایجاد هشدار قیمت 🔔
help - راهنما و پشتیبانی ❓
cancel - لغو عملیات ❌

/setprivacy
Disable
/setjoingroups
Enable
/setinline
Enable
```

---

## 📚 Documentation

- `docs/SERVER_STATUS.md` - Real server configuration
- `docs/BOTFATHER_SETUP.md` - Complete BotFather guide
- `docs/DEPLOYMENT_GUIDE.md` - Manual deployment steps
- `docs/DEPLOYMENT_ARCHITECTURE.md` - Architecture documentation
- `docs/PREMIUM_FEATURES_PLAN.md` - Monetization strategy

---

## ✅ Deployment Summary

**Last Deployment**: 2026-06-12
**Status**: Complete and Live
**Server Path**: /home/ubuntu/novax-price-alert
**Service Manager**: systemd (not PM2)
**Package Manager**: uv (not pip)

---

## 🎯 Next Steps (Optional)

1. Sync latest docs: `bash scripts/ONE-COMMAND-SYNC.sh`
2. Setup BotFather: Follow `docs/BOTFATHER_SETUP.md`
3. Test bot in Telegram: @novax_price_bot
4. Consider premium features: See `docs/PREMIUM_FEATURES_PLAN.md`

---

*Novax Price Alert - Production Live*