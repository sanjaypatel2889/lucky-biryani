'use client';

import { Header } from '@/components/Header';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWsTopic } from '@/lib/ws';
import { useParams } from 'next/navigation';

const STAGES = ['PAID', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

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

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-900">{order.orderNumber}</h1>
            <p className="text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()} · {order.type} · {order.paymentMode}</p>
          </div>
          <span className="chip bg-brand-100 text-brand-800">{order.status}</span>
        </div>

        {/* Progress */}
        <div className="card mt-6 p-4">
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
        {order.status === 'OUT_FOR_DELIVERY' && order.rider && (
          <div className="card mt-4 p-4">
            <h3 className="font-medium">Live tracking</h3>
            <p className="text-sm text-slate-600">Rider: <strong>{order.rider.user.name}</strong> ({order.rider.vehicleNumber})</p>
            {riderGeo ? (
              <p className="mt-1 text-xs text-emerald-700">📍 Last position: {riderGeo.lat.toFixed(4)}, {riderGeo.lng.toFixed(4)} (updates every 15s)</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">Waiting for first GPS ping…</p>
            )}
            <a className="btn-secondary mt-3 inline-flex" href={`tel:${order.rider.user.phone}`}>Call rider</a>
          </div>
        )}

        {/* Items */}
        <div className="card mt-4 p-4">
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
            <Row k={<strong>Total</strong>} v={<strong>₹{order.total.toFixed(0)}</strong>} />
          </div>
        </div>

        {/* Timeline */}
        <div className="card mt-4 p-4">
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
