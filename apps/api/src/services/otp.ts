// In-memory OTP store. Production should use Redis with TTL.
// Identifier is the user's email address.

import { notify } from './notify';

type Entry = { otp: string; expiresAt: number; attempts: number };
const store = new Map<string, Entry>();

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const otp = {
  async send(email: string) {
    const code = randomDigits();
    store.set(email, { otp: code, expiresAt: Date.now() + TTL_MS, attempts: 0 });
    await notify.email(
      email,
      `${code} is your Lucky Biryani login code`,
      otpEmailHtml(code),
    );
    return { sent: true };
  },

  verify(email: string, code: string): boolean {
    const e = store.get(email);
    if (!e) return false;
    if (Date.now() > e.expiresAt) {
      store.delete(email);
      return false;
    }
    e.attempts++;
    if (e.attempts > MAX_ATTEMPTS) {
      store.delete(email);
      return false;
    }
    if (e.otp !== code) return false;
    store.delete(email);
    return true;
  },
};

function randomDigits(n = 6) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function otpEmailHtml(code: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fbf6ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.05);">
    <div style="background:linear-gradient(135deg,#f97316 0%,#c2410c 100%);padding:28px 32px;color:#fff;">
      <div style="font-size:11px;letter-spacing:3px;font-weight:700;opacity:0.9;text-transform:uppercase;">Lucky Biryani</div>
      <div style="font-size:22px;margin-top:4px;font-family:Georgia,serif;">Hyderabad's most-loved dum biryani</div>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Your login code</h1>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.5;">
        Enter this 6-digit code in the login window to finish signing in.
      </p>
      <div style="font-size:36px;font-weight:800;letter-spacing:12px;text-align:center;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:18px;color:#c2410c;font-family:'Courier New',monospace;">
        ${code}
      </div>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
        This code is valid for <strong>5 minutes</strong>. If you didn't request it, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center;">
      © Lucky Biryani Centre · Banjara Hills, Hyderabad
    </div>
  </div>
</body></html>`;
}
