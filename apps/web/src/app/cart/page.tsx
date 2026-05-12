'use client';

import { Header } from '@/components/Header';
import { useCart } from '@/lib/cart-store';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';
import { LoginModal } from '@/components/LoginModal';
import { AddressPicker, type Address } from '@/components/AddressPicker';
import { UpsellRail } from '@/components/UpsellRail';

type Quote = {
  subtotal: number; tax: number; deliveryFee: number; weatherFee: number;
  discount: number; memberDiscount: number; loyaltyUsed: number; total: number;
  distanceKm?: number; prepMinutes: number; errors: string[]; couponCode?: string;
  memberPerksApplied?: { freeDelivery: boolean; discountPct: number };
};

export default function CartPage() {
  const { lines, setQty, remove, clear, add } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [type, setType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [paymentMode, setPaymentMode] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [coupon, setCoupon] = useState('');
  const [points, setPoints] = useState(0);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledFor, setScheduledFor] = useState<string>('');
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  // Delivery preferences
  const [contactless, setContactless] = useState(false);
  const [dontRingBell, setDontRingBell] = useState(false);
  const [leaveAtDoor, setLeaveAtDoor] = useState(false);
  const [noCutlery, setNoCutlery] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [tip, setTip] = useState(0);

  useEffect(() => {
    api<{ branch: any }>('/api/v1/menu/branch').then((r) => setBranchId(r.branch?.id ?? null));
  }, []);

  useEffect(() => {
    if (!branchId || lines.length === 0) { setQuote(null); return; }
    const cart = lines.map((l) => ({ itemId: l.itemId, qty: l.qty, modifierIds: l.modifierIds, notes: l.notes }));
    api<Quote>('/api/v1/orders/quote', {
      method: 'POST',
      body: JSON.stringify({
        branchId, type, cart,
        destination: type === 'DELIVERY' && selectedAddress ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : undefined,
        couponCode: coupon || undefined,
        loyaltyPointsToUse: points,
      }),
    }).then(setQuote).catch(() => setQuote(null));
  }, [branchId, lines, type, selectedAddress, coupon, points]);

  async function placeOrder() {
    if (!user) { setLoginOpen(true); return; }
    if (!branchId || !quote) return;
    if (type === 'DELIVERY' && !selectedAddress) {
      setErr('Pick a delivery address first');
      return;
    }
    setBusy(true); setErr('');
    try {
      const cart = lines.map((l) => ({ itemId: l.itemId, qty: l.qty, modifierIds: l.modifierIds, notes: l.notes }));
      const sched = scheduleMode === 'later' && scheduledFor
        ? new Date(scheduledFor).toISOString()
        : undefined;
      const r = await api<{ order: any; razorpay: any }>('/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          branchId, type, paymentMode, cart,
          address: type === 'DELIVERY' && selectedAddress ? {
            line1: selectedAddress.line1,
            line2: selectedAddress.line2,
            pincode: selectedAddress.pincode,
            lat: selectedAddress.lat,
            lng: selectedAddress.lng,
          } : undefined,
          couponCode: coupon || undefined,
          loyaltyPointsToUse: points,
          scheduledFor: sched,
          contactless, dontRingBell, leaveAtDoor, noCutlery,
          deliveryNote: deliveryNote.trim() || undefined,
          riderTip: tip || undefined,
        }),
      });
      if (paymentMode === 'ONLINE') {
        // Dev stub: skip Razorpay UI and confirm directly. Real Razorpay
        // checkout calls back with the signed payload; the verify endpoint
        // will check HMAC when keys are configured.
        await api(`/api/v1/orders/${r.order.id}/confirm-payment`, {
          method: 'POST',
          body: JSON.stringify({
            razorpayOrderId: r.razorpay?.id,
            razorpayPaymentId: 'pay_dev_' + Math.random().toString(36).slice(2),
            razorpaySignature: 'sig_dev',
          }),
        });
      }
      clear();
      router.push(`/orders/${r.order.id}`);
    } catch (e: any) {
      setErr(e.detail?.detail?.[0] ?? e.message);
    }
    setBusy(false);
  }

  if (lines.length === 0) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-12 text-center">
          <p className="text-slate-500">Your cart is empty.</p>
          <a className="btn-primary mt-4 inline-flex" href="/menu">Browse menu</a>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[1fr_360px]">
        <section>
          <h1 className="font-display text-2xl font-bold text-brand-900">Your cart</h1>
          <ul className="mt-4 space-y-2">
            {lines.map((l, i) => (
              <li key={i} className="card flex items-center gap-4 p-3">
                <div className="flex-1">
                  <div className="font-medium">{l.name}</div>
                  {l.modifierLabels.length > 0 && <div className="text-xs text-slate-500">{l.modifierLabels.join(' · ')}</div>}
                  {l.notes && <div className="text-xs italic text-slate-400">"{l.notes}"</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary !px-3" onClick={() => setQty(i, l.qty - 1)}>−</button>
                  <span className="w-6 text-center">{l.qty}</span>
                  <button className="btn-secondary !px-3" onClick={() => setQty(i, l.qty + 1)}>+</button>
                </div>
                <div className="w-20 text-right font-medium">₹{(l.unitPrice * l.qty).toFixed(0)}</div>
                <button className="text-xs text-rose-500 hover:underline" onClick={() => remove(i)}>remove</button>
              </li>
            ))}
          </ul>

          {/* Upsell rail — server-suggested add-ons */}
          <UpsellRail cartItemIds={lines.map((l) => l.itemId)} onAdd={(item) => {
            add({
              itemId: item.id, name: item.name, qty: 1,
              unitPrice: item.basePrice, modifierIds: [], modifierLabels: [],
            });
          }} />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="card p-4">
              <h3 className="font-medium">How would you like it?</h3>
              <div className="mt-2 flex gap-2">
                {(['DELIVERY','PICKUP'] as const).map((t) => (
                  <button key={t}
                    onClick={() => setType(t)}
                    className={`btn ${type === t ? 'btn-primary' : 'btn-secondary'} flex-1`}>{t === 'DELIVERY' ? 'Deliver to me' : 'Pick up'}</button>
                ))}
              </div>
              {type === 'DELIVERY' && (
                <div className="mt-3">
                  <AddressPicker selected={selectedAddress} onSelect={setSelectedAddress} />
                </div>
              )}
            </div>

            <div className="card p-4">
              <h3 className="font-medium">When?</h3>
              <div className="mt-2 flex gap-2">
                {(['now','later'] as const).map((m) => (
                  <button key={m}
                    onClick={() => setScheduleMode(m)}
                    className={`btn ${scheduleMode === m ? 'btn-primary' : 'btn-secondary'} flex-1`}>
                    {m === 'now' ? 'ASAP (~30 min)' : 'Schedule'}
                  </button>
                ))}
              </div>
              {scheduleMode === 'later' && (
                <input
                  type="datetime-local"
                  className="input mt-3"
                  value={scheduledFor}
                  min={new Date(Date.now() + 20 * 60_000).toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
              )}
            </div>

            {type === 'DELIVERY' && (
              <div className="card p-4 md:col-span-2">
                <h3 className="font-medium">Delivery preferences</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Toggle on={contactless}  onChange={setContactless}  label="Contactless delivery" hint="Rider leaves at door, knocks, steps back." />
                  <Toggle on={dontRingBell} onChange={setDontRingBell} label="Don't ring bell"      hint="Sleeping baby / late night order." />
                  <Toggle on={leaveAtDoor}  onChange={setLeaveAtDoor}  label="Leave at door"        hint="OTP-verified hand-off skipped." />
                  <Toggle on={noCutlery}    onChange={setNoCutlery}    label="Skip cutlery"         hint="We bring our own. Saves plastic." />
                </div>
                <div className="mt-3">
                  <label className="label">Note for the rider (optional)</label>
                  <input
                    className="input"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    placeholder="Gate 2 · Flat 304 · Ring after 6 PM"
                    maxLength={300}
                  />
                </div>

                <div className="mt-4 border-t border-stone-100 pt-3">
                  <div className="flex items-baseline justify-between">
                    <label className="label !mb-0">Tip your rider</label>
                    <span className="text-xs text-stone-400">100% goes to your rider</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[0, 20, 30, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTip(amt)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${tip === amt ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300'}`}
                      >
                        {amt === 0 ? 'No tip' : `₹${amt}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="card p-4 md:col-span-2">
              <h3 className="font-medium">Payment</h3>
              <div className="mt-2 flex gap-2">
                {(['ONLINE','COD'] as const).map((p) => (
                  <button key={p}
                    onClick={() => setPaymentMode(p)}
                    className={`btn ${paymentMode === p ? 'btn-primary' : 'btn-secondary'} flex-1`}>{p === 'ONLINE' ? 'Online (UPI / card)' : 'Cash on delivery'}</button>
                ))}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Coupon code</label>
                  <input className="input" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="FIRST50" />
                </div>
                {user && (user.loyaltyPoints ?? 0) > 0 && (
                  <div>
                    <label className="label">Use loyalty points ({user.loyaltyPoints} available)</label>
                    <input type="number" className="input" min={0} max={user.loyaltyPoints}
                           value={points} onChange={(e) => setPoints(Math.max(0, Math.min(user.loyaltyPoints!, Number(e.target.value))))} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="md:sticky md:top-20 md:self-start space-y-3">
          {quote && !quote.memberPerksApplied && quote.subtotal >= 200 && user && (
            <a
              href="/club"
              className="block rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 p-3 text-sm text-white shadow-md hover:opacity-95"
            >
              <div className="text-xs uppercase tracking-[0.15em] opacity-80">★ Lucky Club</div>
              <div className="mt-0.5 font-semibold">Save ₹{Math.max(0, Math.round(quote.subtotal * 0.05) + quote.deliveryFee)} on this order with Lucky Club →</div>
              <div className="text-[11px] opacity-80">Free delivery + 5% off · ₹199/mo</div>
            </a>
          )}
          <div className="card p-4">
            <h3 className="font-medium">Order summary</h3>
            {!quote ? <p className="mt-2 text-sm text-slate-500">Calculating…</p> : (
              <dl className="mt-3 space-y-1 text-sm">
                <Row k="Subtotal" v={`₹${quote.subtotal.toFixed(0)}`} />
                <Row k="Tax" v={`₹${quote.tax.toFixed(2)}`} />
                {quote.deliveryFee > 0 && <Row k={`Delivery${quote.distanceKm ? ` (${quote.distanceKm.toFixed(1)} km)` : ''}`} v={`₹${quote.deliveryFee.toFixed(0)}`} />}
                {quote.weatherFee > 0 && <Row k="Weather fee" v={`₹${quote.weatherFee}`} />}
                {quote.discount > 0 && <Row k={`Discount${quote.couponCode ? ` (${quote.couponCode})` : ''}`} v={`−₹${quote.discount.toFixed(0)}`} />}
                {quote.memberDiscount > 0 && <Row k="★ Lucky Club discount" v={`−₹${quote.memberDiscount.toFixed(0)}`} />}
                {quote.loyaltyUsed > 0 && <Row k="Loyalty points" v={`−₹${quote.loyaltyUsed}`} />}
                {tip > 0 && <Row k="Rider tip" v={`₹${tip}`} />}
                <hr className="my-2" />
                <Row k={<strong>Total</strong>} v={<strong>₹{(quote.total + tip).toFixed(0)}</strong>} />
                {quote.errors.length > 0 && (
                  <div className="mt-2 space-y-1 rounded bg-rose-50 p-2 text-xs text-rose-700">
                    {quote.errors.map((e) => <div key={e}>⚠ {e}</div>)}
                  </div>
                )}
              </dl>
            )}
            <button
              className="btn-primary mt-4 w-full"
              onClick={placeOrder}
              disabled={!quote || quote.errors.length > 0 || busy || (type === 'DELIVERY' && !selectedAddress)}>
              {busy ? 'Placing…' : (paymentMode === 'COD' ? `Place order (COD) · ₹${quote ? (quote.total + tip).toFixed(0) : ''}` : `Pay ₹${quote ? (quote.total + tip).toFixed(0) : ''}`)}
            </button>
            {err && <p className="mt-2 text-xs text-rose-600">⚠ {err}</p>}
            <p className="mt-2 text-xs text-slate-400">By placing this order, you agree to our terms.</p>
          </div>
        </aside>
      </main>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}

function Row({ k, v }: { k: any; v: any }) {
  return (
    <div className="flex justify-between"><dt className="text-slate-600">{k}</dt><dd>{v}</dd></div>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (b: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 hover:border-brand-200 hover:bg-brand-50/30">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-brand-600" />
      <div>
        <div className="text-sm font-medium text-stone-800">{label}</div>
        {hint && <div className="text-[11px] text-stone-500">{hint}</div>}
      </div>
    </label>
  );
}
