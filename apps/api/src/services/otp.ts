// In-memory OTP store. Production should use Redis with TTL.

import { notify } from './notify';

type Entry = { otp: string; expiresAt: number; attempts: number };
const store = new Map<string, Entry>();

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const otp = {
  async send(phone: string) {
    // Always generate a fresh random 6-digit OTP. Never echo it back to the
    // client — the user sees it on their phone via Fast2SMS.
    const code = randomDigits();
    store.set(phone, { otp: code, expiresAt: Date.now() + TTL_MS, attempts: 0 });
    await notify.sms(phone, 'OTP', { otp: code });
    return { sent: true };
  },

  verify(phone: string, code: string): boolean {
    const e = store.get(phone);
    if (!e) return false;
    if (Date.now() > e.expiresAt) {
      store.delete(phone);
      return false;
    }
    e.attempts++;
    if (e.attempts > MAX_ATTEMPTS) {
      store.delete(phone);
      return false;
    }
    if (e.otp !== code) return false;
    store.delete(phone);
    return true;
  },
};

function randomDigits(n = 6) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}
