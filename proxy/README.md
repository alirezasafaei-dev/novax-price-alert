# Price Proxy

## نصب در VPS

```bash
# 1. آپلود فایل‌ها به VPS
scp price-proxy.js package.json root@185.3.124.93:/opt/price-proxy/

# 2. نصب و اجرا
ssh root@185.3.124.93
cd /opt/price-proxy
npm install
pm2 start price-proxy.js --name price-proxy
pm2 save

# 3. تست
curl http://localhost:3001/health
curl http://localhost:3001/api/prices
```

## استفاده در Worker

```javascript
const response = await fetch('http://185.3.124.93:3001/api/prices');
const data = await response.json();
// data.prices = { USDT: 173000, DOGE: 450, ... }
```
