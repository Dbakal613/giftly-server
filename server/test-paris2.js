const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36');
  await page.goto('https://www.paris.cl/search/?q=audifonos', { waitUntil: 'networkidle2', timeout: 20000 });
  
  const info = await page.evaluate(() => {
    const pods = document.querySelectorAll('[class*="pod"], [class*="product"], [class*="item"]');
    const links = document.querySelectorAll('a[href*="/p/"]');
    const imgs = document.querySelectorAll('img');
    // Check for any script tags with JSON data
    const scripts = [...document.querySelectorAll('script[type="application/json"], script[id*="data"]')]
      .map(s => s.textContent.substring(0, 200));
    return {
      podsCount: pods.length,
      linksCount: links.length,
      imgsCount: imgs.length,
      firstLink: links[0]?.href?.substring(0, 100),
      scripts: scripts.slice(0, 3),
      bodyText: document.body.innerText.substring(0, 300),
    };
  });
  console.log('Info:', JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
