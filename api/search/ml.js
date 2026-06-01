const axios = require('axios');

const cache     = new Map();
const CACHE_TTL = 15 * 60 * 1000;

function getCached(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e.data;
}

function setCache(key, data) {
  if (cache.size >= 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0][0];
    cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

module.exports = async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.json({ results: [] });
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const key    = `ml|${q.trim().toLowerCase()}|${safeLimit}`;
  const cached = getCached(key);
  if (cached) return res.json({ results: cached });

  try {
    const { data } = await axios.get('https://api.mercadolibre.com/sites/MLC/search', {
      params: { q, limit: Math.min(safeLimit, 50) },
      timeout: 8000,
    });
    const results = (data.results || [])
      .filter(item => item.condition !== 'used')
      .map(item => ({
        externalId:    item.id,
        source:        'MercadoLibre',
        name:          String(item.title || '').trim().substring(0, 250),
        price:         Math.round(item.price || 0),
        originalPrice: item.original_price && item.original_price > item.price
          ? Math.round(item.original_price) : null,
        imageUrl:      item.thumbnail?.replace(/-[A-Z]\.jpg$/, '-O.jpg') || null,
        permalink:     item.permalink || null,
        brand:         item.attributes?.find(a => a.id === 'BRAND')?.value_name?.trim() || '',
        currency:      'CLP',
        scrapedAt:     new Date().toISOString(),
      }))
      .filter(p => p.name && p.price > 0);

    if (results.length > 0) setCache(key, results);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message, results: [] });
  }
};
