'use client';

import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { useAuth } from '@/lib/auth-store';
import { dishPhoto } from '@/lib/photos';
import { DishImage } from '@/components/DishImage';
import { CollectionsRails } from '@/components/CollectionsRails';
import { BusyIndicator } from '@/components/BusyIndicator';
import { Stagger } from '@/components/ui/Stagger';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { flyToCart } from '@/lib/flyToCart';
import { useToast } from '@/components/ui/Toast';
import { TOAST } from '@/lib/copy';

type Modifier = { id: string; name: string; priceDelta: number };
type ModifierGroup = {
  id: string; name: string; required: boolean;
  minSelect: number; maxSelect: number; modifiers: Modifier[];
};
type MenuItem = {
  id: string; categoryId: string; categoryName: string;
  name: string; description: string | null; basePrice: number;
  isVeg: boolean; spiceLevel: number; available: boolean;
  prepMinutes: number; modifierGroups: ModifierGroup[];
  imageUrl?: string | null;
  gallery?: string[];
  allergens?: string[]; calories?: number | null;
  dietaryTags?: string[];
  isBestseller?: boolean; isTrending?: boolean;
  ratingAvg?: number | null; ratingCount?: number;
};

const ALLERGENS = ['milk', 'gluten', 'egg', 'tree-nuts', 'crustaceans', 'soy'];
const DIETARY_TAGS: Array<{ id: string; label: string; emoji: string }> = [
  { id: 'vegan',             label: 'Vegan',        emoji: '🌱' },
  { id: 'jain',              label: 'Jain',         emoji: '🪷' },
  { id: 'eggless',           label: 'Eggless',      emoji: '🥚' },
  { id: 'halal',             label: 'Halal',        emoji: '✓' },
  { id: 'gluten-free',       label: 'Gluten-free',  emoji: '🌾' },
  { id: 'diabetic-friendly', label: 'Diabetic-friendly', emoji: '💚' },
];
const SORT_OPTIONS = [
  { id: 'default',    label: 'Recommended' },
  { id: 'popular',    label: 'Most popular' },
  { id: 'price-asc',  label: 'Price: low → high' },
  { id: 'price-desc', label: 'Price: high → low' },
  { id: 'rating',     label: 'Highest rated' },
  { id: 'prep',       label: 'Fastest prep' },
];

type Category = { id: string; name: string; slug: string };

