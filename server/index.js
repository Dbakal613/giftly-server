require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());

// ── Browser singleton ─────────────────────────────────────────────────────────
let browser = null;

async function getBrowser() {
  if (browser) {
    try { await browser.version(); return browser; } catch {}
  }
  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  return browser;
}

getBrowser()
  .then(() => console.log('🌐 Browser listo'))
  .catch(e => console.error('Browser error:', e.message));

// ── In-memory cache (15 min TTL) ──────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

function getCached(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e.data;
}

function setCache(key, data) {
  // Keep cache bounded
  if (cache.size >= 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0][0];
    cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

// ── Page helper ───────────────────────────────────────────────────────────────
async function newPage() {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  });
  // Remove webdriver flag (basic bot evasion)
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return page;
}

// ── Normalization ─────────────────────────────────────────────────────────────
function normalize(source, r) {
  const price = Math.round(
    Number(String(r.price || '0').replace(/[^0-9]/g, '')) || 0
  );
  const origPrice = r.originalPrice
    ? Math.round(Number(String(r.originalPrice).replace(/[^0-9]/g, '')) || 0)
    : null;
  return {
    externalId:    String(r.externalId || ''),
    source,
    name:          String(r.name || '').trim().substring(0, 250),
    price,
    originalPrice: origPrice && origPrice > price ? origPrice : null,
    imageUrl:      r.imageUrl || r.image_url || null,
    permalink:     r.permalink || r.href || null,
    brand:         String(r.brand || '').trim(),
    currency:      'CLP',
    scrapedAt:     new Date().toISOString(),
  };
}

