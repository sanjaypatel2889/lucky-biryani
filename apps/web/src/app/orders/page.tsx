'use client';

import { Header } from '@/components/Header';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import Link from 'next/link';

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    api<{ orders: any[] }>('/api/v1/orders').then((r) => setOrders(r.orders));
  }, [user]);

  if (loading) return <><Header /><main className="p-8">…</main></>;
  if (!user) return <><Header /><main className="mx-auto max-w-3xl p-8 text-slate-600">Login to see your orders.</main></>;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-brand-900">My orders</h1>
        {orders.length === 0 ? (
          <p className="mt-6 text-slate-500">No orders yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="card flex items-center justify-between p-4">
                <div>
                  <Link href={`/orders/${o.id}`} className="font-medium hover:underline">{o.orderNumber}</Link>
                  <div className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString()} · {o.type}</div>
                  <div className="mt-1 text-xs text-slate-600">{o.items.length} items · ₹{o.total.toFixed(0)}</div>
                </div>
                <span className={`chip ${statusClass(o.status)}`}>{o.status}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function statusClass(s: string) {
  if (['DELIVERED'].includes(s)) return 'bg-emerald-100 text-emerald-800';
  if (['CANCELLED', 'REFUNDED'].includes(s)) return 'bg-rose-100 text-rose-700';
  if (['PENDING_PAYMENT'].includes(s)) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}
