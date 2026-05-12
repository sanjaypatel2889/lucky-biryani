// End-to-end browser test for Lucky Biryani email-OTP login.
//
// Flow:
//   1. Opens Chrome via Playwright
//   2. Navigates to the live site
//   3. Clicks Login
//   4. Types the email
//   5. Clicks "Send code"
//   6. Waits for the OTP screen
//   7. Reads the 6-digit OTP from a file at scripts/.otp (or stdin)
//   8. Types the OTP into the boxes (auto-submits on the 6th digit)
//   9. Reports verification success/failure
//
// Run with:
//   node scripts/e2e-login.js
//
// To deliver the OTP after seeing it in your inbox, write the 6 digits to
// scripts/.otp:
//   echo 123456 > scripts/.otp
// (or just paste the digits into a file at that path; the script polls.)
//
// Optional env overrides:
//   SITE_URL  defaults to https://lucky-biryani-web.vercel.app
//   EMAIL     defaults to 21.693sanjay@gmail.com

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE_URL = process.env.SITE_URL || 'https://lucky-biryani-web.vercel.app';
const EMAIL = process.env.EMAIL || '21.693sanjay@gmail.com';
const OTP_FILE = path.join(__dirname, '.otp');

function step(n, msg) { console.log(`\n[step ${n}] ${msg}`); }

function waitForOtpFile(timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    // Make sure no stale OTP file is hanging around
    try { if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE); } catch {}

    console.log('\nWaiting for OTP...');
    console.log(`Write the 6-digit code to: ${OTP_FILE}`);
    console.log('  Powershell:  Set-Content -NoNewline -Path scripts\\.otp -Value 123456');
    console.log('  CMD/Bash:    echo 123456 > scripts/.otp\n');

    const tick = () => {
      if (Date.now() > deadline) {
        return reject(new Error('Timed out waiting for OTP file (15 min)'));
      }
      try {
        if (fs.existsSync(OTP_FILE)) {
          const raw = fs.readFileSync(OTP_FILE, 'utf8');
          const digits = (raw.match(/\d{6}/) || [])[0];
          if (digits) {
            try { fs.unlinkSync(OTP_FILE); } catch {}
            return resolve(digits);
          }
        }
      } catch {}
      setTimeout(tick, 500);
    };
    tick();
  });
}

(async () => {
  console.log(`\nLucky Biryani - automated email-OTP login test`);
  console.log(`  Site:  ${SITE_URL}`);
  console.log(`  Email: ${EMAIL}\n`);

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  try {
    step(1, `Navigating to ${SITE_URL} ...`);
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });

    step(2, 'Clicking the Login button...');
    await page.getByRole('button', { name: /^login$/i }).first().click({ timeout: 30_000 });

    step(3, 'Waiting for the login modal...');
    await page.getByRole('heading', { name: /login or sign up/i }).waitFor({ timeout: 15_000 });
    console.log('   modal is open');

    step(4, `Typing email: ${EMAIL}`);
    const emailInput = page.getByPlaceholder('you@example.com');
    await emailInput.click();
    await emailInput.fill(EMAIL);

    step(5, 'Clicking "Send code"...');
    await page.getByRole('button', { name: /send code/i }).click();

    step(6, 'Waiting for the OTP screen...');
    await page.getByRole('heading', { name: /check your inbox/i }).waitFor({ timeout: 30_000 });
    console.log('   OTP screen reached, request sent to API -> Brevo');

    console.log('\n========================================================');
    console.log(' OTP request sent. Now check your inbox.');
    console.log(' When you have the 6-digit code, drop it into a file:');
    console.log(`   ${OTP_FILE}`);
    console.log(' (the script will pick it up within 1 second)');
    console.log('========================================================');

    const code = await waitForOtpFile();
    console.log(`\n[step 7] Got OTP: ${code}. Typing into the boxes...`);

    // Click first OTP input then send all six digits via keyboard
    const firstBox = page.locator('input[autocomplete="one-time-code"]').first();
    await firstBox.click();
    await page.keyboard.type(code, { delay: 80 });

    step(8, 'Waiting for verification result (modal closes on success)...');
    await Promise.race([
      page.getByRole('heading', { name: /check your inbox/i }).waitFor({ state: 'detached', timeout: 20_000 }),
      page.getByText(/invalid or expired/i).waitFor({ timeout: 20_000 }),
    ]);

    const stillOnOtp = await page.getByRole('heading', { name: /check your inbox/i }).isVisible().catch(() => false);
    if (stillOnOtp) {
      console.error('\nVerification failed (invalid/expired code). Browser will stay open.');
    } else {
      console.log('\nLOGIN SUCCEEDED. The login modal closed and the user is now signed in.');
      // Try to read the auth token from localStorage to confirm
      try {
        const tok = await page.evaluate(() => localStorage.getItem('lbc_token'));
        if (tok) console.log(`   JWT cached in localStorage: ${tok.slice(0, 32)}...`);
      } catch {}
    }

    console.log('\nBrowser stays open for inspection. Close it when done.');
    await new Promise((resolve) => {
      page.on('close', resolve);
      ctx.on('close', resolve);
      browser.on('disconnected', resolve);
    });
  } catch (e) {
    console.error('\nTest failed:', e.message);
    console.error('\nKeeping the browser open. Close it (or Ctrl+C this terminal) to exit.');
    await new Promise((resolve) => browser.on('disconnected', resolve));
    process.exitCode = 1;
  }
})();
