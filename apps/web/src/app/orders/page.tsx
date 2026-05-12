'use client';

import { Header } from '@/components/Header';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import Link from 'next/link';
import { Stagger } from '@/components/ui/Stagger';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { EMPTY, ORDER_STATUS_PHRASE } from '@/lib/copy';

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) { setFetching(false); return; }
    setFetching(true);
    api<{ orders: any[] }>('/api/v1/orders')
      .then((r) => setOrders(r.orders))
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <><Header /><main className="p-8"><SkeletonRow /><SkeletonRow /></main></>;
  if (!user) return <><Header /><main className="mx-auto max-w-3xl p-8 text-slate-600">Login to see your orders.</main></>;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-brand-900">My orders</h1>
        {fetching ? (
          <ul className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="card p-4"><SkeletonRow /></li>
            ))}
          </ul>
        ) : orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
            <div className="text-5xl">{EMPTY.orders.emoji}</div>
            <h2 className="mt-3 display text-xl font-bold text-stone-900">{EMPTY.orders.title}</h2>
            <p className="mt-1 text-stone-600">{EMPTY.orders.hint}</p>
            <Link href="/menu" className="btn-primary mt-4 inline-flex">Start an order</Link>
          </div>
        ) : (
          <Stagger as="ul" mountKey={orders.length} className="mt-4 space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="card flex items-center justify-between p-4">
                <div>
                  <Link href={`/orders/${o.id}`} className="font-medium hover:underline">{o.orderNumber}</Link>
                  <div className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString()} · {o.type}</div>
                  <div className="mt-1 text-xs text-slate-600">{o.items.length} items · ₹{o.total.toFixed(0)}</div>
                  <div className="mt-1 text-xs text-brand-700">{ORDER_STATUS_PHRASE[o.status] ?? o.status}</div>
                </div>
                <span className={`chip ${statusClass(o.status)}`}>{o.status.replace(/_/g, ' ').toLowerCase()}</span>
              </li>
            ))}
          </Stagger>
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
