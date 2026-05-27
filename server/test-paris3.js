const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36');
  
  // Intercept and log XHR requests
  const xhrUrls = [];
  page.on('response', async (response) => {
    const url = response.url();
    if ((url.includes('search') || url.includes('product') || url.includes('api')) && response.status() === 200) {
      xhrUrls.push(url.substring(0, 120));
    }
  });
  
  await page.goto('https://www.paris.cl/search/?q=audifonos', { waitUntil: 'networkidle2', timeout: 20000 });
  
  console.log('XHR URLs found:', xhrUrls.slice(0, 10));
  
  const pods = await page.evaluate(() => {
    const allPods = document.querySelectorAll('[class*="pod"]');
    const first = allPods[0];
    return {
      totalPods: allPods.length,
      firstPodHtml: first?.innerHTML?.substring(0, 500),
      firstPodClass: first?.className,
    };
  });
  console.log('Pods info:', JSON.stringify(pods, null, 2));
  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
