// End-to-end browser test for the Lucky Biryani email-OTP login flow.
//
// Opens the live site, clicks Login, types the email, clicks Send code, then
// PAUSES with the browser open so a human can read the code from their inbox
// and finish the verification step manually.
//
// Run with:
//   node scripts/e2e-login.js
//
// Optional env overrides:
//   SITE_URL  defaults to https://lucky-biryani-web.vercel.app
//   EMAIL     defaults to test@example.com (override via env)

const { chromium } = require('playwright');

const SITE_URL = process.env.SITE_URL || 'https://lucky-biryani-web.vercel.app';
const EMAIL = process.env.EMAIL || 'test@example.com';

function step(n, msg) {
  console.log(`\n[step ${n}] ${msg}`);
}

(async () => {
  console.log(`\nLucky Biryani — automated email-OTP login test`);
  console.log(`  Site:  ${SITE_URL}`);
  console.log(`  Email: ${EMAIL}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 250,
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  try {
    step(1, `Navigating to ${SITE_URL} ...`);
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    console.log('   landed at', page.url());

    step(2, 'Clicking the Login button (top right)...');
    await page.getByRole('button', { name: /^login$/i }).first().click({ timeout: 30_000 });

    step(3, 'Waiting for the login modal to appear...');
    await page.getByRole('heading', { name: /login or sign up/i }).waitFor({ timeout: 15_000 });
    console.log('   modal is open');

    step(4, `Typing email ${EMAIL} ...`);
    const emailInput = page.getByPlaceholder('you@example.com');
    await emailInput.click();
    await emailInput.fill(EMAIL);

    step(5, 'Clicking "Send code" (this triggers the email OTP send)...');
    await page.getByRole('button', { name: /send code/i }).click();

    step(6, 'Waiting for the OTP step to appear...');
    await page.getByRole('heading', { name: /check your inbox/i }).waitFor({ timeout: 15_000 });
    console.log('   OTP screen reached, request sent to API → Resend');

    console.log('\n=========================================================');
    console.log(' ✅ Test reached the OTP screen successfully.');
    console.log('');
    console.log(' Browser will stay OPEN. Now you can:');
    console.log(`   1. Check your email inbox (${EMAIL})`);
    console.log('   2. Copy the 6-digit code from the email');
    console.log('   3. Paste / type it into the OTP boxes in the browser');
    console.log('   4. Watch the auto-submit & redirect');
    console.log('');
    console.log(' Close this terminal (Ctrl+C) when you are done.');
    console.log('=========================================================\n');

    await new Promise((resolve) => {
      page.on('close', resolve);
      ctx.on('close', resolve);
      browser.on('disconnected', resolve);
    });
  } catch (e) {
    console.error('\n❌ Test failed:', e.message);
    console.error('\nKeeping the browser open so you can inspect the page.');
    console.error('Press Ctrl+C in this terminal to exit.\n');
    await new Promise((resolve) => browser.on('disconnected', resolve));
    process.exitCode = 1;
  }
})();
