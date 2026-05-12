'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useWsTopic } from '@/lib/ws';
import { RiderChat } from '@/components/RiderChat';

type Order = any;
type Earnings = {
  today:  { count: number; earnings: number; km: number };
  week:   { count: number; earnings: number; km: number };
  month:  { count: number; earnings: number; km: number };
  recent: Array<{ id: string; deliveredAt: string | null; km: number; payout: number; tip: number }>;
};

export default function RiderHome() {
  const [rider, setRider] = useState<any>(null);
  const [active, setActive] = useState<Order[]>([]);
  const [offer, setOffer] = useState<{ id: string; deadline: number } | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [tab, setTab] = useState<'orders' | 'earnings'>('orders');
  const offerTimer = useRef<any>(null);

  function load() {
    api<any>('/api/v1/rider/me').then((r) => setRider(r.rider));
    api<{ orders: Order[] }>('/api/v1/rider/orders/active').then((r) => setActive(r.orders));
    api<Earnings>('/api/v1/rider/earnings').then(setEarnings).catch(() => {});
  }
  useEffect(() => { load(); const t = setInterval(load, 5_000); return () => clearInterval(t); }, []);

  // Listen for offers
  useWsTopic(rider ? `rider:${rider.id}` : null, (msg) => {
    if (msg?.type === 'order_offered') {
      setOffer({ id: msg.orderId, deadline: Date.now() + 10_000 });
      // pulse a sound? noop
      load();
    } else if (msg?.type === 'offer_expired') {
      setOffer(null);
    }
  });

  // GPS ping every 15s when ONLINE
  useEffect(() => {
    if (!rider || rider.status === 'OFFLINE') return;
    let t: any;
    function ping() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          api('/api/v1/rider/ping', {
            method: 'POST',
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          }).catch(() => {});
        },
        () => {
          // dev fallback: synthesize position near branch
          const lat = 17.385 + (Math.random() - 0.5) * 0.01;
          const lng = 78.4867 + (Math.random() - 0.5) * 0.01;
          api('/api/v1/rider/ping', { method: 'POST', body: JSON.stringify({ lat, lng }) }).catch(() => {});
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 },
      );
    }
    ping();
    t = setInterval(ping, 15_000);
    return () => clearInterval(t);
  }, [rider?.status]);

  // offer countdown
  useEffect(() => {
    if (!offer) return;
    if (offerTimer.current) clearInterval(offerTimer.current);
    offerTimer.current = setInterval(() => {
      if (Date.now() > offer.deadline) {
        setOffer(null);
      } else {
        // force re-render
        setOffer({ ...offer });
      }
    }, 200);
    return () => clearInterval(offerTimer.current);
  }, [offer?.id]);

  async function shift(action: 'start' | 'end') {
    await api(`/api/v1/rider/shifts/${action}`, { method: 'POST' });
    load();
  }
  async function offerAction(action: 'accept' | 'decline') {
    if (!offer) return;
    await api(`/api/v1/rider/orders/${offer.id}/${action}`, { method: 'POST' });
    setOffer(null);
    load();
  }
  async function transition(id: string, action: 'picked-up' | 'delivered', body?: any) {
    await api(`/api/v1/rider/orders/${id}/${action}`, {
      method: 'POST',
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    load();
  }

  if (!rider) return <p className="p-4">Loading rider profile…</p>;

  return (
    <div className="space-y-3">
      <div className={`card p-4 ${rider.status === 'OFFLINE' ? '' : 'bg-emerald-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Status</div>
            <div className="font-display text-xl font-bold">{rider.status.replace('_', ' ')}</div>
          </div>
          {rider.status === 'OFFLINE' ? (
            <button className="btn-primary" onClick={() => shift('start')}>Start shift</button>
          ) : (
            <button className="btn-secondary" onClick={() => shift('end')}>End shift</button>
          )}
        </div>
        {rider.lastLat && (
          <p className="mt-2 text-xs text-slate-500">📍 {rider.lastLat.toFixed(4)}, {rider.lastLng.toFixed(4)}</p>
        )}
      </div>

      {/* Tabs — orders vs earnings */}
      <div className="flex gap-1 rounded-full border border-stone-200 bg-white p-1 text-sm">
        <button
          className={`flex-1 rounded-full py-1.5 ${tab === 'orders' ? 'bg-brand-600 text-white' : 'text-stone-600'}`}
          onClick={() => setTab('orders')}
        >Orders</button>
        <button
          className={`flex-1 rounded-full py-1.5 ${tab === 'earnings' ? 'bg-brand-600 text-white' : 'text-stone-600'}`}
          onClick={() => setTab('earnings')}
        >Earnings</button>
      </div>

      {tab === 'earnings' && earnings && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(['today', 'week', 'month'] as const).map((k) => (
              <div key={k} className="card p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-stone-500">{k}</div>
                <div className="display text-xl font-bold text-stone-900">₹{earnings[k].earnings}</div>
                <div className="text-[10px] text-stone-500">{earnings[k].count} deliveries · {earnings[k].km} km</div>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <h3 className="font-medium">Recent deliveries</h3>
            {earnings.recent.length === 0 && <p className="mt-1 text-xs text-stone-400">No completed deliveries yet.</p>}
            <ul className="mt-2 divide-y divide-stone-100">
              {earnings.recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                  <div>
                    <div className="text-stone-700">₹{r.payout.toFixed(0)} {r.tip > 0 && <span className="text-emerald-600">· +₹{r.tip} tip</span>}</div>
                    <div className="text-[10px] text-stone-400">
                      {r.deliveredAt ? new Date(r.deliveredAt).toLocaleString() : '—'} · {r.km.toFixed(1)} km
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-center text-[10px] text-stone-400">Payout = ₹25 base + ₹6/km + 100% of customer tips.</p>
        </div>
      )}

      {tab === 'orders' && (
        <>
          {/* Offer popup */}
          {offer && (
            <div className="card border-2 border-brand-500 bg-brand-50 p-4">
              <div className="text-xs uppercase text-brand-700">New order offer</div>
              <div className="mt-1 font-medium">Tap accept within {Math.max(0, Math.round((offer.deadline - Date.now()) / 1000))}s</div>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary flex-1" onClick={() => offerAction('accept')}>Accept</button>
                <button className="btn-secondary flex-1" onClick={() => offerAction('decline')}>Decline</button>
              </div>
            </div>
          )}

          {/* Active orders */}
          {active.length === 0 && rider.status !== 'OFFLINE' && (
            <div className="card p-4 text-center text-slate-500">Waiting for orders…</div>
          )}
          {active.map((o) => (
            <div key={o.id} className="space-y-2">
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <strong>{o.orderNumber}</strong>
                  <span className="chip bg-slate-100 text-slate-700">{o.status}</span>
                </div>
                <p className="mt-1 text-sm">{o.user?.name} · {o.user?.phone}</p>
                <p className="text-xs text-slate-500">{o.addressLine}</p>
                {o.deliveryNote && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">📝 {o.deliveryNote}</p>}
                {(o.contactless || o.dontRingBell || o.leaveAtDoor) && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    {o.contactless  && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-violet-700">contactless</span>}
                    {o.dontRingBell && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700">no bell</span>}
                    {o.leaveAtDoor  && <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-700">leave at door</span>}
                  </div>
                )}
                {o.paymentMode === 'COD' && (
                  <p className="mt-1 text-sm font-semibold text-amber-700">Collect ₹{o.total.toFixed(0)} (COD)</p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <a className="btn-secondary !py-1" href={`https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`} target="_blank">Navigate</a>
                  <a className="btn-secondary !py-1" href={`tel:${o.user?.phone}`}>Call</a>
                </div>
                {o.status === 'READY' && (
                  <button className="btn-primary mt-2 w-full" onClick={() => transition(o.id, 'picked-up')}>
                    I've picked it up
                  </button>
                )}
                {o.status === 'OUT_FOR_DELIVERY' && (
                  <DeliverButton order={o} onDeliver={(payload) => transition(o.id, 'delivered', payload)} />
                )}
              </div>
              {/* Chat with the customer for this order */}
              <RiderChat orderId={o.id} myRole="RIDER" />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function DeliverButton({ order, onDeliver }: { order: any; onDeliver: (b: any) => void }) {
  const [otp, setOtp] = useState('');
  const [proof, setProof] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const needsOtp = !!order.deliveryOtp;
  async function go() {
    setErr(null);
    if (needsOtp && otp.trim().length !== 4) {
      setErr('Ask the customer for the 4-digit code');
      return;
    }
    try {
      await onDeliver({ otp: otp.trim() || undefined, proofUrl: proof || undefined });
    } catch (e: any) {
      setErr(e?.detail?.error === 'bad_otp' ? 'Wrong code — please ask again' : 'Failed to mark delivered');
    }
  }
  function snap() {
    // Lightweight "photo proof" — in dev we just stash a data URL placeholder.
    // Real impl would presigned-upload to S3/R2 and store the resulting URL.
    setProof(`proof:order:${order.id}:${Date.now()}`);
  }
  return (
    <div className="mt-2 space-y-2">
      {needsOtp && (
        <input
          inputMode="numeric"
          maxLength={4}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4-digit code from customer"
          className="input text-center text-lg tracking-[6px]"
        />
      )}
      <div className="flex gap-2">
        <button type="button" onClick={snap} className={`flex-1 rounded-md border px-3 py-1.5 text-xs ${proof ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-white text-stone-600'}`}>
          {proof ? '✓ Photo captured' : '📷 Add photo proof'}
        </button>
      </div>
      {err && <div className="text-xs text-rose-600">{err}</div>}
      <button className="btn-primary w-full" onClick={go}>Mark delivered</button>
    </div>
  );
}
