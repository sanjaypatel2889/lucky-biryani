'use client';

// "Order again" rail — for returning customers, shows their last 4 orders so
// they can re-fire favorites in two taps. Hidden when the user isn't logged
// in or has no order history.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-store';
import { useCart } from '@/lib/cart-store';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

type Order = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  total: number;
  items: Array<{ qty: number; item: { name: string }; modifiers: string }>;
};

export function OrderAgainRail() {
  const { user } = useAuth();
  const { add, clear } = useCart();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setOrders([]); return; }
    api<{ orders: Order[] }>('/api/v1/orders').then((r) => {
      // Recent delivered/paid orders, dedupe by item-signature so the rail isn't 4 identical cards
      const seen = new Set<string>();
      const picked: Order[] = [];
      for (const o of r.orders) {
        if (!['DELIVERED', 'OUT_FOR_DELIVERY', 'PREPARING', 'PAID'].includes(o.status)) continue;
        const sig = o.items.map((i) => `${i.item.name}x${i.qty}`).sort().join('|');
        if (seen.has(sig)) continue;
        seen.add(sig);
        picked.push(o);
        if (picked.length >= 4) break;
      }
      setOrders(picked);
    }).catch(() => {});
  }, [user?.id]);

  if (!user || orders.length === 0) return null;

  async function reorder(o: Order) {
    setBusy(o.id);
    try {
      const r = await api<{ cart: Array<{ itemId: string; qty: number; modifierIds: string[]; notes?: string }>; branchId: string }>(
        `/api/v1/orders/${o.id}/reorder`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      clear();
      // Need item names + prices for the cart store — fetch the menu once
      const menu = await api<{ items: Array<any> }>('/api/v1/menu/items');
      const byId = new Map(menu.items.map((i) => [i.id, i]));
      for (const line of r.cart) {
        const meta = byId.get(line.itemId);
        if (!meta) continue;
        const mods = line.modifierIds
          .map((id) => {
            for (const g of meta.modifierGroups ?? []) {
              for (const m of g.modifiers ?? []) {
                if (m.id === id) return { id: m.id, name: m.name, priceDelta: m.priceDelta };
              }
            }
            return null;
          })
          .filter((x): x is { id: string; name: string; priceDelta: number } => !!x);
        const modSum = mods.reduce((s, m) => s + m.priceDelta, 0);
        add({
          itemId: line.itemId,
          name: meta.name,
          qty: line.qty,
          unitPrice: meta.basePrice + modSum,
          modifierIds: line.modifierIds,
          modifierLabels: mods.map((m) => m.name),
          notes: line.notes,
        });
      }
      router.push('/cart');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">Order again</span>
          <h2 className="mt-1 display text-2xl font-bold text-stone-900 md:text-3xl">Your usual, in two taps</h2>
        </div>
        <Link href="/orders" className="text-xs text-stone-500 underline-offset-4 hover:text-brand-700 hover:underline">
          See all orders →
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {orders.map((o) => (
          <div key={o.id} className="card flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>{new Date(o.createdAt).toLocaleDateString()}</span>
              <span className="text-stone-400">{o.status === 'DELIVERED' ? 'Delivered' : o.status}</span>
            </div>
            <ul className="text-sm text-stone-700">
              {o.items.slice(0, 3).map((it, i) => (
                <li key={i} className="line-clamp-1">{it.qty} × {it.item.name}</li>
              ))}
              {o.items.length > 3 && <li className="text-xs text-stone-400">+{o.items.length - 3} more</li>}
            </ul>
            <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-2">
              <span className="text-sm font-bold text-stone-900">₹{o.total.toFixed(0)}</span>
              <button
                onClick={() => reorder(o)}
                disabled={busy === o.id}
                className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:bg-stone-300"
              >
                {busy === o.id ? 'Loading…' : 'Reorder'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
