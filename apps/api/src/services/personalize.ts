// Personalization + curated collections — rule-based, deterministic. Real
// platforms run ML/embeddings; for a single-restaurant catalogue we can
// produce great picks with a tiny scorer over order history + time of day.

import { prisma } from '../db';

type Dish = Awaited<ReturnType<typeof loadAllActive>>[number];

async function loadAllActive() {
  return prisma.item.findMany({
    where: { isActive: true },
    include: { category: true, reviews: { select: { rating: true } } },
  });
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function shape(d: Dish) {
  const allergens = safeJson<string[]>(d.allergens, []);
  const dietaryTags = safeJson<string[]>(d.dietaryTags, []);
  const ratings = d.reviews.map((r) => r.rating);
  const ratingAvg = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    basePrice: d.basePrice,
    imageUrl: d.imageUrl,
    isVeg: d.isVeg,
    spiceLevel: d.spiceLevel,
    prepMinutes: d.prepMinutes,
    categoryName: d.category.name,
    calories: d.calories,
    isBestseller: d.isBestseller,
    isTrending: d.isTrending,
    allergens,
    dietaryTags,
    ratingAvg,
    ratingCount: ratings.length,
  };
}

// "Picked for you" — leans on what the user has historically reordered,
// the current hour's typical orders, and bestsellers as a floor. Falls
// back to bestsellers when the user has no order history.
export async function pickedForUser(userId: string, limit = 8) {
  const all = await loadAllActive();

  // 1. User's past order items (frequency by itemId)
  const my = await prisma.orderItem.groupBy({
    by: ['itemId'],
    _sum: { qty: true },
    where: { order: { userId, status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
  });
  const myMap = new Map(my.map((r) => [r.itemId, r._sum.qty ?? 0]));

  // 2. Hour-of-day popularity (last 30 days, this clock hour ±1)
  const now = new Date();
  const hour = now.getHours();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const recent = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: monthAgo }, status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
    select: { itemId: true, qty: true, order: { select: { createdAt: true } } },
  });
  const hourMap = new Map<string, number>();
  for (const r of recent) {
    const h = new Date(r.order.createdAt).getHours();
    if (Math.abs(h - hour) <= 1) {
      hourMap.set(r.itemId, (hourMap.get(r.itemId) ?? 0) + r.qty);
    }
  }
  const hourMax = Math.max(1, ...hourMap.values());

  // 3. Score = my frequency (60%) + hour popularity (25%) + bestseller bonus (15%)
  const scored = all.map((d) => {
    const myScore = Math.min(1, (myMap.get(d.id) ?? 0) / 3); // saturate at 3+ past orders
    const hourScore = (hourMap.get(d.id) ?? 0) / hourMax;
    const bestScore = (d.isBestseller ? 1 : 0) * 0.6 + (d.isTrending ? 1 : 0) * 0.4;
    const score = 0.6 * myScore + 0.25 * hourScore + 0.15 * bestScore;
    return { d, score };
  });

  // Ensure diversity — at most 1 dish per category in the top picks
  scored.sort((a, b) => b.score - a.score);
  const seenCat = new Set<string>();
  const picks: typeof scored = [];
  for (const x of scored) {
    if (picks.length >= limit) break;
    const c = x.d.category.name;
    if (seenCat.has(c)) continue;
    seenCat.add(c);
    picks.push(x);
  }
  // Pad with high-score dupes if we ran out
  for (const x of scored) {
    if (picks.length >= limit) break;
    if (picks.find((p) => p.d.id === x.d.id)) continue;
    picks.push(x);
  }

  return picks.map((x) => ({ ...shape(x.d), reason: reasonFor(x.d, myMap, hourMap, hour) }));
}

