const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36');
    await page.goto('https://listado.mercadolibre.cl/iphone', { waitUntil: 'domcontentloaded', timeout: 20000 });

    const data = await page.evaluate(() => {
      const cards = document.querySelectorAll('.ui-search-layout__item');
      return [...cards].slice(0, 3).map(card => {
        const link = card.querySelector('a');
        const img = card.querySelector('img');
        const titleEl = card.querySelector('.ui-search-item__title');
        const priceEl = card.querySelector('.andes-money-amount__fraction');
        return {
          title: titleEl ? titleEl.textContent.trim() : 'NO TITLE - ' + card.querySelector('h2, [class*="title"]')?.textContent?.trim(),
          price: priceEl ? priceEl.textContent.trim() : 'NO PRICE - checking: ' + card.innerHTML.match(/\$[\d.]+/)?.[0],
          link: link?.href?.substring(0, 80),
        };
      });
    });

    data.forEach((d, i) => console.log(`Item ${i+1}:`, JSON.stringify(d)));
    await browser.close();
  } catch(e) { console.error('ERROR:', e.message); }
})();
