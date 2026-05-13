// Reconnaissance: drives Zomato in a visible Chromium so we can watch its UX
// surface, screenshot every meaningful screen, and use that as the basis for
// a feature-gap analysis against Lucky Biryani.
//
//   node scripts/zomato-recon.js
//
// Outputs into scripts/zomato-recon/*.png plus a feature-inventory.json
// dump of nav items, filter chips, badge labels we saw on each page.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'zomato-recon');
fs.mkdirSync(OUT, { recursive: true });

const inventory = {};

function step(n, msg) {
  console.log(`\n[${String(n).padStart(2, '0')}] ${msg}`);
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 400,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    geolocation: { latitude: 17.385, longitude: 78.4867 },
    permissions: ['geolocation'],
  });

  // Drop the obvious webdriver fingerprint
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await ctx.newPage();

  async function snap(name, fullPage = true) {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage }).catch((e) => console.warn('snap failed', e.message));
    console.log('  → saved', path.relative(process.cwd(), file));
  }

  async function captureChips(label) {
    const chips = await page
      .locator('button, a, span')
      .evaluateAll((els) =>
        els
          .map((e) => e.textContent?.trim() ?? '')
          .filter((t) => t && t.length > 1 && t.length < 40)
          .filter((t) => /^[\w\s&,.+%₹*-]+$/.test(t)),
      )
      .catch(() => []);
    const unique = Array.from(new Set(chips)).slice(0, 120);
    inventory[label] = unique;
  }

  try {
    // 1. Homepage =============================================================
    step(1, 'Opening Zomato homepage');
    await page.goto('https://www.zomato.com/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(4000);
    await snap('01-home');
    await captureChips('home');

    // 2. Pick Hyderabad as the city ==========================================
    step(2, 'Selecting Hyderabad as the city');
    try {
      const cityInput = page.locator('input[placeholder*="location" i], input[placeholder*="delivery" i]').first();
      if (await cityInput.count()) {
        await cityInput.click({ timeout: 5000 });
        await cityInput.fill('Hyderabad');
        await page.waitForTimeout(1500);
        // pick the first suggestion
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.waitForLoadState('domcontentloaded');
      }
    } catch (e) {
      console.warn('  city pick skipped:', e.message);
    }
    await page.waitForTimeout(3500);
    await snap('02-city-selected');

    // 3. Delivery list ========================================================
    step(3, 'Opening delivery list');
    await page.goto('https://www.zomato.com/hyderabad/delivery', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(5000);
    await snap('03-delivery-list');
    await captureChips('delivery_list');

    // 4. Scroll through filters
    step(4, 'Scrolling delivery list for filter chips and cards');
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(700);
    }
    await snap('04-delivery-scrolled');

    // 5. Click first restaurant card ==========================================
    step(5, 'Opening first restaurant detail');
    try {
      const firstCard = page.locator('a[href*="/hyderabad/"]').filter({ hasNot: page.locator('header') }).first();
      await firstCard.scrollIntoViewIfNeeded();
      await firstCard.click({ timeout: 10_000 });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(4000);
      await snap('05-restaurant-detail');
      await captureChips('restaurant_detail');
    } catch (e) {
      console.warn('  restaurant detail skipped:', e.message);
    }

    // 6. Scroll the restaurant page to capture menu, reviews, photos
    step(6, 'Scrolling restaurant page');
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(700);
      await snap(`06-restaurant-scroll-${i}`, false);
    }
    await snap('06-restaurant-full', true);

    // 7. Dining out =========================================================
    step(7, 'Opening dining out section');
    await page.goto('https://www.zomato.com/hyderabad/dine-out', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(4500);
    await snap('07-dineout');
    await captureChips('dineout');

    // 8. Nightlife
    step(8, 'Opening nightlife');
    await page.goto('https://www.zomato.com/hyderabad/nightlife', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(4000);
    await snap('08-nightlife');

    // 9. Gold/Pro landing
    step(9, 'Opening Zomato Gold/Pro landing');
    await page.goto('https://www.zomato.com/gold', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(4000);
    await snap('09-gold');

    // 10. Search ============================================================
    step(10, 'Visiting search page');
    await page.goto('https://www.zomato.com/hyderabad/restaurants', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(4000);
    await snap('10-search');
    await captureChips('search');

  } catch (e) {
    console.error('\nFatal:', e.message);
  } finally {
    fs.writeFileSync(path.join(OUT, 'feature-inventory.json'), JSON.stringify(inventory, null, 2));
    console.log('\nInventory written to scripts/zomato-recon/feature-inventory.json');
    console.log('Screenshots saved under scripts/zomato-recon/');
    console.log('Browser stays open for inspection. Close the window to exit.\n');
    // keep open
    await new Promise((resolve) => browser.on('disconnected', resolve));
  }
})();
