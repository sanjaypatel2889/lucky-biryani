'use client';

import { Header } from '@/components/Header';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWsTopic } from '@/lib/ws';
import { useParams } from 'next/navigation';
import { OrderMap } from '@/components/OrderMap';
import { PushOptIn } from '@/components/PushOptIn';
import { EtaCountdown } from '@/components/EtaCountdown';
import { RiderChat } from '@/components/RiderChat';

const STAGES = ['PAID', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const BRANCH = { lat: 17.385, lng: 78.4867, name: 'Lucky Biryani Centre' };

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [riderGeo, setRiderGeo] = useState<{ lat: number; lng: number } | null>(null);

  function reload() {
    api<{ order: any }>(`/api/v1/orders/${id}`).then((r) => setOrder(r.order));
  }
  useEffect(() => { reload(); }, [id]);

  useWsTopic(`order:${id}`, (msg) => {
    if (msg?.type === 'rider_geo') setRiderGeo({ lat: msg.lat, lng: msg.lng });
    else reload();
  });

  if (!order) return <><Header /><main className="p-8">Loading…</main></>;
  const idx = STAGES.indexOf(order.status);
  const showMap = order.type === 'DELIVERY' &&
    ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(order.status);
  const destination = order.lat && order.lng ? { lat: order.lat, lng: order.lng } : undefined;
  const riderPos = riderGeo ?? (order.rider?.lastLat ? { lat: order.rider.lastLat, lng: order.rider.lastLng } : undefined);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-900">{order.orderNumber}</h1>
            <p className="text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()} · {order.type} · {order.paymentMode}</p>
          </div>
          <span className="chip bg-brand-100 text-brand-800">{order.status}</span>
        </div>

        <PushOptIn />

        {/* Big ETA countdown — only shows while in-flight */}
        <EtaCountdown orderId={order.id} status={order.status} />

        {/* Progress */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            {STAGES.map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-center text-xs">
                <div className={`mb-1 h-3 w-3 rounded-full ${i <= idx ? 'bg-brand-600' : 'bg-slate-300'}`} />
                <span className={`whitespace-nowrap ${i <= idx ? 'text-brand-700' : 'text-slate-400'}`}>{s.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live tracking */}
        {showMap && destination && (
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">Live tracking</h3>
              {order.rider ? (
                <span className="text-xs text-slate-500">
                  Rider: <strong>{order.rider.user.name}</strong>
                  {order.rider.vehicleNumber ? ` · ${order.rider.vehicleNumber}` : ''}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Assigning rider…</span>
              )}
            </div>
            <OrderMap branch={BRANCH} destination={destination} rider={riderPos ? { ...riderPos, name: order.rider?.user?.name } : undefined} />
            {order.rider && (
              <a className="btn-secondary mt-3 inline-flex" href={`tel:${order.rider.user.phone}`}>Call rider</a>
            )}
          </div>
        )}

        {/* Rider chat — once a rider is assigned and order isn't done */}
        {order.rider && !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status) && (
          <RiderChat orderId={order.id} myRole="CUSTOMER" />
        )}

        {/* Delivery OTP — show only after PAID and before DELIVERED for delivery orders */}
        {order.type === 'DELIVERY' && order.deliveryOtp && order.status !== 'DELIVERED' && (
          <div className="card flex items-center justify-between gap-4 p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">Show this to your rider</div>
              <div className="display text-3xl font-bold tracking-[6px] text-brand-700">{order.deliveryOtp}</div>
              <p className="mt-1 text-xs text-stone-500">The rider will enter this code on hand-off so we know it reached the right person.</p>
            </div>
          </div>
        )}

        {/* Tip the rider */}
        {order.rider && ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status) && (
          <TipRider order={order} onUpdate={reload} />
        )}

        {/* Items */}
        <div className="card p-4">
          <h3 className="font-medium">Items</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {order.items.map((i: any) => (
              <li key={i.id} className="flex justify-between py-2 text-sm">
                <div>
                  <div>{i.qty} × {i.item.name}</div>
                  {(JSON.parse(i.modifiers) as any[]).length > 0 && (
                    <div className="text-xs text-slate-500">
                      {(JSON.parse(i.modifiers) as any[]).map((m) => m.name).join(' · ')}
                    </div>
                  )}
                </div>
                <span>₹{i.lineTotal.toFixed(0)}</span>
              </li>
            ))}
          </ul>
          <hr className="my-3" />
          <div className="space-y-1 text-sm">
            <Row k="Subtotal" v={`₹${order.subtotal.toFixed(0)}`} />
            <Row k="Tax" v={`₹${order.tax.toFixed(2)}`} />
            {order.deliveryFee > 0 && <Row k="Delivery" v={`₹${order.deliveryFee.toFixed(0)}`} />}
            {order.discount > 0 && <Row k="Discount" v={`−₹${order.discount.toFixed(0)}`} />}
            {order.loyaltyUsed > 0 && <Row k="Points" v={`−₹${order.loyaltyUsed}`} />}
            {order.riderTip > 0 && <Row k="Rider tip" v={`₹${order.riderTip}`} />}
            <Row k={<strong>Total</strong>} v={<strong>₹{(order.total + (order.riderTip || 0)).toFixed(0)}</strong>} />
          </div>
        </div>

        {/* Post-delivery review */}
        {order.status === 'DELIVERED' && <ReviewForm order={order} />}

        {/* Timeline */}
        <div className="card p-4">
          <h3 className="font-medium">Timeline</h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {order.events.map((e: any) => (
              <li key={e.id}><span className="text-slate-400">{new Date(e.createdAt).toLocaleTimeString()}</span> · {e.fromStatus ?? '∅'} → <strong>{e.toStatus}</strong> {e.note ? <span className="text-slate-400">— {e.note}</span> : null}</li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}

function Row({ k, v }: { k: any; v: any }) {
  return <div className="flex justify-between"><dt className="text-slate-600">{k}</dt><dd>{v}</dd></div>;
}

function TipRider({ order, onUpdate }: { order: any; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<number>(order.riderTip || 0);
  async function tip(amount: number) {
    setBusy(true);
    try {
      await api(`/api/v1/orders/${order.id}/tip`, { method: 'POST', body: JSON.stringify({ amount }) });
      setChosen(amount);
      onUpdate();
    } catch {}
    setBusy(false);
  }
  return (
    <div className="card p-4">
      <h3 className="font-medium">Tip {order.rider.user.name}</h3>
      <p className="mt-1 text-xs text-slate-500">100% of the tip goes to your rider. Pay later — just tap an amount.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[20, 30, 50, 100].map((amt) => (
          <button key={amt} disabled={busy}
            onClick={() => tip(amt)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${chosen === amt ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300'}`}>
            ₹{amt}
          </button>
        ))}
        {chosen > 0 && (
          <button onClick={() => tip(0)} disabled={busy} className="rounded-full border border-stone-200 px-3 py-2 text-xs text-stone-500 hover:bg-stone-50">Clear</button>
        )}
      </div>
    </div>
  );
}

function ReviewForm({ order }: { order: any }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (rating < 1) return;
    setBusy(true); setErr(null);
    try {
      await api('/api/v1/reviews', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, rating, comment: comment || undefined }),
      });
      setDone(true);
    } catch (e: any) {
      if (e.status === 409) { setDone(true); } // already reviewed
      else setErr('Could not submit — try again.');
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="card p-4">
        <h3 className="font-medium">Thanks for the review! 🙏</h3>
        <p className="mt-1 text-xs text-stone-500">Your feedback helps us improve the dum.</p>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <h3 className="font-medium">How was it?</h3>
      <div className="mt-2 flex gap-1 text-3xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} className={n <= rating ? 'text-amber-500' : 'text-stone-300'}>★</button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything stand out — flavour, packaging, timing?"
        className="input mt-3"
        rows={3}
      />
      {err && <div className="mt-2 text-xs text-rose-600">{err}</div>}
      <button onClick={submit} disabled={busy || rating < 1} className="btn-primary mt-3 disabled:cursor-not-allowed disabled:bg-stone-300">
        Submit review
      </button>
    </div>
  );
}
