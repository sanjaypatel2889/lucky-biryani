'use client';

import { Header } from '@/components/Header';
import { useCart } from '@/lib/cart-store';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';
import { LoginModal } from '@/components/LoginModal';

type Quote = {
  subtotal: number; tax: number; deliveryFee: number; weatherFee: number;
  discount: number; loyaltyUsed: number; total: number;
  distanceKm?: number; prepMinutes: number; errors: string[]; couponCode?: string;
};

export default function CartPage() {
  const { lines, setQty, remove, clear } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [type, setType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [paymentMode, setPaymentMode] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [coupon, setCoupon] = useState('');
  const [points, setPoints] = useState(0);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledFor, setScheduledFor] = useState<string>('');
  const [address, setAddress] = useState({
    line1: '12-3-456, Road No 1', line2: 'Jubilee Hills',
    pincode: '500033', lat: 17.4239, lng: 78.4738,
  });
  const [branchId, setBranchId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

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
        destination: type === 'DELIVERY' ? { lat: address.lat, lng: address.lng } : undefined,
        couponCode: coupon || undefined,
        loyaltyPointsToUse: points,
      }),
    }).then(setQuote).catch(() => setQuote(null));
  }, [branchId, lines, type, address, coupon, points]);

  async function placeOrder() {
    if (!user) { setLoginOpen(true); return; }
    if (!branchId || !quote) return;
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
          address: type === 'DELIVERY' ? address : undefined,
          couponCode: coupon || undefined,
          loyaltyPointsToUse: points,
          scheduledFor: sched,
        }),
      });
      if (paymentMode === 'ONLINE') {
        // simulate Razorpay popup with a stub confirmation in dev
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
                <div className="mt-3 space-y-2">
                  <input className="input" placeholder="Address line 1" value={address.line1} onChange={(e) => setAddress({...address, line1: e.target.value})} />
                  <input className="input" placeholder="Address line 2" value={address.line2} onChange={(e) => setAddress({...address, line2: e.target.value})} />
                  <input className="input" placeholder="Pincode" value={address.pincode} onChange={(e) => setAddress({...address, pincode: e.target.value})} />
                  <p className="text-xs text-slate-400">Lat/lng saved from current address: {address.lat.toFixed(4)}, {address.lng.toFixed(4)}</p>
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

            <div className="card p-4">
              <h3 className="font-medium">Payment</h3>
              <div className="mt-2 flex gap-2">
                {(['ONLINE','COD'] as const).map((p) => (
                  <button key={p}
                    onClick={() => setPaymentMode(p)}
                    className={`btn ${paymentMode === p ? 'btn-primary' : 'btn-secondary'} flex-1`}>{p === 'ONLINE' ? 'Online (UPI / card)' : 'Cash on delivery'}</button>
                ))}
              </div>

              <div className="mt-3">
                <label className="label">Coupon code</label>
                <input className="input" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="FIRST50" />
              </div>

              {user && (user.loyaltyPoints ?? 0) > 0 && (
                <div className="mt-3">
                  <label className="label">Use loyalty points (you have {user.loyaltyPoints})</label>
                  <input type="number" className="input" min={0} max={user.loyaltyPoints}
                         value={points} onChange={(e) => setPoints(Math.max(0, Math.min(user.loyaltyPoints!, Number(e.target.value))))} />
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="md:sticky md:top-20 md:self-start">
          <div className="card p-4">
            <h3 className="font-medium">Order summary</h3>
            {!quote ? <p className="mt-2 text-sm text-slate-500">Calculating…</p> : (
              <dl className="mt-3 space-y-1 text-sm">
                <Row k="Subtotal" v={`₹${quote.subtotal.toFixed(0)}`} />
                <Row k="Tax" v={`₹${quote.tax.toFixed(2)}`} />
                {quote.deliveryFee > 0 && <Row k={`Delivery${quote.distanceKm ? ` (${quote.distanceKm.toFixed(1)} km)` : ''}`} v={`₹${quote.deliveryFee.toFixed(0)}`} />}
                {quote.weatherFee > 0 && <Row k="Weather fee" v={`₹${quote.weatherFee}`} />}
                {quote.discount > 0 && <Row k={`Discount${quote.couponCode ? ` (${quote.couponCode})` : ''}`} v={`−₹${quote.discount.toFixed(0)}`} />}
                {quote.loyaltyUsed > 0 && <Row k="Loyalty points" v={`−₹${quote.loyaltyUsed}`} />}
                <hr className="my-2" />
                <Row k={<strong>Total</strong>} v={<strong>₹{quote.total.toFixed(0)}</strong>} />
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
              disabled={!quote || quote.errors.length > 0 || busy}>
              {busy ? 'Placing…' : (paymentMode === 'COD' ? 'Place order (COD)' : `Pay ₹${quote?.total.toFixed(0) ?? ''}`)}
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
