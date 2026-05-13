'use client';

// Horizontal rail of bestseller + trending dishes at the very top of the menu.
// Filters to items with isBestseller or isTrending; sorted by rating × flags.

import { DishImage } from './DishImage';
import { dishPhoto } from '@/lib/photos';
import { VegDot } from './ui/VegDot';
import { RatingPill } from './ui/RatingPill';

type Item = {
  id: string;
  name: string;
  basePrice: number;
  isVeg: boolean;
  prepMinutes: number;
  imageUrl?: string | null;
  categoryName: string;
  isBestseller?: boolean;
  isTrending?: boolean;
  ratingAvg?: number | null;
  ratingCount?: number;
};

export function BestsellerRail({
  items,
  onPick,
}: {
  items: Item[];
  onPick?: (id: string) => void;
}) {
  const top = items
    .filter((i) => i.isBestseller || i.isTrending)
    .slice()
    .sort((a, b) => {
      const score = (x: Item) => (x.isBestseller ? 2 : 0) + (x.isTrending ? 1 : 0) + (x.ratingAvg ?? 0) * 0.2;
      return score(b) - score(a);
    })
    .slice(0, 10);

  if (top.length < 3) return null;

  return (
    <section className="bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h3 className="display text-xl font-bold text-stone-900">
              <span className="mr-1">★</span> Most loved this week
            </h3>
            <p className="text-xs text-stone-500">What's been flying out of the pan.</p>
          </div>
          <span className="text-[11px] uppercase tracking-wider text-stone-400">
            {top.length} picks
          </span>
        </div>
        <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-3 scrollbar-thin">
          {top.map((i) => (
            <button
              key={i.id}
              onClick={() => onPick?.(i.id)}
              className="group flex w-[200px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition hover:shadow-lg hover:shadow-stone-300/40"
            >
              <div className="relative h-32 w-full overflow-hidden bg-stone-100">
                <DishImage
                  src={dishPhoto(i.name, i.categoryName, i.imageUrl)}
                  name={i.name}
                  category={i.categoryName}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
                {i.isBestseller && (
                  <span className="absolute left-2 top-2 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                    ★ Bestseller
                  </span>
                )}
                {!i.isBestseller && i.isTrending && (
                  <span className="absolute left-2 top-2 rounded-md bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                    🔥 Trending
                  </span>
                )}
                {i.ratingAvg != null && (
                  <span className="absolute right-2 bottom-2">
                    <RatingPill rating={i.ratingAvg} count={i.ratingCount} size="sm" />
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <div className="flex items-start gap-1.5">
                  <span className="mt-[3px]"><VegDot veg={i.isVeg} size={11} /></span>
                  <h4 className="line-clamp-2 text-sm font-semibold text-stone-900">{i.name}</h4>
                </div>
                <div className="mt-auto flex items-baseline justify-between pt-1">
                  <span className="display text-base font-bold text-stone-900">₹{i.basePrice}</span>
                  <span className="text-[11px] text-stone-500">~{i.prepMinutes} min</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
