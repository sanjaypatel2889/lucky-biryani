import { execSync } from 'child_process';
import { Page, expect } from '@playwright/test';

export const API = process.env.API_URL || 'http://localhost:4000';

export const DEMO = {
  customer: 'customer@lucky.test',
  admin:    'admin@lucky.test',
  owner:    'owner@lucky.test',
  rider:    'rider1@lucky.test',
};

// Pull the latest 6-digit OTP for an email out of the API's NotificationLog
// table. Works when no real email provider is configured (BREVO/RESEND unset)
// — which is the dev default.
export function fetchOtp(email: string): string {
  const out = execSync(`npx tsx scripts/get-otp.ts ${email}`, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const m = out.match(/\d{6}/);
  if (!m) throw new Error(`No OTP found for ${email}. Raw: ${out}`);
  return m[0];
}

// Send + verify OTP through the API directly, then drop the token into
// localStorage so the next navigation is authenticated. Faster than driving
// the modal for every test that just needs a logged-in starting point.
export async function loginAs(page: Page, email: string) {
  const send = await page.request.post(`${API}/api/v1/auth/otp/send`, {
    data: { email },
  });
  expect(send.ok(), `OTP send failed: ${send.status()}`).toBeTruthy();

  // Tiny pause so the notification row lands before we read it back
  await page.waitForTimeout(300);
  const otp = fetchOtp(email);

  const verify = await page.request.post(`${API}/api/v1/auth/otp/verify`, {
    data: { email, otp },
  });
  expect(verify.ok(), `OTP verify failed: ${verify.status()}`).toBeTruthy();
  const { token, user } = await verify.json();

  // Seed both storages so client & SSR pick it up.
  await page.addInitScript(([t]) => {
    window.localStorage.setItem('lbc_token', t as string);
  }, [token]);

  return { token, user };
}
