'use client';

import { useState, useEffect, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { useAuth } from '@/lib/auth-store';

const COUNTRY_CODES = [
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+1',   flag: '🇺🇸', name: 'United States' },
  { code: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore' },
];

const RESEND_SECONDS = 30;

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { loginOTP, verifyOTP } = useAuth();

  const [country, setCountry] = useState(COUNTRY_CODES[0]);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Reset everything when modal closes
  useEffect(() => {
    if (!open) {
      setStep('phone');
      setOtp(['', '', '', '', '', '']);
      setErr('');
      setResendIn(0);
    }
  }, [open]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Auto-focus first OTP box when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      const id = setTimeout(() => otpRefs.current[0]?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [step]);

  if (!open) return null;

  const fullPhone = `${country.code}${phone}`;
  const otpString = otp.join('');
  const otpComplete = otpString.length === 6 && /^\d{6}$/.test(otpString);

  async function send() {
    if (phone.length < 10) return;
    setBusy(true); setErr('');
    try {
      await loginOTP(fullPhone);
      setStep('otp');
      setResendIn(RESEND_SECONDS);
    } catch (e: any) {
      setErr(e?.message || 'Could not send OTP. Please try again.');
    }
    setBusy(false);
  }

  async function resend() {
    if (resendIn > 0 || busy) return;
    await send();
  }

  async function verify(code = otpString) {
    if (code.length !== 6) return;
    setBusy(true); setErr('');
    try {
      await verifyOTP(fullPhone, code);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    }
    setBusy(false);
  }

  function handleOtpChange(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (err) setErr('');
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
    const joined = next.join('');
    if (joined.length === 6) {
      setTimeout(() => verify(joined), 60);
    }
  }

  function handleOtpKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
      const next = [...otp];
      next[i - 1] = '';
      setOtp(next);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      otpRefs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      otpRefs.current[i + 1]?.focus();
    } else if (e.key === 'Enter' && otpComplete) {
      verify();
    }
  }

  function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setOtp(next);
    const lastIdx = Math.min(text.length, 5);
    otpRefs.current[lastIdx]?.focus();
    if (text.length === 6) setTimeout(() => verify(text), 60);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Brand strip */}
        <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-7 py-6">
          <div className="flex items-center gap-2 text-white/90">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 font-display text-xl font-bold">
              L
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-90">Lucky Biryani</p>
              <p className="font-display text-base leading-tight">Hyderabad's most-loved dum biryani</p>
            </div>
          </div>
        </div>

        <div className="px-7 pb-7 pt-6">
          {step === 'phone' ? (
            <>
              <h2 className="font-display text-2xl font-bold text-slate-900">Login or Sign up</h2>
              <p className="mt-1 text-sm text-slate-500">
                We'll send a one-time password to verify your number.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Phone number
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={country.code}
                      onChange={(e) =>
                        setCountry(
                          COUNTRY_CODES.find((c) => c.code === e.target.value) ?? COUNTRY_CODES[0],
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoFocus
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && phone.length >= 10) send();
                      }}
                      placeholder="10-digit number"
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base tracking-wide outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>

                {err && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {err}
                  </div>
                )}

                <button
                  className="w-full rounded-lg bg-brand-600 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  onClick={send}
                  disabled={busy || phone.length < 10}
                >
                  {busy ? 'Sending OTP…' : 'Continue'}
                </button>

                <p className="text-center text-[11px] leading-relaxed text-slate-400">
                  By continuing, you agree to Lucky Biryani's
                  <br />
                  <span className="cursor-pointer text-slate-500 underline">Terms of Service</span>
                  {' '}and{' '}
                  <span className="cursor-pointer text-slate-500 underline">Privacy Policy</span>.
                </p>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setStep('phone');
                  setOtp(['', '', '', '', '', '']);
                  setErr('');
                }}
                className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-brand-600"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h2 className="font-display text-2xl font-bold text-slate-900">Verify OTP</h2>
              <p className="mt-1 text-sm text-slate-500">
                Code sent to{' '}
                <span className="font-semibold text-slate-800">
                  {country.code} {phone}
                </span>{' '}
                <button
                  onClick={() => {
                    setStep('phone');
                    setOtp(['', '', '', '', '', '']);
                    setErr('');
                  }}
                  className="ml-1 font-medium text-brand-600 hover:underline"
                >
                  Edit
                </button>
              </p>

              <div className="mt-6 flex justify-between gap-2">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    maxLength={1}
                    className={`h-14 w-full rounded-lg border-2 bg-white text-center text-2xl font-bold outline-none transition ${
                      err
                        ? 'border-rose-400 text-rose-700'
                        : d
                          ? 'border-brand-500 text-slate-900'
                          : 'border-slate-200 text-slate-400 focus:border-brand-400'
                    } focus:ring-2 focus:ring-brand-100`}
                  />
                ))}
              </div>

              {err && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {err}
                </div>
              )}

              <button
                className="mt-5 w-full rounded-lg bg-brand-600 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                onClick={() => verify()}
                disabled={busy || !otpComplete}
              >
                {busy ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <div className="mt-4 text-center text-sm text-slate-500">
                Didn't receive the code?{' '}
                {resendIn > 0 ? (
                  <span className="text-slate-400">Resend in {resendIn}s</span>
                ) : (
                  <button
                    onClick={resend}
                    className="font-semibold text-brand-600 transition hover:text-brand-700 hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