export default function MenuPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [maxSpice, setMaxSpice] = useState(3);
  const [maxPrice, setMaxPrice] = useState(500);
  const [exclude, setExclude] = useState<string[]>([]);
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [dietary, setDietary] = useState<string[]>([]);
  const [sort, setSort] = useState<string>('default');
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [heartedId, setHeartedId] = useState<string | null>(null);

  useEffect(() => {
    api<{ categories: Category[] }>('/api/v1/menu/categories').then((r) => {
      setCats(r.categories);
      if (r.categories[0]) setActiveCat(r.categories[0].id);
    });
  }, []);

  // Refetch items when server-side filters change (dietary tags + sort go
  // through the API; everything else is client-side over the same dataset).
  useEffect(() => {
    const params = new URLSearchParams();
    if (dietary.length) params.set('tags', dietary.join(','));
    if (sort !== 'default') params.set('sort', sort);
    const qs = params.toString();
    setLoading(true);
    api<{ items: MenuItem[] }>(`/api/v1/menu/items${qs ? `?${qs}` : ''}`)
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [dietary, sort]);

  // Load user's favorite item IDs on login
  useEffect(() => {
    if (!user) { setFavIds(new Set()); return; }
    api<{ ids: string[] }>('/api/v1/favorites/ids').then((r) => setFavIds(new Set(r.ids))).catch(() => {});
  }, [user?.id]);

  async function toggleFavorite(itemId: string) {
    if (!user) return;
    const isFav = favIds.has(itemId);
    // Optimistic
    setFavIds((cur) => {
      const next = new Set(cur);
      if (isFav) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    // Trigger pop only when adding (not when removing)
    if (!isFav) {
      setHeartedId(itemId);
      window.setTimeout(() => setHeartedId((cur) => cur === itemId ? null : cur), 500);
    }
    try {
      await api(`/api/v1/favorites/${itemId}`, { method: isFav ? 'DELETE' : 'POST' });
      const name = items.find((i) => i.id === itemId)?.name ?? 'Item';
      toast.success(isFav ? TOAST.unfavoritedItem(name) : TOAST.favoritedItem(name));
    } catch {
      // Revert on failure
      setFavIds((cur) => {
        const next = new Set(cur);
        if (isFav) next.add(itemId);
        else next.delete(itemId);
        return next;
      });
      toast.error(TOAST.error);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (vegOnly && !i.isVeg) return false;
      if (q && !(
        i.name.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        i.categoryName.toLowerCase().includes(q)
      )) return false;
      if (i.spiceLevel > maxSpice) return false;
      if (i.basePrice > maxPrice) return false;
      if (exclude.length && (i.allergens ?? []).some((a) => exclude.includes(a))) return false;
      return true;
    });
  }, [items, search, vegOnly, maxSpice, maxPrice, exclude]);

  const totalCount = filtered.length;

  const grouped = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const i of filtered) {
      const arr = m.get(i.categoryId) ?? [];
      arr.push(i); m.set(i.categoryId, arr);
    }
    return m;
  }, [filtered]);

  return (
    <>
      <Header />

      {/* Menu hero band */}
      <section className="relative overflow-hidden bg-stone-900 text-white">
        <img src={dishPhoto('Hyderabadi Chicken Biryani')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-900/80 to-stone-900/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-20">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">The menu</span>
          <h1 className="mt-2 display text-4xl font-bold leading-tight md:text-6xl">
            Pick what you crave. <em className="italic font-medium text-gold">We'll handle the rest.</em>
          </h1>
          <p className="mt-3 max-w-xl text-white/70">19 dishes, every one of them customisable. Spice levels go from "just warm" to "I'll regret this later".</p>
          <div className="mt-4"><BusyIndicator inline /></div>
        </div>
      </section>

      {/* Curated collection rails */}
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <CollectionsRails
          onPick={(itemId) => {
            const it = items.find((i) => i.id === itemId);
            if (it) setPicking(it);
          }}
        />
      </section>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[260px_1fr]">
        <aside className="md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto">
          <div className="card p-4 space-y-4">
            <input
              className="input"
              placeholder="Search dish, ingredient, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} />
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Veg only
              </span>
            </label>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">Dietary</div>
              <div className="flex flex-wrap gap-1.5">
                {DIETARY_TAGS.map((d) => {
                  const on = dietary.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => setDietary((cur) => on ? cur.filter((x) => x !== d.id) : [...cur, d.id])}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-emerald-200'}`}
                    >
                      <span className="mr-1">{d.emoji}</span>{d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">Sort</div>
              <select className="input !py-1.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-500">
                <span>Max spice</span>
                <span>{['mild','medium','hot','extra hot'][maxSpice]}</span>
              </div>
              <input type="range" min={0} max={3} value={maxSpice} onChange={(e) => setMaxSpice(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-500">
                <span>Max price</span>
                <span>₹{maxPrice}</span>
              </div>
              <input type="range" min={50} max={500} step={10} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">Skip allergens</div>
              <div className="flex flex-wrap gap-1.5">
                {ALLERGENS.map((a) => {
                  const on = exclude.includes(a);
                  return (
                    <button key={a}
                      onClick={() => setExclude((cur) => on ? cur.filter((x) => x !== a) : [...cur, a])}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-rose-200 hover:bg-rose-50/40'}`}>
                      {on ? '✗ ' : ''}{a}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-stone-500">
              Showing <strong className="text-stone-900">{totalCount}</strong> of {items.length} dishes
            </div>

            <ul className="space-y-1 border-t border-stone-100 pt-3">
              {cats.map((c) => {
                const list = grouped.get(c.id) ?? [];
                if (!list.length) return null;
                return (
                  <li key={c.id}>
                    <a
                      href={`#cat-${c.slug}`}
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition ${activeCat === c.id ? 'bg-brand-100 font-medium text-brand-900' : 'text-stone-600 hover:bg-stone-100'}`}
                      onClick={() => setActiveCat(c.id)}>
                      <span>{c.name}</span>
                      <span className="text-xs text-stone-400">{list.length}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <div className="space-y-14">
          {loading && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={idx} />)}
            </div>
          )}
          {!loading && cats.map((c) => {
            const list = grouped.get(c.id) ?? [];
            if (!list.length) return null;
            return (
              <section key={c.id} id={`cat-${c.slug}`}>
                <div className="mb-4 flex items-end justify-between border-b border-stone-200 pb-3">
                  <h2 className="display text-3xl font-bold text-stone-900">{c.name}</h2>
                  <span className="text-xs uppercase tracking-wider text-stone-400">{list.length} dishes</span>
                </div>
                <Stagger mountKey={`${c.id}-${list.length}-${sort}`} className="grid gap-4 md:grid-cols-2">
                  {list.map((i) => (
                    <div key={i.id} className="card group flex gap-4 overflow-hidden p-4 transition hover:shadow-md hover:shadow-stone-300/50">
                      <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                        <DishImage
                          src={dishPhoto(i.name, i.categoryName, i.imageUrl)}
                          name={i.name}
                          category={i.categoryName}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                        />
                        {!i.available && (
                          <div className="absolute inset-0 grid place-items-center bg-stone-900/60 text-xs font-semibold uppercase tracking-wider text-white">Sold out</div>
                        )}
                        {i.isBestseller && (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">★ Bestseller</span>
                        )}
                        {!i.isBestseller && i.isTrending && (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">🔥 Trending</span>
                        )}
                        {user && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(i.id); }}
                            className={`absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full backdrop-blur-sm transition ${favIds.has(i.id) ? 'bg-rose-500 text-white shadow' : 'bg-white/90 text-stone-500 hover:bg-white hover:text-rose-500'} ${heartedId === i.id ? 'animate-heart-pop' : ''}`}
                            aria-label={favIds.has(i.id) ? 'Remove from favorites' : 'Save to favorites'}
                          >
                            {favIds.has(i.id) ? '♥' : '♡'}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1 inline-block h-3 w-3 shrink-0 border ${i.isVeg ? 'border-emerald-700' : 'border-rose-700'}`}>
                            <span className={`block h-full w-full ${i.isVeg ? 'bg-emerald-600' : 'bg-rose-600'} translate-y-[2px] translate-x-[2px] scale-50 rounded-full`} />
                          </span>
                          <h3 className="display text-lg font-semibold text-stone-900">{i.name}</h3>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-stone-500">{i.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                          {i.ratingAvg != null && (
                            <span className="flex items-center gap-1 text-amber-600">
                              ★ {i.ratingAvg.toFixed(1)} <span className="text-stone-400">({i.ratingCount})</span>
                            </span>
                          )}
                          {i.spiceLevel >= 2 && <span className="chip bg-rose-50 text-rose-700">🌶 hot</span>}
                          <span>~{i.prepMinutes} min</span>
                          {typeof i.calories === 'number' && <span>{i.calories} kcal</span>}
                        </div>
                        {(i.allergens && i.allergens.length > 0) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {i.allergens.slice(0, 4).map((a) => (
                              <span key={a} className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-stone-500">{a}</span>
                            ))}
                          </div>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-3">
                          <span className="display text-xl font-bold text-stone-900">₹{i.basePrice}</span>
                          {i.available && (
                            <button className="btn-primary !py-1.5 text-sm" onClick={() => setPicking(i)}>Add +</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </Stagger>
              </section>
            );
          })}
        </div>
      </main>
      {picking && <ItemPicker item={picking} onClose={() => setPicking(null)} />}
      <CartFloater />
    </>
  );
}

function ItemPicker({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { add } = useCart();
  const toast = useToast();
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [photoIdx, setPhotoIdx] = useState(0);

  // Build gallery from server + fallback to dishPhoto so there's always at
  // least one image. De-dupe so we don't show the same photo twice.
  const photos = useMemo(() => {
    const list = [item.imageUrl, ...(item.gallery ?? [])].filter(Boolean) as string[];
    if (list.length === 0) {
      const f = dishPhoto(item.name, item.categoryName);
      if (f) list.push(f);
    }
    return Array.from(new Set(list));
  }, [item]);

  function toggle(g: ModifierGroup, mid: string) {
    setSelected((prev) => {
      const cur = prev[g.id] ?? [];
      let next: string[];
      if (g.maxSelect === 1) next = [mid];
      else next = cur.includes(mid) ? cur.filter((x) => x !== mid) : [...cur, mid].slice(0, g.maxSelect);
      return { ...prev, [g.id]: next };
    });
  }

  const allModIds = Object.values(selected).flat();
  const modSum = item.modifierGroups
    .flatMap((g) => g.modifiers.filter((m) => allModIds.includes(m.id)))
    .reduce((s, m) => s + m.priceDelta, 0);
  const unit = item.basePrice + modSum;

  const valid = item.modifierGroups.every((g) => {
    const c = (selected[g.id] ?? []).length;
    return c >= g.minSelect && c <= g.maxSelect;
  });

  function add2cart(e?: React.MouseEvent<HTMLButtonElement>) {
    if (!valid) return;
    const labels = item.modifierGroups
      .flatMap((g) => g.modifiers.filter((m) => allModIds.includes(m.id)))
      .map((m) => m.name);
    add({
      itemId: item.id, name: item.name, qty,
      unitPrice: unit, modifierIds: allModIds, modifierLabels: labels,
      notes: notes || undefined,
    });
    // Fly-to-cart from the modal's photo (top of the modal)
    const img = (e?.currentTarget as HTMLElement | undefined)?.closest('.card')?.querySelector('img') as HTMLElement | null;
    flyToCart(img);
    toast.success(TOAST.addedToCart(item.name));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="card relative w-full max-w-lg overflow-hidden p-0 sm:max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-56 overflow-hidden">
          <DishImage src={photos[photoIdx] ?? dishPhoto(item.name, item.categoryName)} name={item.name} category={item.categoryName} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-transparent to-transparent" />
          {photos.length > 1 && (
            <>
              <button
                onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-stone-700 shadow hover:bg-white"
                aria-label="Previous photo"
              >‹</button>
              <button
                onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                className="absolute right-14 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-stone-700 shadow hover:bg-white"
                aria-label="Next photo"
              >›</button>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {photos.map((_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`} />
                ))}
              </div>
            </>
          )}
          <button onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-stone-700 shadow hover:bg-white">✕</button>
          <div className="absolute bottom-6 left-4 right-4">
            <h3 className="display text-2xl font-bold text-white drop-shadow">{item.name}</h3>
            <p className="text-sm text-white/85">{item.description}</p>
            {(item.dietaryTags && item.dietaryTags.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.dietaryTags.slice(0, 5).map((t) => (
                  <span key={t} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white backdrop-blur">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5">
          {item.modifierGroups.map((g) => (
            <div key={g.id} className="mt-2 first:mt-0">
              <div className="flex items-baseline justify-between">
                <h4 className="font-semibold text-stone-900">{g.name}</h4>
                <span className="text-xs text-stone-400">
                  {g.required ? 'required' : 'optional'} · pick {g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {g.modifiers.map((m) => {
                  const isOn = (selected[g.id] ?? []).includes(m.id);
                  return (
                    <button key={m.id}
                            onClick={() => toggle(g, m.id)}
                            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${isOn ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                      <span className="flex items-center gap-2">
                        <span className={`grid h-4 w-4 place-items-center rounded-full border ${isOn ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300'}`}>
                          {isOn && <span className="text-[10px]">✓</span>}
                        </span>
                        {m.name}
                      </span>
                      <span className="text-xs text-stone-500">{m.priceDelta === 0 ? '—' : (m.priceDelta > 0 ? '+' : '') + '₹' + m.priceDelta}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-stone-100" />
            </div>
          ))}

          <div className="mt-4">
            <label className="label">Special instructions</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Less oil, no cilantro, etc." />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-stone-200 bg-cream p-4">
          <div className="flex items-center gap-2">
            <button className="btn-secondary !px-3" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span className="w-8 text-center font-medium">{qty}</span>
            <button className="btn-secondary !px-3" onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <button
            className="btn-primary flex-1"
            disabled={!valid}
            onClick={(e) => {
              const btn = e.currentTarget;
              btn.classList.remove('animate-press');
              void btn.offsetWidth;
              btn.classList.add('animate-press');
              add2cart(e);
            }}
          >
            Add — ₹{(unit * qty).toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartFloater() {
  const { count, total } = useCart();
  if (count === 0) return null;
  return (
    <a href="/cart" className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-brand-600 px-6 py-3 text-white shadow-xl shadow-brand-500/40 transition hover:bg-brand-700 hover:shadow-2xl">
      <strong>{count}</strong> in cart · ₹{total.toFixed(0)} <span className="ml-1">→</span>
    </a>
  );
}