function reasonFor(d: Dish, myMap: Map<string, number>, hourMap: Map<string, number>, hour: number): string {
  if (myMap.has(d.id) && (myMap.get(d.id) ?? 0) >= 2) return 'You order this often';
  if (myMap.has(d.id)) return 'Because you ordered this before';
  if ((hourMap.get(d.id) ?? 0) > 0) {
    if (hour < 12) return 'Popular for breakfast';
    if (hour < 17) return 'Popular at lunch';
    if (hour < 22) return 'Popular for dinner';
    return 'Popular late-night';
  }
  if (d.isBestseller) return 'Bestseller';
  if (d.isTrending) return 'Trending';
  return 'You might like';
}

// Curated collections — fixed editorial buckets that match real ordering moods.
// Returns 4-6 dishes per collection so we can render a horizontal rail.
export async function collections() {
  const all = (await loadAllActive()).map((d) => ({ raw: d, ...shape(d) }));

  function pick(predicate: (d: typeof all[number]) => boolean, limit = 6) {
    return all
      .filter(predicate)
      .sort((a, b) => {
        if (a.isBestseller !== b.isBestseller) return a.isBestseller ? -1 : 1;
        return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
      })
      .slice(0, limit)
      .map(({ raw, ...rest }) => rest);
  }

  return {
    'quick-bites': {
      title: 'Quick bites · under 15 min',
      emoji: '⚡',
      blurb: 'When you have ten minutes and a hungry stomach.',
      items: pick((d) => d.raw.prepMinutes <= 15),
    },
    'date-night': {
      title: 'Date night for two',
      emoji: '💛',
      blurb: 'Premium spread, well-paced. Pair with a Mango Lassi.',
      items: pick((d) =>
        d.basePrice >= 240 &&
        /Biryani|Curries|Tandoor|Kebab|Paneer|Mutton/i.test(d.categoryName + ' ' + d.name)),
    },
    'late-night': {
      title: 'Late-night fix',
      emoji: '🌙',
      blurb: 'Comforting, easy on the stomach, fast.',
      items: pick((d) =>
        d.raw.prepMinutes <= 20 &&
        (d.dietaryTags.includes('diabetic-friendly') ||
         /Naan|Roti|Chai|Lassi|65|Manchurian|Tikka/.test(d.name))),
    },
    'hangover-cure': {
      title: 'Hangover cure',
      emoji: '🌶️',
      blurb: 'Heavy on the spice and protein. Trust us.',
      items: pick((d) => d.spiceLevel >= 2 && !d.isVeg),
    },
    'family-feast': {
      title: 'Family feast (party of 4+)',
      emoji: '🍽',
      blurb: 'Mix of veg + non-veg, mild-to-medium spice.',
      items: pick((d) =>
        /Biryani|Curries|Breads|Desserts/i.test(d.categoryName) &&
        d.basePrice >= 200 && d.basePrice <= 460),
    },
    'just-veg': {
      title: 'All-veg menu',
      emoji: '🌱',
      blurb: 'A complete meal — starter, mains, bread, dessert.',
      items: pick((d) => d.isVeg && d.basePrice >= 80),
    },
  };
}

// Busy / surge indicator. Looks at active orders in the kitchen vs a soft
// capacity ceiling (configurable). Returns one of 4 states + extra ETA
// padding so the frontend can show "Busier than usual · +5 min".
export async function busyness() {
  const SOFT_CAP = 12; // ~12 concurrent in-kitchen orders is comfortable
  const active = await prisma.order.count({
    where: { status: { in: ['PAID', 'ACCEPTED', 'PREPARING', 'READY'] } },
  });
  const ratio = active / SOFT_CAP;
  let level: 'quiet' | 'normal' | 'busy' | 'slammed';
  let extraEtaMin = 0;
  if (ratio < 0.4) { level = 'quiet';   extraEtaMin = 0; }
  else if (ratio < 0.85) { level = 'normal'; extraEtaMin = 0; }
  else if (ratio < 1.2)  { level = 'busy';   extraEtaMin = 5; }
  else                   { level = 'slammed'; extraEtaMin = 12; }
  return { level, activeOrders: active, softCap: SOFT_CAP, extraEtaMin };
}
