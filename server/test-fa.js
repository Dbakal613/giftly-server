const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36');
  await page.goto('https://www.falabella.com/falabella-cl/search?Ntt=audifonos', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));

  const data = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/product/"]')].slice(0, 3);
    return links.map(link => {
      const allText = link.innerText;
      const img = link.querySelector('img');
      const brand = link.querySelector('[class*="brandName"], [class*="brand"]');
      const priceEls = link.querySelectorAll('[class*="price"], [class*="Price"]');
      const priceTexts = [...priceEls].map(el => el.textContent.trim());
      const nameEls = link.querySelectorAll('b, [class*="subTitle"], [class*="title"], [class*="name"]');
      const nameTexts = [...nameEls].map(el => el.textContent.trim());
      return {
        allText: allText.substring(0, 200),
        brand: brand?.textContent?.trim(),
        priceTexts,
        nameTexts,
        img_src: img?.src?.substring(0, 60),
        href: link.href.substring(0, 80),
      };
    });
  });

  data.forEach((d, i) => {
    console.log(`\n--- Item ${i+1} ---`);
    console.log('allText:', JSON.stringify(d.allText));
    console.log('brand:', d.brand);
    console.log('nameTexts:', d.nameTexts);
    console.log('priceTexts:', d.priceTexts);
  });

  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
