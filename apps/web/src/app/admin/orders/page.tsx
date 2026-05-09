'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWsTopic } from '@/lib/ws';

const COLUMNS: Array<{ key: string; label: string; next?: string; bg: string }> = [
  { key: 'PAID',             label: 'New',         next: 'ACCEPTED',         bg: 'bg-amber-50 border-amber-200' },
  { key: 'ACCEPTED',         label: 'Accepted',    next: 'PREPARING',        bg: 'bg-sky-50 border-sky-200' },
  { key: 'PREPARING',        label: 'Preparing',   next: 'READY',            bg: 'bg-violet-50 border-violet-200' },
  { key: 'READY',            label: 'Ready',       next: 'OUT_FOR_DELIVERY', bg: 'bg-emerald-50 border-emerald-200' },
  { key: 'OUT_FOR_DELIVERY', label: 'On the way',  next: 'DELIVERED',        bg: 'bg-teal-50 border-teal-200' },
];

export default function KDS() {
  const [orders, setOrders] = useState<any[]>([]);

  function load() {
    api<{ orders: any[] }>('/api/v1/admin/orders').then((r) => setOrders(r.orders));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5_000);
    return () => clearInterval(t);
  }, []);
  useWsTopic('admin:orders', () => load());

  async function move(id: string, to: string) {
    await api(`/api/v1/admin/orders/${id}/transition`, {
      method: 'POST', body: JSON.stringify({ to }),
    });
    load();
  }

  const grouped = COLUMNS.map((c) => ({ ...c, orders: orders.filter((o) => o.status === c.key) }));

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-slate-900">Kitchen / KDS</h1>
      <p className="text-sm text-slate-500">Auto-refresh every 5s · live updates via WebSocket.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {grouped.map((col) => (
          <div key={col.key} className={`rounded-lg border p-2 ${col.bg}`}>
            <h3 className="px-2 py-1 text-sm font-semibold text-slate-700">
              {col.label} <span className="text-slate-400">· {col.orders.length}</span>
            </h3>
            <div className="space-y-2">
              {col.orders.map((o) => (
                <div key={o.id} className="card p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <strong>{o.orderNumber}</strong>
                    <span className="chip bg-slate-100 text-slate-600">{o.type}</span>
                  </div>
                  <div className="text-xs text-slate-500">{o.user?.name ?? 'Customer'} · ₹{o.total.toFixed(0)}</div>
                  <ul className="mt-1.5 space-y-0.5 text-xs">
                    {o.items.map((it: any) => (
                      <li key={it.id}>
                        {it.qty} × {it.item.name}
                        {(JSON.parse(it.modifiers) as any[]).length > 0 && (
                          <span className="text-slate-400"> ({(JSON.parse(it.modifiers) as any[]).map((m) => m.name).join(', ')})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {o.notes && <p className="mt-1 text-xs italic text-slate-500">"{o.notes}"</p>}
                  {o.rider && (
                    <p className="mt-1 text-xs text-emerald-700">🛵 {o.rider.user.name} · {o.rider.vehicleNumber}</p>
                  )}
                  {col.next && (
                    <button onClick={() => move(o.id, col.next!)} className="btn-primary mt-2 w-full !py-1 text-xs">
                      → {col.next.replace(/_/g, ' ')}
                    </button>
                  )}
                </div>
              ))}
              {col.orders.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">—</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
