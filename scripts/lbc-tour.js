// Visual tour of the new Lucky Biryani screens. Opens a Chromium window the
// user can watch, captures full-page screenshots into scripts/lbc-tour/ so
// they can be reviewed side-by-side with the Zomato recon shots.
//
//   node scripts/lbc-tour.js
//
// The browser stays open at the end; close it to exit the script.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'lbc-tour');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 350 });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });

  // Pre-dismiss the first-visit onboarding overlay so the screenshots show
  // the real surface instead of the welcome modal.
  await ctx.addInitScript(() => {
    try { window.localStorage.setItem('lbc_onboarded_v1', '1'); } catch {}
  });

  const page = await ctx.newPage();

  async function visit(name, url, scrollPx = 0) {
    console.log(`\n→ ${name}  ${url}`);
    await page.goto('http://localhost:3000' + url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2200);
    if (scrollPx > 0) {
      for (let y = 0; y < scrollPx; y += 600) {
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(450);
      }
      // Scroll back to top so the screenshot has the hero
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(500);
    }
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log('   saved', path.relative(process.cwd(), file));
  }

  try {
    await visit('01-home',         '/');
    await visit('02-menu',         '/menu', 1800);  // exercise scroll-spy
    await visit('03-cart-empty',   '/cart');
    await visit('04-club-dark',    '/club');
    await visit('05-help-faq',     '/help');
    await visit('06-book',         '/book');
    await visit('07-orders-list',  '/orders');
    await visit('08-inbox',        '/inbox');  // will show signed-out empty if no JWT
    await visit('09-favorites',    '/favorites');
    await visit('10-refer',        '/refer');
  } catch (e) {
    console.error('Tour failed:', e.message);
  } finally {
    console.log('\nScreenshots written to scripts/lbc-tour/');
    console.log('Browser stays open — close the window to exit.');
    await new Promise((resolve) => browser.on('disconnected', resolve));
  }
})();
