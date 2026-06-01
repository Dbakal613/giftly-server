const axios  = require('axios');
const crypto = require('crypto');

// ── In-memory cache ───────────────────────────────────────────────────────────
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

// ── MercadoLibre OAuth token (client_credentials) ────────────────────────────
// Set ML_APP_ID and ML_APP_SECRET in Vercel env vars to enable real ML results.
let _mlToken = null;
let _mlTokenExpiry = 0;

async function getMLToken() {
  const appId  = process.env.ML_APP_ID;
  const secret = process.env.ML_APP_SECRET;
  if (!appId || !secret) return null;
  if (_mlToken && _mlTokenExpiry > Date.now()) return _mlToken;
  try {
    const { data } = await axios.post('https://api.mercadolibre.com/oauth/token', null, {
      params: { grant_type: 'client_credentials', client_id: appId, client_secret: secret },
      timeout: 5000,
    });
    _mlToken      = data.access_token;
    _mlTokenExpiry = Date.now() + (data.expires_in - 300) * 1000; // refresh 5 min early
    console.log('✅ ML token refreshed');
    return _mlToken;
  } catch (e) {
    console.error('ML token error:', e.response?.data?.message || e.message);
    return null;
  }
}

// ── MercadoLibre search ───────────────────────────────────────────────────────
async function searchML(q, limit = 20) {
  try {
    const token   = await getMLToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const { data } = await axios.get('https://api.mercadolibre.com/sites/MLC/search', {
      params: { q, limit: Math.min(limit, 50) },
      headers,
      timeout: 8000,
    });
    return (data.results || [])
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
  } catch (e) {
    console.error('ML API error:', e.response?.data?.message || e.message);
    return [];
  }
}

// ── DummyJSON fallback (free, no-auth, used when ML not configured) ───────────
async function searchDummy(q, limit = 20) {
  try {
    const { data } = await axios.get('https://dummyjson.com/products/search', {
      params: { q, limit },
      timeout: 8000,
    });
    return (data.products || []).map(item => ({
      externalId:    `d${item.id}`,
      source:        'MercadoLibre',
      name:          item.title,
      price:         Math.round(item.price * 950),
      originalPrice: item.discountPercentage > 5
        ? Math.round(item.price * 950 / (1 - item.discountPercentage / 100))
        : null,
      imageUrl:      item.thumbnail || null,
      permalink:     null,
      brand:         item.brand || '',
      currency:      'CLP',
      scrapedAt:     new Date().toISOString(),
    })).filter(p => p.name && p.price > 0);
  } catch (e) {
    console.error('DummyJSON error:', e.message);
    return [];
  }
}

// ── Amazon PA API 5.0 ─────────────────────────────────────────────────────────
function hmac(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data).digest(encoding);
}

async function searchAmazon(q, limit = 10) {
  const accessKey  = process.env.AMAZON_ACCESS_KEY;
  const secretKey  = process.env.AMAZON_SECRET_KEY;
  const partnerTag = process.env.AMAZON_PARTNER_TAG;
  if (!accessKey || !secretKey || !partnerTag) return [];

  const body = JSON.stringify({
    Keywords: q, SearchIndex: 'All',
    ItemCount: Math.min(limit, 10),
    PartnerTag: partnerTag, PartnerType: 'Associates', Marketplace: 'www.amazon.com',
    Resources: ['Images.Primary.Medium','ItemInfo.Title','ItemInfo.ByLineInfo',
      'Offers.Listings.Price','Offers.Listings.SavingBasis'],
  });

  const now         = new Date();
  const amzDate     = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp   = amzDate.slice(0, 8);
  const host        = 'webservices.amazon.com';
  const region      = 'us-east-1';
  const service     = 'ProductAdvertisingAPI';
  const target      = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';
  const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalHdrs = `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
  const signedHdrs  = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const canonicalReq = ['POST', '/paapi5/searchitems', '', canonicalHdrs, signedHdrs, payloadHash].join('\n');
  const credScope   = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credScope,
    crypto.createHash('sha256').update(canonicalReq).digest('hex')].join('\n');
  const signingKey  = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), region), service), 'aws4_request');
  const signature   = hmac(signingKey, stringToSign, 'hex');

  try {
    const { data } = await axios.post('https://webservices.amazon.com/paapi5/searchitems', body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'amz-1.0',
        'X-Amz-Date': amzDate, 'X-Amz-Target': target,
        'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHdrs}, Signature=${signature}`,
      },
      timeout: 8000,
    });
    return (data?.SearchResult?.Items || []).map(item => {
      const listing = item.Offers?.Listings?.[0];
      const price   = listing?.Price?.Amount || 0;
      const orig    = listing?.SavingBasis?.Amount || null;
      return {
        externalId: item.ASIN, source: 'Amazon',
        name:       String(item.ItemInfo?.Title?.DisplayValue || '').trim().substring(0, 250),
        price, originalPrice: orig && orig > price ? orig : null,
        imageUrl:   item.Images?.Primary?.Medium?.URL || null,
        permalink:  item.DetailPageURL || null,
        brand:      item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue?.trim() || '',
        currency:   'USD', scrapedAt: new Date().toISOString(),
      };
    }).filter(p => p.name && p.price > 0);
  } catch (e) {
    console.error('Amazon error:', e.response?.data?.Errors?.[0]?.Message || e.message);
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.json({ results: [], sources: [], total: 0 });
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const key    = `all|${q.trim().toLowerCase()}|${safeLimit}`;
  const cached = getCached(key);
  if (cached) {
    return res.json({ results: cached, sources: [...new Set(cached.map(r => r.source))], total: cached.length });
  }

  const [mlR, amzR] = await Promise.allSettled([
    searchML(q, safeLimit),
    searchAmazon(q, Math.ceil(safeLimit / 2)),
  ]);

  let results = [
    ...(mlR.status  === 'fulfilled' ? mlR.value  : []),
    ...(amzR.status === 'fulfilled' ? amzR.value : []),
  ].filter(p => p.name && p.price > 0);

  // If ML and Amazon both returned nothing, fall back to DummyJSON
  if (results.length === 0) {
    console.log(`⚠️  ML+Amazon vacíos para "${q}" — usando DummyJSON fallback`);
    results = await searchDummy(q, safeLimit);
  }

  if (results.length > 0) setCache(key, results);
  res.json({ results, sources: [...new Set(results.map(r => r.source))], total: results.length });
};
