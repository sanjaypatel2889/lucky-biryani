'use client';

// Lucky Club — subscription tier landing page. Shows the plan, perks, and a
// one-click enroll. Stub billing in dev (no Razorpay round-trip).

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { LoginModal } from '@/components/LoginModal';

type Plan = {
  id: string;
  code: 'CLUB_MONTHLY' | 'CLUB_ANNUAL';
  name: string;
  description: string;
  pricePaisa: number;
  durationDays: number;
  perkFreeDelivery: boolean;
  perkDiscountPct: number;
  perkPointsMultiplier: number;
};

type Membership = { tier: string; until: string | null; active: boolean };

export default function ClubPage() {
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mem, setMem] = useState<Membership | null>(null);
  const [picked, setPicked] = useState<'CLUB_MONTHLY' | 'CLUB_ANNUAL'>('CLUB_ANNUAL');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  async function load() {
    const p = await api<{ plans: Plan[] }>('/api/v1/membership/plans');
    setPlans(p.plans);
    if (user) {
      const m = await api<Membership>('/api/v1/membership/me');
      setMem(m);
    }
  }
  useEffect(() => { void load(); }, [user?.id]);

  async function enroll() {
    if (!user) { setLoginOpen(true); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api<{ planName: string; until: string }>('/api/v1/membership/enroll', {
        method: 'POST',
        body: JSON.stringify({ planCode: picked }),
      });
      setDone(`${r.planName} active until ${new Date(r.until).toLocaleDateString()}`);
      await load();
      await refresh();
    } catch (e: any) {
      setErr(e?.detail?.error ?? e?.message ?? 'Could not enroll');
    }
    setBusy(false);
  }

  async function cancel() {
    if (!confirm('Cancel your membership? Perks lapse immediately.')) return;
    setBusy(true);
    try {
      await api('/api/v1/membership/cancel', { method: 'POST' });
      setDone('Membership cancelled');
      await load();
      await refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
            ★ Lucky Club
          </span>
          <h1 className="mt-4 display text-4xl font-bold text-stone-900 md:text-5xl">
            Every order, a little luckier.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-stone-600">
            Free delivery, 5% off every order, double loyalty points. One subscription, every meal.
          </p>
        </div>

        {mem?.active ? (
          <div className="mt-8 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 p-6 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⭐</span>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] opacity-80">You're a Lucky Club member</div>
                <div className="display text-xl font-bold">Active until {new Date(mem.until!).toLocaleDateString()}</div>
              </div>
            </div>
            <button onClick={cancel} disabled={busy} className="mt-4 rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur hover:bg-white/30">
              Cancel membership
            </button>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {PERKS.map((p) => (
                <div key={p.title} className="card p-5">
                  <div className="text-3xl">{p.emoji}</div>
                  <h3 className="mt-2 display text-lg font-bold text-stone-900">{p.title}</h3>
                  <p className="mt-1 text-sm text-stone-600">{p.blurb}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {plans.map((p) => {
                const monthlyEffective = p.code === 'CLUB_ANNUAL'
                  ? Math.round((p.pricePaisa / 100) / 12)
                  : Math.round(p.pricePaisa / 100);
                const isPicked = picked === p.code;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPicked(p.code)}
                    className={`card flex flex-col items-start gap-2 p-5 text-left transition ${isPicked ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-200' : 'hover:border-stone-300'}`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <h3 className="display text-xl font-bold text-stone-900">{p.name}</h3>
                      {p.code === 'CLUB_ANNUAL' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Save 16%</span>}
                    </div>
                    <p className="text-sm text-stone-600">{p.description}</p>
                    <div className="mt-2">
                      <span className="display text-3xl font-bold text-stone-900">₹{Math.round(p.pricePaisa / 100)}</span>
                      <span className="ml-1 text-sm text-stone-500">/ {p.code === 'CLUB_ANNUAL' ? 'year' : 'month'}</span>
                      {p.code === 'CLUB_ANNUAL' && <span className="ml-2 text-xs text-stone-500">= ₹{monthlyEffective}/mo</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col items-center">
              <button
                onClick={enroll}
                disabled={busy || plans.length === 0}
                className="rounded-full bg-gradient-to-br from-amber-500 to-amber-700 px-8 py-3.5 text-base font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
              >
                {busy ? 'Activating…' : user ? 'Join Lucky Club' : 'Log in to join'}
              </button>
              {err && <p className="mt-3 text-sm text-rose-600">⚠ {err}</p>}
              {done && <p className="mt-3 text-sm font-medium text-emerald-700">✓ {done}</p>}
              <p className="mt-3 text-xs text-stone-400">Cancel anytime. Free delivery applies up to our 6 km service radius.</p>
            </div>
          </>
        )}

        <div className="mt-12 rounded-2xl bg-stone-50 p-6 text-sm text-stone-700">
          <h3 className="font-semibold text-stone-900">How the math works</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>An average ₹400 order saves you ₹50 (free delivery + 5% off) + earns 80 points (₹80 future credit).</li>
            <li>2 orders/week × 4 weeks = roughly ₹500 in savings + 600 loyalty points per month.</li>
            <li>Annual plan pays for itself in ~4 orders. Monthly: ~2.</li>
          </ul>
        </div>
      </main>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}

const PERKS = [
  { emoji: '🛵', title: 'Free delivery, always', blurb: 'Any order, any distance inside our zone. No minimum.' },
  { emoji: '💸', title: '5% off every order',    blurb: 'Stacks with FIRST50, OFFPEAK10, FREEDEL — every time.' },
  { emoji: '⭐', title: 'Double loyalty points',  blurb: 'Earn twice as fast. Points still cap at 20% of subtotal.' },
];
