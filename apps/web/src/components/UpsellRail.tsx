'use client';

// Cart upsell rail — calls /api/v1/orders/upsells with the current cart
// and renders the server's 3 suggestions. The reason chip surfaces why
// each was picked ("Pairs perfectly with biryani", "Bestseller", etc).

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DishImage } from './DishImage';
import { dishPhoto } from '@/lib/photos';

type Suggested = {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  categoryName: string;
  reason: string;
};

type Props = {
  cartItemIds: string[];
  onAdd: (item: Suggested) => void;
};

export function UpsellRail({ cartItemIds, onAdd }: Props) {
  const [items, setItems] = useState<Suggested[]>([]);
  const key = cartItemIds.slice().sort().join(',');

  useEffect(() => {
    if (cartItemIds.length === 0) { setItems([]); return; }
    api<{ items: Suggested[] }>('/api/v1/orders/upsells', {
      method: 'POST',
      body: JSON.stringify({ cart: cartItemIds.map((id) => ({ itemId: id, qty: 1 })) }),
    }).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [key]);

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Goes well with your order</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="card flex gap-3 overflow-hidden p-2">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-stone-100">
              <DishImage src={dishPhoto(it.name, it.categoryName, it.imageUrl)} name={it.name} category={it.categoryName} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-1 flex-col">
              <div className="text-sm font-medium text-stone-800 line-clamp-1">{it.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-600">{it.reason}</div>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-sm font-bold text-stone-900">₹{it.basePrice}</span>
                <button onClick={() => onAdd(it)} className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700">+ Add</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
