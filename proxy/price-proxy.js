const express = require('express');
const axios = require('axios');
const app = express();

const PORT = 3001;

let priceCache = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 دقیقه

app.get('/api/prices', async (req, res) => {
  try {
    const now = Date.now();
    
    if (priceCache && (now - lastFetch) < CACHE_TTL) {
      return res.json(priceCache);
    }
    
    const response = await axios.get('https://api.nobitex.ir/market/stats', {
      params: {
        srcCurrency: 'usdt,doge,shib,trx,ada,dot',
        dstCurrency: 'rls'
      }
    });
    
    const stats = response.data.stats;
    const prices = {};
    
    for (const [symbol, data] of Object.entries(stats)) {
      if (data.bestSell) {
        prices[symbol.toUpperCase()] = Math.round(parseFloat(data.bestSell) / 10);
      }
    }
    
    priceCache = { prices, timestamp: now };
    lastFetch = now;
    
    res.json(priceCache);
  } catch (error) {
    console.error('Error fetching prices:', error.message);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Price proxy running on port ${PORT}`);
});
