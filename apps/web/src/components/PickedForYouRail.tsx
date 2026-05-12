'use client';

// "Picked for you" rail. Personalized based on the user's order history,
// time of day, and bestsellers. Only renders for logged-in users — for
// anonymous visitors the page already has "Most loved" featured dishes.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { DishImage } from './DishImage';
import { dishPhoto } from '@/lib/photos';

type Pick = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isVeg: boolean;
  prepMinutes: number;
  categoryName: string;
  reason: string;
};

export function PickedForYouRail() {
  const { user } = useAuth();
  const [items, setItems] = useState<Pick[]>([]);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    api<{ items: Pick[] }>('/api/v1/menu/picked-for-you').then((r) => setItems(r.items)).catch(() => {});
  }, [user?.id]);

  if (!user || items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">For you</span>
          <h2 className="mt-1 display text-2xl font-bold text-stone-900 md:text-3xl">Picked for {user.name?.split(' ')[0] ?? 'you'}</h2>
        </div>
        <Link href="/menu" className="text-xs text-stone-500 underline-offset-4 hover:text-brand-700 hover:underline">
          See full menu →
        </Link>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((it) => (
          <Link key={it.id} href="/menu" className="card group flex w-52 shrink-0 flex-col overflow-hidden p-0">
            <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
              <DishImage
                src={dishPhoto(it.name, it.categoryName, it.imageUrl)}
                name={it.name}
                category={it.categoryName}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
              />
            </div>
            <div className="flex flex-1 flex-col p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{it.reason}</div>
              <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold text-stone-900">{it.name}</h3>
              <p className="line-clamp-2 text-xs text-stone-500">{it.description}</p>
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-sm font-bold text-stone-900">₹{it.basePrice}</span>
                <span className={`inline-block h-2 w-2 rounded-sm ${it.isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
