const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jwsojwoipgsbzyyvddqf.supabase.co',
  'sb_publishable_sKMnqWRjuEMyancMmKgmUA_QFmTiRwJ'
);

async function scrapeFalabella(query) {
  console.log('🟠 Falabella:', query);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.goto(`https://www.falabella.com/falabella-cl/search?Ntt=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 10000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 3000));
    const products = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[href*="/product/"]').forEach((link, i) => {
        if (i >= 12) return;
        const img = link.querySelector('img[src*="falabella"], img[src*="media"]');
        const nameEl = link.querySelector('b, [class*="title"], [class*="name"], [class*="subTitle"]');
        const name = nameEl?.textContent?.trim() || link.getAttribute('aria-label') || '';
        const priceEl = link.querySelector('[class*="price"], [class*="Price"]');
        const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '') || '0';
        if (name && name.length > 5 && img) {
          results.push({ name, price: parseInt(priceText) || 0, image_url: img.src, href: link.href });
        }
      });
      return results;
    });
    for (const p of products) {
      if (!p.name || p.name.length < 3) continue;
      const { error } = await supabase.from('products').upsert({ name: p.name.substring(0, 200), brand: query, store: 'Falabella', price: p.price, image_url: p.image_url, image_emoji: '🟠', category: 'General' }, { onConflict: 'name,store' });
      if (!error) console.log('✅', p.name.substring(0, 50));
    }
  } finally { await browser.close(); }
}

async function scrapeRipley(query) {
  console.log('🔵 Ripley:', query);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.goto(`https://simple.ripley.cl/${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 10000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 3000));
    const products = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[href*="/product"], a[href*="/catalogo"]').forEach((link, i) => {
        if (i >= 12) return;
        const img = link.querySelector('img');
        const nameEl = link.querySelector('[class*="title"], [class*="name"], h3, h2');
        const name = nameEl?.textContent?.trim() || '';
        const priceEl = link.querySelector('[class*="price"], [class*="Price"]');
        const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '') || '0';
        if (name && name.length > 5 && img?.src) {
          results.push({ name, price: parseInt(priceText) || 0, image_url: img.src });
        }
      });
      return results;
    });
    for (const p of products) {
      if (!p.name || p.name.length < 3) continue;
      const { error } = await supabase.from('products').upsert({ name: p.name.substring(0, 200), brand: query, store: 'Ripley', price: p.price, image_url: p.image_url, image_emoji: '🔵', category: 'General' }, { onConflict: 'name,store' });
      if (!error) console.log('✅', p.name.substring(0, 50));
    }
  } finally { await browser.close(); }
}

async function scrapeParis(query) {
  console.log('🟢 Paris:', query);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.goto(`https://www.paris.cl/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 10000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 3000));
    const products = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[href*="/p/"], a[href*="/product"]').forEach((link, i) => {
        if (i >= 12) return;
        const img = link.querySelector('img');
        const nameEl = link.querySelector('[class*="title"], [class*="name"], h3, h2');
        const name = nameEl?.textContent?.trim() || '';
        const priceEl = link.querySelector('[class*="price"]');
        const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '') || '0';
        if (name && name.length > 5 && img?.src) {
          results.push({ name, price: parseInt(priceText) || 0, image_url: img.src });
        }
      });
      return results;
    });
    for (const p of products) {
      if (!p.name || p.name.length < 3) continue;
      const { error } = await supabase.from('products').upsert({ name: p.name.substring(0, 200), brand: query, store: 'Paris', price: p.price, image_url: p.image_url, image_emoji: '🟢', category: 'General' }, { onConflict: 'name,store' });
      if (!error) console.log('✅', p.name.substring(0, 50));
    }
  } finally { await browser.close(); }
}

const queries = ['airpods', 'iphone', 'samsung', 'nike', 'adidas', 'nespresso', 'dyson', 'playstation', 'nintendo', 'kindle'];

async function runAll() {
  for (const q of queries) {
    await scrapeFalabella(q);
    await scrapeRipley(q);
    await scrapeParis(q);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('✅ Scraping completo de las 3 tiendas');
}

runAll().catch(e => console.error('Error:', e.message));