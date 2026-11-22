import axios from 'axios';
import express from 'express';
import cryptos from '../cryptos.js';

const router = express.Router();

const PRICE_TTL_MS = 60 * 1000;
const CHART_TTL_MS = 5 * 60 * 1000;
const priceCache = new Map();
const chartCache = new Map();

const PROVIDERS = [
  { id: 'changelly', name: 'Changelly', logo: 'changelly.svg' },
  { id: 'changenow', name: 'ChangeNOW', logo: 'changenow.svg' },
  { id: 'changehero', name: 'ChangeHero', logo: 'changehero.svg' },
  { id: 'letsexchange', name: 'LetsExchange', logo: 'letsexchange.svg' },
  { id: 'whynot', name: 'WhyNot', logo: 'whynot.svg' },
];

router.get('/cryptos', (req, res) => {
  res.json(cryptos.getV1Cryptos());
});

router.get('/prices', async (req, res) => {
  const rawIds = typeof req.query.cryptoIds === 'string' ? req.query.cryptoIds : '';
  const fiat = (typeof req.query.fiat === 'string' && req.query.fiat ? req.query.fiat : 'USD').toLowerCase();
  const ids = rawIds.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return res.json([]);
  }

  const cgIdToCryptoIds = new Map();
  for (const cryptoId of ids) {
    const crypto = cryptos.getById(cryptoId);
    const cgId = crypto?.coingecko?.id;
    if (!cgId) continue;
    if (!cgIdToCryptoIds.has(cgId)) {
      cgIdToCryptoIds.set(cgId, []);
    }
    cgIdToCryptoIds.get(cgId).push(cryptoId);
  }

  const cgIds = [...cgIdToCryptoIds.keys()].sort();
  if (cgIds.length === 0) {
    return res.json([]);
  }

  const cacheKey = `${fiat}:${cgIds.join(',')}`;
  const cached = priceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: fiat,
        ids: cgIds.join(','),
        price_change_percentage: '24h,7d,14d,30d,1y',
      },
      timeout: 6000,
    });

    const result = [];
    if (Array.isArray(data)) {
      for (const coin of data) {
        const matchedIds = cgIdToCryptoIds.get(coin.id) || [];
        for (const cryptoId of matchedIds) {
          result.push({
            cryptoId,
            price: coin.current_price ?? 0,
            price_change_1d: coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h ?? 0,
            price_change_7d: coin.price_change_percentage_7d_in_currency ?? 0,
            price_change_14d: coin.price_change_percentage_14d_in_currency ?? 0,
            price_change_1m: coin.price_change_percentage_30d_in_currency ?? 0,
            price_change_1y: coin.price_change_percentage_1y_in_currency ?? 0,
          });
        }
      }
    }

    priceCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + PRICE_TTL_MS,
    });
    return res.json(result);
  } catch (err) {
    if (cached) {
      return res.json(cached.data);
    }
    console.warn('prices fallback:', err.message);
    return res.json([]);
  }
});

router.get('/chart/:id', async (req, res) => {
  const cryptoId = req.params.id;
  const fiat = (typeof req.query.fiat === 'string' && req.query.fiat ? req.query.fiat : 'USD').toLowerCase();
  const daysNum = Number(req.query.days) || 1;
  const days = [1, 7, 14, 30, 365].includes(daysNum) ? daysNum : 1;

  const crypto = cryptos.getById(cryptoId);
  const cgId = crypto?.coingecko?.id;
  if (!cgId) {
    return res.json([]);
  }

  const cacheKey = `${cgId}:${fiat}:${days}`;
  const cached = chartCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const { data } = await axios.get(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(cgId)}/market_chart`, {
      params: {
        vs_currency: fiat,
        days,
      },
      timeout: 6000,
    });

    const points = Array.isArray(data?.prices)
      ? data.prices
        .filter((pair) => Array.isArray(pair) && pair.length >= 2)
        .map(([ts, price]) => ({
          bucket: new Date(ts).toISOString(),
          price,
        }))
        .reverse()
      : [];

    chartCache.set(cacheKey, {
      data: points,
      expiresAt: Date.now() + CHART_TTL_MS,
    });
    return res.json(points);
  } catch (err) {
    if (cached) {
      return res.json(cached.data);
    }
    console.warn('chart fallback:', err.message);
    return res.json([]);
  }
});

// Cards status
router.get('/public/status', (req, res) => {
  res.json({ enabled: false });
});

// Swap/exchange endpoints
router.get('/providers', (req, res) => {
  res.json(PROVIDERS);
});

router.get('/estimate', (req, res) => {
  res.json([]);
});

router.get('/transactions/:provider', (req, res) => {
  res.json([]);
});

router.post('/transaction/:provider', (req, res) => {
  res.status(503).json({ error: 'Exchange service is not configured' });
});

router.get('/validate/:provider', (req, res) => {
  res.json({ isValid: false });
});

// Ramps endpoints
router.get('/buy', (req, res) => {
  res.json([]);
});

router.get('/sell', (req, res) => {
  res.json([]);
});

export default router;
