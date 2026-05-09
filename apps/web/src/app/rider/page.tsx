'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useWsTopic } from '@/lib/ws';

type Order = any;

export default function RiderHome() {
  const [rider, setRider] = useState<any>(null);
  const [active, setActive] = useState<Order[]>([]);
  const [offer, setOffer] = useState<{ id: string; deadline: number } | null>(null);
  const offerTimer = useRef<any>(null);

  function load() {
    api<any>('/api/v1/rider/me').then((r) => setRider(r.rider));
    api<{ orders: Order[] }>('/api/v1/rider/orders/active').then((r) => setActive(r.orders));
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
  async function transition(id: string, action: 'picked-up' | 'delivered') {
    await api(`/api/v1/rider/orders/${id}/${action}`, { method: 'POST' });
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
        <div key={o.id} className="card p-4">
          <div className="flex items-center justify-between">
            <strong>{o.orderNumber}</strong>
            <span className="chip bg-slate-100 text-slate-700">{o.status}</span>
          </div>
          <p className="mt-1 text-sm">{o.user?.name} · {o.user?.phone}</p>
          <p className="text-xs text-slate-500">{o.addressLine}</p>
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
            <button className="btn-primary mt-2 w-full" onClick={() => transition(o.id, 'delivered')}>
              Mark delivered
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
