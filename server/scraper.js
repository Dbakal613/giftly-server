const puppeteer = require('puppeteer');

async function scrapeFalabella(query) {
  console.log(`🔍 Buscando "${query}" en Falabella...`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  await page.goto(`https://www.falabella.com.cl/falabella-cl/search?Ntt=${encodeURIComponent(query)}&sortBy=1`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await page.waitForSelector('.jsx-1308123651', { timeout: 10000 }).catch(() => {});

  const products = await page.evaluate(() => {
    const items = [];
    const cards = document.querySelectorAll('[class*="pod-"], [class*="product-"], .search-results-4-grid article');
    
    cards.forEach((card, i) => {
      if (i >= 10) return;
      
      const name = card.querySelector('[class*="pod-subTitle"], [class*="product-title"], h2, h3')?.textContent?.trim();
      const price = card.querySelector('[class*="prices-0"], [class*="price"], [class*="internet-price"]')?.textContent?.trim();
      const image = card.querySelector('img')?.src;
      const link = card.querySelector('a')?.href;
      const brand = card.querySelector('[class*="pod-title"], [class*="brand"]')?.textContent?.trim();
      
      if (name && price) {
        items.push({ name, price, image, link, brand });
      }
    });
    
    return items;
  });

  await browser.close();
  
  console.log(`✅ Encontrados ${products.length} productos`);
  return products;
}

// Test
scrapeFalabella('airpods').then(products => {
  console.log(JSON.stringify(products, null, 2));
}).catch(e => console.error('Error:', e.message));
