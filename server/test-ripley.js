const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36');

  // Capture JSON API calls
  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') && !url.includes('google') && !url.includes('fonts')) {
      try {
        const json = await response.json();
        if (Array.isArray(json) || json.products || json.results || json.items) {
          apiCalls.push({ url: url.substring(0, 150), count: (json.products || json.results || json.items || json).length });
        }
      } catch {}
    }
  });

  await page.goto('https://simple.ripley.cl/search?query=audifonos', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Product API calls:', JSON.stringify(apiCalls, null, 2));

  const info = await page.evaluate(() => {
    const nd = window.__NEXT_DATA__;
    return {
      hasNextData: !!nd,
      nextDataKeys: nd ? Object.keys(nd.props?.pageProps || {}).slice(0, 10) : [],
      catalogItems: document.querySelectorAll('[class*="catalog-item"]').length,
      url: location.href,
    };
  });
  console.log('Info:', JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