// ── MercadoLibre ──────────────────────────────────────────────────────────────
async function searchML(q, limit = 20) {
  const page = await newPage();
  try {
    await page.goto(
      `https://listado.mercadolibre.cl/${encodeURIComponent(q.replace(/\s+/g, '-'))}`,
      { waitUntil: 'domcontentloaded', timeout: 15000 }
    );
    await page.waitForSelector('.ui-search-layout__item, .results-item', { timeout: 8000 }).catch(() => {});

    const products = await page.evaluate((maxItems) => {
      // Try __NEXT_DATA__ (ML sometimes uses Next.js)
      const nd = window.__NEXT_DATA__;
      if (nd) {
        try {
          const items =
            nd.props?.pageProps?.dehydratedState?.queries?.find(q => q.queryKey?.[0] === 'search')?.state?.data?.results ||
            nd.props?.pageProps?.results || [];
          if (items.length > 0) {
            return items.slice(0, maxItems).map(p => ({
              externalId: p.id || '',
              name:       p.title || '',
              price:      p.price || 0,
              originalPrice: p.original_price || null,
              imageUrl:   p.thumbnail || '',
              permalink:  p.permalink || '',
              brand:      p.attributes?.find(a => a.id === 'BRAND')?.value_name || '',
            }));
          }
        } catch {}
      }
      // DOM fallback
      const results = [];
      document.querySelectorAll('.ui-search-layout__item, .results-item').forEach((card, i) => {
        if (i >= maxItems) return;
        const link    = card.querySelector('a');
        const img     = card.querySelector('img');
        const nameEl  = card.querySelector('h2, .ui-search-item__title, [class*="title"]');
        const priceEl = card.querySelector('.andes-money-amount__fraction, .price-tag-fraction');
        const origEl  = card.querySelector('.andes-money-amount--previous .andes-money-amount__fraction');
        const name    = nameEl?.textContent?.trim() || '';
        const price   = parseInt((priceEl?.textContent || '0').replace(/\./g, '').replace(/[^0-9]/g, '')) || 0;
        const origPrice = origEl ? parseInt((origEl.textContent || '0').replace(/\./g, '').replace(/[^0-9]/g, '')) || null : null;
        if (name && price > 0) {
          results.push({
            externalId:    link?.href?.match(/MLC-?(\d+)/)?.[1] || String(i),
            name,
            price,
            originalPrice: origPrice,
            imageUrl:      img?.src || img?.dataset?.src || '',
            permalink:     link?.href || '',
            brand:         '',
          });
        }
      });
      return results;
    }, limit);

    return products
      .filter(p => p.name && p.price > 0)
      .map(p => normalize('MercadoLibre', p));
  } catch (e) {
    console.error('ML error:', e.message);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Falabella ─────────────────────────────────────────────────────────────────
async function searchFalabella(q, limit = 10) {
  const page = await newPage();
  try {
    await page.goto(
      `https://www.falabella.com/falabella-cl/search?Ntt=${encodeURIComponent(q)}`,
      { waitUntil: 'domcontentloaded', timeout: 15000 }
    );
    await page.waitForSelector('a[href*="/product/"]', { timeout: 8000 }).catch(() => {});

    const products = await page.evaluate((maxItems) => {
      function extractPrice(el) {
        // Find price numbers like $19.990 using regex, take the minimum (current offer)
        const text = el?.textContent || '';
        const matches = text.match(/\$\s*[\d.]+/g) || [];
        const prices = matches
          .map(s => parseInt(s.replace(/[^0-9]/g, '')) )
          .filter(p => p > 1000 && p < 100000000);
        return prices.length > 0 ? { price: Math.min(...prices), originalPrice: prices.length > 1 ? Math.max(...prices) : null } : { price: 0, originalPrice: null };
      }

      const seen = new Set();
      const results = [];
      document.querySelectorAll('a[href*="/product/"]').forEach((link) => {
        if (results.length >= maxItems) return;
        if (seen.has(link.href)) return;
        seen.add(link.href);

        const img   = link.querySelector('img');
        const brand = link.querySelector('[class*="brandName"], [class*="brand"]')?.textContent?.trim() || '';
        // Name: all matching els, skip the first if it's the brand text
        const nameEls = [...link.querySelectorAll('b, [class*="subTitle"], [class*="title"], [class*="name"]')];
        let name = '';
        const skipWords = /^(por\s|gratis|nuevo|oferta|envío|llega|retira|patrocinado|cupon|cmr|online|cyber)/i;
        for (const el of nameEls) {
          const t = el.textContent.trim();
          if (t && t !== brand && t.length > 10 && !skipWords.test(t)) {
            name = t; break;
          }
        }
        if (!name) name = link.getAttribute('aria-label') || '';

        const priceEl = link.querySelector('[class*="price"], [class*="Price"]');
        const { price, originalPrice } = extractPrice(priceEl);

        if (name.length > 4 && img?.src && price > 0) {
          results.push({ name, price, originalPrice, imageUrl: img.src, permalink: link.href, brand });
        }
      });
      return results;
    }, limit);

    return products.map((p, i) => normalize('Falabella', { ...p, externalId: `fa_${q}_${i}` }));
  } catch (e) {
    console.error('Falabella error:', e.message);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Paris ─────────────────────────────────────────────────────────────────────
async function searchParis(q, limit = 10) {
  const page = await newPage();
  try {
    await page.goto(
      `https://www.paris.cl/search?q=${encodeURIComponent(q)}`,
      { waitUntil: 'domcontentloaded', timeout: 15000 }
    );
    await page.waitForSelector('a[href*="/p/"], [class*="pod"], [class*="product"]', { timeout: 8000 }).catch(() => {});

    const products = await page.evaluate((maxItems) => {
      // Try __NEXT_DATA__ first
      const nd = window.__NEXT_DATA__;
      if (nd) {
        try {
          const hits =
            nd.props?.pageProps?.searchResponse?.hits ||
            nd.props?.pageProps?.products ||
            nd.props?.pageProps?.searchResults?.products || [];
          if (hits.length > 0) {
            return hits.slice(0, maxItems).map(p => ({
              externalId:    p.productId || p.id || p.partNumber || '',
              name:          p.name || p.displayName || p.productName || '',
              price:         p.prices?.normalPrice?.value || p.offerPrice || p.price || 0,
              originalPrice: p.prices?.originalPrice?.value || p.listPrice || null,
              imageUrl:      p.images?.[0]?.url || p.imageUrl || p.thumbnail || '',
              permalink:     p.pdpUrl ? `https://www.paris.cl${p.pdpUrl}` : (p.url ? `https://www.paris.cl${p.url}` : null),
              brand:         p.brand || '',
            }));
          }
        } catch {}
      }
      // DOM fallback
      const results = [];
      document.querySelectorAll('a[href*="/p/"]').forEach((link, i) => {
        if (i >= maxItems) return;
        const img     = link.querySelector('img');
        const nameEl  = link.querySelector('[class*="title"], [class*="name"], h3, h2');
        const name    = nameEl?.textContent?.trim() || '';
        const priceEl = link.querySelector('[class*="price"]');
        const price   = parseInt((priceEl?.textContent || '0').replace(/[^0-9]/g, '')) || 0;
        if (name && img?.src) {
          results.push({ name, price, imageUrl: img.src, permalink: link.href });
        }
      });
      return results;
    }, limit);

    return products
      .filter(p => p.name && p.price > 0)
      .map((p, i) => normalize('Paris', { ...p, externalId: p.externalId || `pa_${q}_${i}` }));
  } catch (e) {
    console.error('Paris error:', e.message);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Ripley ────────────────────────────────────────────────────────────────────
async function searchRipley(q, limit = 10) {
  const page = await newPage();
  try {
    await page.goto(
      `https://simple.ripley.cl/search?query=${encodeURIComponent(q)}`,
      { waitUntil: 'domcontentloaded', timeout: 15000 }
    );
    await page.waitForSelector('[class*="catalog-item"], [class*="CatalogItem"]', { timeout: 8000 }).catch(() => {});

    const products = await page.evaluate((maxItems) => {
      // Try __NEXT_DATA__ first
      const nd = window.__NEXT_DATA__;
      if (nd) {
        try {
          const items =
            nd.props?.pageProps?.searchResult?.products ||
            nd.props?.pageProps?.catalog?.products ||
            nd.props?.pageProps?.products || [];
          if (items.length > 0) {
            return items.slice(0, maxItems).map(p => ({
              externalId:    p.partNumber || p.id || '',
              name:          p.name || p.displayName || '',
              price:         p.offerPrice || p.listPrice || p.price || 0,
              originalPrice: p.listPrice !== p.offerPrice ? p.listPrice : null,
              imageUrl:      p.primaryImageUrl || p.images?.[0]?.url || '',
              permalink:     p.slug ? `https://simple.ripley.cl${p.slug}` : null,
              brand:         p.brand || '',
            }));
          }
        } catch {}
      }
      // DOM fallback
      const results = [];
      document.querySelectorAll('[class*="catalog-item"] a, [class*="CatalogItem"] a').forEach((link, i) => {
        if (i >= maxItems) return;
        const img     = link.querySelector('img');
        const nameEl  = link.querySelector('[class*="title"], [class*="name"], h3');
        const name    = nameEl?.textContent?.trim() || '';
        const priceEl = link.querySelector('[class*="internet-price"], [class*="offer-price"], [class*="price"]');
        const price   = parseInt((priceEl?.textContent || '0').replace(/[^0-9]/g, '')) || 0;
        const href    = link.getAttribute('href') || '';
        if (name && img?.src) {
          results.push({
            name,
            price,
            imageUrl: img.src,
            permalink: href.startsWith('http') ? href : `https://simple.ripley.cl${href}`,
          });
        }
      });
      return results;
    }, limit);

    return products
      .filter(p => p.name && p.price > 0)
      .map((p, i) => normalize('Ripley', { ...p, externalId: p.externalId || `ri_${q}_${i}` }));
  } catch (e) {
    console.error('Ripley error:', e.message);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Parallel multi-retailer search (with cache) ───────────────────────────────
async function searchAll(q, limit) {
  const key = `all|${q.trim().toLowerCase()}|${limit}`;
  const cached = getCached(key);
  if (cached) {
    console.log(`⚡ Cache hit: "${q}"`);
    return cached;
  }

  console.log(`🔍 Buscando en todas las tiendas: "${q}"`);
  const t = Date.now();

  const [mlR, faR, paR, riR] = await Promise.allSettled([
    searchML(q, limit),
    searchFalabella(q, Math.ceil(limit / 2)),
    searchParis(q, Math.ceil(limit / 2)),
    searchRipley(q, Math.ceil(limit / 2)),
  ]);

  const results = [
    ...(mlR.status === 'fulfilled' ? mlR.value : []),
    ...(faR.status === 'fulfilled' ? faR.value : []),
    ...(paR.status === 'fulfilled' ? paR.value : []),
    ...(riR.status === 'fulfilled' ? riR.value : []),
  ].filter(p => p.name && p.price > 0);

  console.log(
    `✅ ${results.length} resultados en ${Date.now() - t}ms` +
    ` — ML:${mlR.value?.length ?? '✗'} FA:${faR.value?.length ?? '✗'}` +
    ` PA:${paR.value?.length ?? '✗'} RI:${riR.value?.length ?? '✗'}`
  );

  if (results.length > 0) setCache(key, results);
  return results;
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) =>
  res.json({ status: 'Giftly server v2 🎁', stores: ['MercadoLibre', 'Falabella', 'Paris', 'Ripley'] })
);

// Multi-retailer search (used for explicit text queries)
app.get('/search', async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.json({ results: [], sources: [], total: 0 });
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  try {
    const results = await searchAll(q, safeLimit);
    const sources = [...new Set(results.map(r => r.source))];
    res.json({ results, sources, total: results.length });
  } catch (e) {
    console.error('Search error:', e.message);
    res.status(500).json({ error: e.message, results: [], sources: [], total: 0 });
  }
});

// ML-only search (used for fast category browsing)
app.get('/search/ml', async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.json({ results: [] });
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const key = `ml|${q.trim().toLowerCase()}|${safeLimit}`;
  const cached = getCached(key);
  if (cached) return res.json({ results: cached });
  try {
    const results = await searchML(q, safeLimit);
    if (results.length > 0) setCache(key, results);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message, results: [] });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Giftly server v2 en puerto ${PORT}`));
