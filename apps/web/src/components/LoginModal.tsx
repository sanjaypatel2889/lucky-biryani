'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-store';

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { loginOTP, verifyOTP } = useAuth();
  const [phone, setPhone] = useState('+919999000003');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return null;

  async function send() {
    setBusy(true); setErr('');
    try {
      const r = await loginOTP(phone);
      if (r.devOtp) setHint(`Dev OTP: ${r.devOtp}`);
      setStep('otp');
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }
  async function verify() {
    setBusy(true); setErr('');
    try {
      await verifyOTP(phone, otp, name || undefined);
      onClose();
      setStep('phone'); setOtp(''); setHint('');
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl font-bold text-brand-700">Login or sign up</h2>
        <p className="mt-1 text-sm text-slate-500">We'll send you a one-time password.</p>

        {step === 'phone' ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
            </div>
            <button className="btn-primary w-full" onClick={send} disabled={busy || !phone}>
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Name (first time only)</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="label">OTP</label>
              <input className="input tracking-widest" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" maxLength={6} />
            </div>
            {hint && <p className="text-xs text-emerald-700">{hint}</p>}
            <button className="btn-primary w-full" onClick={verify} disabled={busy || otp.length !== 6}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button className="btn-ghost w-full text-sm" onClick={() => setStep('phone')}>Change phone</button>
          </div>
        )}
        {err && <p className="mt-3 text-sm text-rose-600">⚠ {err}</p>}
      </div>
    </div>
  );
}
