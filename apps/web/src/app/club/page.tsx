'use client';

// Lucky Club — subscription tier landing page with the premium dark/gold
// treatment. Black canvas, amber gradient accents, animated perk cards, and
// a math-it-out section that proves the membership pays for itself.
//
// Logic is unchanged from the previous version: pull /membership/plans, show
// current /membership/me state, enroll or cancel via the same endpoints.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { FaqAccordion } from '@/components/FaqAccordion';
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
    } else {
      setMem(null);
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
      <main className="relative min-h-screen overflow-hidden bg-stone-950 text-amber-50">
        {/* Ambient gold haze backdrop */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute right-[-100px] top-[400px] h-[520px] w-[520px] rounded-full bg-amber-700/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(245,158,11,0.18),transparent_60%)]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-16 md:py-24">
          {/* HERO ============================================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Lucky Club · Members only
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              <span className="block text-amber-50">Every dum,</span>
              <span className="block bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">a little luckier.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-amber-100/70 md:text-lg">
              Free delivery on every order. 5% off every subtotal. Loyalty points at 2× speed.
              One subscription, every meal.
            </p>
          </motion.div>

          {/* Member status, or perks + plans ================================= */}
          {mem?.active ? (
            <MemberCard mem={mem} onCancel={cancel} busy={busy} />
          ) : (
            <>
              <PerkGrid />

              <div className="mt-12">
                <h2 className="text-center text-xs font-bold uppercase tracking-[0.22em] text-amber-400/80">
                  Choose your tempo
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {plans.map((p) => {
                    const monthlyEffective = p.code === 'CLUB_ANNUAL'
                      ? Math.round((p.pricePaisa / 100) / 12)
                      : Math.round(p.pricePaisa / 100);
                    const isPicked = picked === p.code;
                    const isAnnual = p.code === 'CLUB_ANNUAL';
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPicked(p.code)}
                        className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition ${
                          isPicked
                            ? 'border-amber-400 bg-gradient-to-br from-amber-500/15 via-amber-400/10 to-transparent shadow-2xl shadow-amber-700/20'
                            : 'border-amber-100/10 bg-white/[0.03] hover:border-amber-300/40 hover:bg-white/[0.05]'
                        }`}
                      >
                        {/* gold sheen sweep on selected */}
                        {isPicked && <span aria-hidden className="shimmer-gold pointer-events-none absolute inset-0" />}
                        <div className="flex w-full items-center justify-between">
                          <h3 className="font-display text-2xl font-bold text-amber-50">{p.name.replace('Lucky Club — ', '')}</h3>
                          {isAnnual && (
                            <span className="rounded-full bg-gradient-to-br from-amber-300 to-amber-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-950">
                              Save 16%
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-amber-100/70">{p.description}</p>
                        <div className="mt-5">
                          <span className="font-display text-4xl font-bold text-amber-50">₹{Math.round(p.pricePaisa / 100)}</span>
                          <span className="ml-1 text-sm text-amber-100/60">/ {isAnnual ? 'year' : 'month'}</span>
                          {isAnnual && <span className="ml-3 text-xs text-amber-200/70">≈ ₹{monthlyEffective}/mo</span>}
                        </div>
                        <div className={`mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${isPicked ? 'text-amber-200' : 'text-amber-100/40'}`}>
                          <span className={`grid h-4 w-4 place-items-center rounded-full border ${isPicked ? 'border-amber-400 bg-amber-400 text-stone-950' : 'border-amber-100/30'}`}>
                            {isPicked && <span className="text-[9px]">✓</span>}
                          </span>
                          {isPicked ? 'Selected' : 'Tap to select'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-7 flex flex-col items-center">
                  <button
                    onClick={enroll}
                    disabled={busy || plans.length === 0}
                    className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 px-10 py-4 text-base font-bold text-stone-950 shadow-2xl shadow-amber-700/40 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition group-hover:translate-x-full" style={{ transitionDuration: '900ms' }} />
                    <span className="relative">
                      {busy ? 'Activating…' : user ? 'Join Lucky Club' : 'Log in to join'}
                    </span>
                  </button>
                  {err && <p className="mt-3 text-sm text-rose-400">⚠ {err}</p>}
                  {done && <p className="mt-3 text-sm font-medium text-emerald-400">✓ {done}</p>}
                  <p className="mt-3 text-xs text-amber-100/40">
                    Cancel anytime. Free delivery applies inside our 6 km service zone.
                  </p>
                </div>
              </div>

              <MathOfItAll />
            </>
          )}

          <FaqSection />
        </div>
      </main>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}

// ===========================================================================
// Sub-views
// ===========================================================================

function MemberCard({ mem, onCancel, busy }: { mem: Membership; onCancel: () => void; busy: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
      className="relative mx-auto mt-12 max-w-2xl overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent p-8 shadow-2xl shadow-amber-700/20"
    >
      <span aria-hidden className="shimmer-gold pointer-events-none absolute inset-0" />
      <div className="relative flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-3xl text-stone-950 shadow-lg">★</span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200/80">You're in</div>
          <div className="font-display text-2xl font-bold text-amber-50">Lucky Club member</div>
          {mem.until && (
            <div className="mt-0.5 text-sm text-amber-100/70">Active until {new Date(mem.until).toLocaleDateString()}</div>
          )}
        </div>
      </div>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
        {PERKS.map((p) => (
          <div key={p.title} className="rounded-lg border border-amber-100/10 bg-stone-950/40 p-3 backdrop-blur">
            <div className="text-xl">{p.emoji}</div>
            <div className="mt-1 text-sm font-semibold text-amber-100">{p.short}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-6">
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-full bg-stone-950/60 px-4 py-2 text-sm font-semibold text-amber-200 ring-1 ring-amber-100/20 backdrop-blur transition hover:bg-stone-950 hover:text-rose-200"
        >
          Cancel membership
        </button>
      </div>
    </motion.div>
  );
}

function PerkGrid() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
      }}
      className="mt-14 grid gap-4 sm:grid-cols-3"
    >
      {PERKS.map((p) => (
        <motion.div
          key={p.title}
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          className="group relative overflow-hidden rounded-2xl border border-amber-100/10 bg-white/[0.04] p-6 backdrop-blur transition hover:border-amber-300/30 hover:bg-white/[0.06]"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-700/20 text-2xl ring-1 ring-amber-200/20">
            {p.emoji}
          </div>
          <h3 className="mt-4 font-display text-xl font-bold text-amber-50">{p.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-100/65">{p.blurb}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

function MathOfItAll() {
  return (
    <div className="mt-14 rounded-2xl border border-amber-100/10 bg-white/[0.03] p-7">
      <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300/80">The math, briefly</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Stat label="Avg order saved" value="₹50" caption="Free delivery (₹30) + 5% off subtotal" />
        <Stat label="Points earned 2×" value="80 → 160" caption="₹160 future credit on a ₹400 order" />
        <Stat label="Payback" value="~4 orders" caption="Annual plan pays for itself" />
      </div>
      <p className="mt-5 text-xs text-amber-100/50">
        Stacks with FIRST50, OFFPEAK10, FREEDEL coupons. Loyalty points still cap at 20% of subtotal redeemable per order.
      </p>
    </div>
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-200/70">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-amber-50">{value}</div>
      <div className="mt-1 text-xs text-amber-100/55">{caption}</div>
    </div>
  );
}

function FaqSection() {
  return (
    <div className="mt-16">
      <h2 className="text-center text-xs font-bold uppercase tracking-[0.22em] text-amber-300/80">
        Questions, answered
      </h2>
      <div className="mt-5 [&_*]:!border-amber-100/15 [&_button]:!text-amber-50 [&_button:hover]:!bg-white/[0.04] [&_li]:!bg-stone-950/40 [&_ul]:!bg-stone-950/30 [&_div[role=region]]:!text-amber-100/70">
        <FaqAccordion items={[
          { q: 'How does free delivery work?', a: 'Every order placed inside our service zone (6 km from Banjara Hills) ships free as long as your membership is active. No minimum order.' },
          { q: 'Does the 5% stack with other coupons?', a: 'Yes. Member 5% applies to your subtotal in addition to any coupon (FIRST50, OFFPEAK10, FREEDEL).' },
          { q: 'When do double points credit?', a: 'When the order is marked DELIVERED. We do not retro-credit cancelled or refunded orders.' },
          { q: 'How do I cancel?', a: 'One tap on this page. Perks stop immediately; we do not pro-rate refunds, but we also do not auto-renew without telling you.' },
          { q: 'Can I gift Lucky Club?', a: 'Not yet, but it is on the roadmap. Email hello@luckybiryani.in if you want to be a beta tester.' },
        ]} />
      </div>
    </div>
  );
}

const PERKS = [
  {
    emoji: '🛵',
    title: 'Free delivery, always',
    short: 'No fees',
    blurb: 'Any order, any distance inside our zone. No minimum cart, no fine print.',
  },
  {
    emoji: '💸',
    title: '5% off every order',
    short: '5% subtotal',
    blurb: 'Stacks with all our coupons. We do not double-dip into your discount; we add to it.',
  },
  {
    emoji: '⭐',
    title: 'Double loyalty points',
    short: '2× points',
    blurb: 'Earn twice as fast. Points still cap at 20% of your subtotal, redeemable per order.',
  },
];
