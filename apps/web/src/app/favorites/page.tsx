'use client';

import { Header } from '@/components/Header';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import Link from 'next/link';
import { DishImage } from '@/components/DishImage';
import { dishPhoto } from '@/lib/photos';

type Favorite = {
  id: string;
  itemId: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  isVeg: boolean;
  categoryName: string;
};

export default function FavoritesPage() {
  const { user, loading } = useAuth();
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    const r = await api<{ favorites: Favorite[] }>('/api/v1/favorites');
    setFavs(r.favorites);
  }
  useEffect(() => { void load(); }, [user?.id]);

  async function remove(itemId: string) {
    setBusy(itemId);
    try {
      await api(`/api/v1/favorites/${itemId}`, { method: 'DELETE' });
      setFavs((cur) => cur.filter((f) => f.itemId !== itemId));
    } finally { setBusy(null); }
  }

  if (loading) return <><Header /><main className="p-8">…</main></>;
  if (!user) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-12 text-center">
          <h1 className="display text-3xl font-bold text-stone-900">Your favourites</h1>
          <p className="mt-3 text-stone-600">Log in to see what you've saved.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-3xl font-bold text-brand-900">Your favourites</h1>
        <p className="mt-1 text-sm text-stone-500">{favs.length} item{favs.length === 1 ? '' : 's'} saved.</p>

        {favs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
            <div className="text-5xl">♡</div>
            <p className="mt-3 text-stone-600">Tap the heart on any dish to save it for later.</p>
            <Link href="/menu" className="btn-primary mt-4 inline-flex">Browse menu</Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favs.map((f) => (
              <li key={f.id} className="card relative flex gap-3 p-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                  <DishImage src={dishPhoto(f.name, f.categoryName, f.imageUrl)} name={f.name} category={f.categoryName} className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start gap-1">
                    <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-sm ${f.isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <h3 className="display text-sm font-semibold text-stone-900">{f.name}</h3>
                  </div>
                  <p className="text-xs text-stone-500">{f.categoryName}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-sm font-bold text-stone-900">₹{f.basePrice}</span>
                    <Link href="/menu" className="text-xs font-semibold text-brand-700 hover:underline">View on menu</Link>
                  </div>
                </div>
                <button
                  onClick={() => remove(f.itemId)}
                  disabled={busy === f.itemId}
                  className="absolute right-2 top-2 text-rose-500 hover:text-rose-700"
                  aria-label="Remove favorite"
                >♥</button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
