'use client';

import { useEffect, useState } from 'react';

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  itemName: string | null;
  author: string;
  createdAt: string;
};

export function BranchReviews() {
  const [data, setData] = useState<{ ratingAvg: number | null; ratingCount: number; latest: Review[] } | null>(null);

  useEffect(() => {
    fetch('/api/v1/reviews/branch')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || data.latest.length === 0) return null;
  return (
    <section className="border-y border-stone-200 bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">From the customer reviews</span>
          <h2 className="mt-3 display text-4xl font-bold text-stone-900 md:text-5xl">
            {data.ratingAvg ? `${data.ratingAvg.toFixed(1)} stars` : 'Reviews'}{' '}
            <em className="italic text-brand-700">· {data.ratingCount} verified.</em>
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {data.latest.slice(0, 6).map((r) => (
            <div key={r.id} className="card relative h-full p-5">
              <div className="text-gold">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
              {r.itemName && (
                <div className="mt-1 text-xs uppercase tracking-wider text-stone-400">on {r.itemName}</div>
              )}
              {r.comment && (
                <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-stone-700">"{r.comment}"</p>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
                <span>— {r.author}</span>
                <span>{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
