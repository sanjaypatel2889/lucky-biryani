'use client';

// Curated collection chips + a single rail for the active selection. Lives
// on the menu page above the category grid.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DishImage } from './DishImage';
import { dishPhoto } from '@/lib/photos';

type Item = {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  categoryName: string;
  isVeg: boolean;
  prepMinutes: number;
};

type Collection = {
  title: string;
  emoji: string;
  blurb: string;
  items: Item[];
};

export function CollectionsRails({ onPick }: { onPick?: (itemId: string) => void }) {
  const [data, setData] = useState<Record<string, Collection> | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    api<{ collections: Record<string, Collection> }>('/api/v1/menu/collections')
      .then((r) => {
        setData(r.collections);
        const first = Object.keys(r.collections)[0];
        setActive(first ?? null);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;
  const keys = Object.keys(data);
  const current = active ? data[active] : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => {
          const c = data[k];
          const on = active === k;
          return (
            <button
              key={k}
              onClick={() => setActive(k)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-stone-200 bg-white text-stone-600 hover:border-brand-300'}`}
            >
              <span className="mr-1">{c.emoji}</span>{c.title.split(' · ')[0].replace(/ for two| under .*| \(party.*\)/i, '')}
            </button>
          );
        })}
      </div>

      {current && (
        <div>
          <div className="flex items-baseline justify-between">
            <h3 className="display text-lg font-semibold text-stone-900">
              <span className="mr-1">{current.emoji}</span>{current.title}
            </h3>
            <span className="text-xs text-stone-400">{current.items.length} dishes</span>
          </div>
          <p className="text-xs text-stone-500">{current.blurb}</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {current.items.map((it) => (
              <button
                key={it.id}
                onClick={() => onPick?.(it.id)}
                className="card group flex w-40 shrink-0 flex-col overflow-hidden p-0 text-left transition hover:shadow-md"
              >
                <div className="aspect-square w-full overflow-hidden bg-stone-100">
                  <DishImage src={dishPhoto(it.name, it.categoryName, it.imageUrl)} name={it.name} category={it.categoryName} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                </div>
                <div className="flex flex-1 flex-col p-2">
                  <h4 className="line-clamp-1 text-xs font-semibold text-stone-900">{it.name}</h4>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-sm font-bold text-stone-900">₹{it.basePrice}</span>
                    <span className={`inline-block h-2 w-2 rounded-sm ${it.isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  </div>
                </div>
              </button>
            ))}
            {current.items.length === 0 && <p className="text-sm text-stone-400">No matches in this collection yet.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
