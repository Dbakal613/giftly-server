const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36');
  await page.goto('https://www.paris.cl/search?q=audifonos', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  const url = page.url();
  const title = await page.title();
  const nd = await page.evaluate(() => {
    const nd = window.__NEXT_DATA__;
    if (!nd) return 'NO __NEXT_DATA__';
    const props = nd.props?.pageProps;
    return JSON.stringify({
      keys: Object.keys(props || {}),
      searchRespKeys: Object.keys(props?.searchResponse || {}),
      hitsLen: props?.searchResponse?.hits?.length,
      productsLen: props?.products?.length,
    });
  });
  console.log('URL:', url);
  console.log('Title:', title);
  console.log('NextData:', nd);
  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
