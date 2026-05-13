import { test, expect } from './fixtures';
import { DEMO, fetchOtp } from './helpers';

test.describe('Email-OTP login flow', () => {
  test('full happy path through the modal', async ({ page }) => {
    await page.goto('/');

    // Open modal from the header
    await page.getByRole('button', { name: /^login$/i }).first().click();
    await expect(page.getByRole('heading', { name: /login or sign up/i })).toBeVisible();

    // Step 1 — email
    await page.getByPlaceholder('you@example.com').fill(DEMO.customer);
    await page.getByRole('button', { name: /send code/i }).click();

    // Step 2 — OTP
    await expect(page.getByRole('heading', { name: /check your inbox/i })).toBeVisible({ timeout: 15_000 });

    // give the API a beat to write the NotificationLog row
    await page.waitForTimeout(500);
    const code = fetchOtp(DEMO.customer);

    // Type into the 6 inputs; the last digit auto-submits.
    const first = page.locator('input[autocomplete="one-time-code"]').first();
    await first.click();
    await page.keyboard.type(code, { delay: 50 });

    // Modal closes on success and a token is in localStorage
    await expect(page.getByRole('heading', { name: /check your inbox/i })).toHaveCount(0, { timeout: 15_000 });
    const token = await page.evaluate(() => localStorage.getItem('lbc_token'));
    expect(token).toBeTruthy();

    // Header shows the user's first name
    await expect(page.locator('header').getByText(/Hi, /)).toBeVisible();
  });

  test('rejects an invalid OTP', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^login$/i }).first().click();
    await page.getByPlaceholder('you@example.com').fill(DEMO.customer);
    await page.getByRole('button', { name: /send code/i }).click();
    await expect(page.getByRole('heading', { name: /check your inbox/i })).toBeVisible();

    const first = page.locator('input[autocomplete="one-time-code"]').first();
    await first.click();
    await page.keyboard.type('000000', { delay: 30 });

    // The modal surfaces the API error code "invalid_otp" verbatim. We stay on
    // the OTP step; modal must NOT close.
    await expect(page.getByRole('heading', { name: /check your inbox/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/invalid_otp|invalid or expired/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Auth API', () => {
  test('OTP send → verify → /me round trip', async ({ request }) => {
    const send = await request.post('/api/v1/auth/otp/send', {
      data: { email: DEMO.customer },
    });
    expect(send.ok()).toBeTruthy();

    // brief pause so the log row settles
    await new Promise((r) => setTimeout(r, 400));
    const otp = fetchOtp(DEMO.customer);

    const verify = await request.post('/api/v1/auth/otp/verify', {
      data: { email: DEMO.customer, otp },
    });
    expect(verify.ok()).toBeTruthy();
    const { token, user } = await verify.json();
    expect(token).toMatch(/^eyJ/); // JWT
    expect(user.email).toBe(DEMO.customer);

    const me = await request.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.ok()).toBeTruthy();
    const meBody = await me.json();
    expect(meBody.user.email).toBe(DEMO.customer);
  });
});
