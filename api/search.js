const axios  = require('axios');
const crypto = require('crypto');

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

async function searchML(q, limit = 20) {
  try {
    const { data } = await axios.get('https://api.mercadolibre.com/sites/MLC/search', {
      params: { q, limit: Math.min(limit, 50) },
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
    console.error('ML API error:', e.message);
    return [];
  }
}

function hmac(key, data, encoding = undefined) {
  return crypto.createHmac('sha256', key).update(data).digest(encoding);
}

async function searchAmazon(q, limit = 10) {
  const accessKey  = process.env.AMAZON_ACCESS_KEY;
  const secretKey  = process.env.AMAZON_SECRET_KEY;
  const partnerTag = process.env.AMAZON_PARTNER_TAG;
  if (!accessKey || !secretKey || !partnerTag) return [];

  const body = JSON.stringify({
    Keywords: q,
    Resources: [
      'Images.Primary.Medium', 'ItemInfo.Title', 'ItemInfo.ByLineInfo',
      'Offers.Listings.Price', 'Offers.Listings.SavingBasis',
    ],
    SearchIndex: 'All',
    ItemCount:   Math.min(limit, 10),
    PartnerTag:  partnerTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
  });

  const now           = new Date();
  const amzDate       = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp     = amzDate.slice(0, 8);
  const host          = 'webservices.amazon.com';
  const region        = 'us-east-1';
  const service       = 'ProductAdvertisingAPI';
  const target        = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';
  const payloadHash   = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalHdrs = `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
  const signedHdrs    = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const canonicalReq  = ['POST', '/paapi5/searchitems', '', canonicalHdrs, signedHdrs, payloadHash].join('\n');
  const credScope     = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign  = ['AWS4-HMAC-SHA256', amzDate, credScope,
    crypto.createHash('sha256').update(canonicalReq).digest('hex')].join('\n');
  const signingKey    = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), region), service), 'aws4_request');
  const signature     = hmac(signingKey, stringToSign, 'hex');

  try {
    const { data } = await axios.post(
      'https://webservices.amazon.com/paapi5/searchitems', body, {
        headers: {
          'Content-Type':     'application/json; charset=utf-8',
          'Content-Encoding': 'amz-1.0',
          'X-Amz-Date':       amzDate,
          'X-Amz-Target':     target,
          'Authorization':    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHdrs}, Signature=${signature}`,
        },
        timeout: 8000,
      }
    );
    return (data?.SearchResult?.Items || [])
      .map(item => {
        const listing       = item.Offers?.Listings?.[0];
        const price         = listing?.Price?.Amount || 0;
        const originalPrice = listing?.SavingBasis?.Amount || null;
        return {
          externalId:    item.ASIN,
          source:        'Amazon',
          name:          String(item.ItemInfo?.Title?.DisplayValue || '').trim().substring(0, 250),
          price,
          originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
          imageUrl:      item.Images?.Primary?.Medium?.URL || null,
          permalink:     item.DetailPageURL || null,
          brand:         item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue?.trim() || '',
          currency:      'USD',
          scrapedAt:     new Date().toISOString(),
        };
      })
      .filter(p => p.name && p.price > 0);
  } catch (e) {
    console.error('Amazon PA API error:', e.response?.data?.Errors?.[0]?.Message || e.message);
    return [];
  }
}

module.exports = async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.json({ results: [], sources: [], total: 0 });
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const key    = `all|${q.trim().toLowerCase()}|${safeLimit}`;
  const cached = getCached(key);
  if (cached) {
    return res.json({ results: cached, sources: [...new Set(cached.map(r => r.source))], total: cached.length });
  }

  try {
    const [mlR, amzR] = await Promise.allSettled([
      searchML(q, safeLimit),
      searchAmazon(q, Math.ceil(safeLimit / 2)),
    ]);
    const results = [
      ...(mlR.status  === 'fulfilled' ? mlR.value  : []),
      ...(amzR.status === 'fulfilled' ? amzR.value : []),
    ].filter(p => p.name && p.price > 0);

    if (results.length > 0) setCache(key, results);
    res.json({ results, sources: [...new Set(results.map(r => r.source))], total: results.length });
  } catch (e) {
    res.status(500).json({ error: e.message, results: [], sources: [], total: 0 });
  }
};
