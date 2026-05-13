'use client';

// Horizontal round-icon rail at the top of /menu — a fast visual scan of
// every category with a cover image. Click jumps to that category section.
// Implements scroll-into-view on click and an active-state ring.

import { useState } from 'react';
import { DishImage } from './DishImage';
import { dishPhoto } from '@/lib/photos';

type Category = { id: string; name: string; slug: string };

export function CuisineRail({
  categories,
  countByCat,
  onPick,
}: {
  categories: Category[];
  countByCat: Map<string, number>;
  onPick?: (cat: Category) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  if (!categories.length) return null;

  function jump(c: Category) {
    setActive(c.id);
    onPick?.(c);
    const el = document.getElementById(`cat-${c.slug}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  return (
    <section className="border-b border-stone-100 bg-cream/40">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
          Browse by category
        </h3>
        <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2 scrollbar-thin">
          {categories.map((c) => {
            const n = countByCat.get(c.id) ?? 0;
            if (!n) return null;
            const isActive = active === c.id;
            return (
              <button
                key={c.id}
                onClick={() => jump(c)}
                className="group flex w-[88px] shrink-0 snap-start flex-col items-center"
              >
                <span
                  className={`relative grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full border-2 transition ${
                    isActive
                      ? 'border-brand-600 shadow-md shadow-brand-200'
                      : 'border-stone-200 group-hover:border-brand-300'
                  }`}
                >
                  <DishImage
                    src={dishPhoto(c.name, c.name)}
                    name={c.name}
                    category={c.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                </span>
                <span className="mt-1.5 line-clamp-2 text-center text-[11px] font-medium leading-tight text-stone-700">
                  {c.name}
                </span>
                <span className="text-[10px] text-stone-400">{n} dish{n === 1 ? '' : 'es'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
