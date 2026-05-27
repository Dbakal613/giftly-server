const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36');

  // Capture all API calls
  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') && !url.includes('google') && !url.includes('fonts')) {
      try {
        const json = await response.json();
        apiCalls.push({ url: url.substring(0, 100), keys: Object.keys(json).slice(0, 5) });
      } catch {}
    }
  });

  await page.goto('https://www.paris.cl/search/?q=audifonos', { waitUntil: 'networkidle0', timeout: 25000 });
  await new Promise(r => setTimeout(r, 3000));

  console.log('API calls:', JSON.stringify(apiCalls.slice(0, 10), null, 2));
  
  // Check for any product-like elements
  const counts = await page.evaluate(() => ({
    pods: document.querySelectorAll('[class*="pod"]').length,
    links: document.querySelectorAll('a[href*="/p/"]').length,
    imgs: document.querySelectorAll('img[src*="paris"]').length,
    prices: document.querySelectorAll('[class*="price"]').length,
    bodyLen: document.body.innerText.length,
  }));
  console.log('Element counts:', counts);
  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
