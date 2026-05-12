import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../auth';
import { pickedForUser, collections, busyness } from '../services/personalize';

export const menuRouter = Router();

menuRouter.get('/categories', async (_req, res) => {
  const cats = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
  });
  res.json({ categories: cats });
});

menuRouter.get('/items', async (req, res) => {
  const branchId = (req.query.branchId as string) || undefined;
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  const vegOnly = req.query.veg === '1' || req.query.veg === 'true';
  const maxSpice = req.query.maxSpice ? Number(req.query.maxSpice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
  const allergenFree = ((req.query.exclude as string) || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const requireTags = ((req.query.tags as string) || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const sort = ((req.query.sort as string) || 'default').toLowerCase();

  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: {
      category: true,
      modifierGroups: { include: { group: { include: { modifiers: true } } } },
      inventory: branchId ? { where: { branchId } } : true,
      reviews: { select: { rating: true } },
    },
    orderBy: { name: 'asc' },
  });

  let shaped = items.map((i) => {
    const allergens = safeJson<string[]>(i.allergens, []);
    const dietaryTags = safeJson<string[]>(i.dietaryTags, []);
    const gallery = safeJson<string[]>(i.gallery, []);
    const ratings = i.reviews.map((r) => r.rating);
    const ratingAvg = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;
    return {
      id: i.id,
      categoryId: i.categoryId,
      categoryName: i.category.name,
      name: i.name,
      description: i.description,
      basePrice: i.basePrice,
      isVeg: i.isVeg,
      spiceLevel: i.spiceLevel,
      imageUrl: i.imageUrl,
      gallery,
      prepMinutes: i.prepMinutes,
      availDelivery: i.availDelivery,
      availDinein: i.availDinein,
      available: (i.inventory[0]?.available ?? 999) > 0,
      allergens,
      dietaryTags,
      calories: i.calories,
      isBestseller: i.isBestseller,
      isTrending: i.isTrending,
      ratingAvg,
      ratingCount: ratings.length,
      modifierGroups: i.modifierGroups
        .sort((a, b) => a.position - b.position)
        .map((mg) => ({
          id: mg.group.id,
          name: mg.group.name,
          required: mg.group.required,
          minSelect: mg.group.minSelect,
          maxSelect: mg.group.maxSelect,
          modifiers: mg.group.modifiers
            .filter((m) => m.isActive)
            .sort((a, b) => a.position - b.position)
            .map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta })),
        })),
    };
  });

  // Filters applied in-memory (catalogue is small; <100 items)
  if (q) {
    shaped = shaped.filter((it) =>
      it.name.toLowerCase().includes(q) ||
      (it.description ?? '').toLowerCase().includes(q) ||
      it.categoryName.toLowerCase().includes(q));
  }
  if (vegOnly)        shaped = shaped.filter((it) => it.isVeg);
  if (maxSpice !== null) shaped = shaped.filter((it) => it.spiceLevel <= maxSpice);
  if (maxPrice !== null) shaped = shaped.filter((it) => it.basePrice <= maxPrice);
  if (allergenFree.length) {
    shaped = shaped.filter((it) => !it.allergens.some((a) => allergenFree.includes(a.toLowerCase())));
  }
  if (requireTags.length) {
    // Dietary tags are an AND filter — every requested tag must be present
    shaped = shaped.filter((it) => requireTags.every((t) => it.dietaryTags.map((x) => x.toLowerCase()).includes(t)));
  }

  // Sort the result. Default keeps the natural alphabetical ordering from Prisma.
  if (sort === 'price-asc')   shaped.sort((a, b) => a.basePrice - b.basePrice);
  else if (sort === 'price-desc')  shaped.sort((a, b) => b.basePrice - a.basePrice);
  else if (sort === 'rating')      shaped.sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));
  else if (sort === 'prep')        shaped.sort((a, b) => a.prepMinutes - b.prepMinutes);
  else if (sort === 'popular') {
    shaped.sort((a, b) => {
      const score = (it: typeof a) => (it.isBestseller ? 2 : 0) + (it.isTrending ? 1 : 0) + ((it.ratingAvg ?? 0) * 0.2);
      return score(b) - score(a);
    });
  }

  res.json({ items: shaped });
});

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

menuRouter.get('/branch', async (_req, res) => {
  const b = await prisma.branch.findFirst({ where: { isActive: true } });
  res.json({ branch: b });
});

// Personalized "Picked for you" — based on the user's order history + the
// current hour of day's popular items + bestsellers. Falls back gracefully
// for first-time visitors.
menuRouter.get('/picked-for-you', requireAuth(), async (req, res) => {
  const items = await pickedForUser(req.user!.id, 8);
  res.json({ items });
});

// Curated editorial collections — Late Night, Date Night, Hangover Cure, etc.
// Public, cacheable.
menuRouter.get('/collections', async (_req, res) => {
  const c = await collections();
  res.json({ collections: c });
});

// Busy / surge indicator. Returns level + extra ETA minutes so the front
// can show a "Busier than usual · +5 min" pill.
menuRouter.get('/busyness', async (_req, res) => {
  const b = await busyness();
  res.json(b);
});

// Trust cues for the homepage — "X orders in the last hour", trending dish.
// Lightweight, public, cached by the client for ~30s.
menuRouter.get('/live-cues', async (_req, res) => {
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const [ordersThisHour, ordersToday, trendingRow] = await Promise.all([
    prisma.order.count({
      where: { status: { notIn: ['CANCELLED', 'REFUNDED'] }, createdAt: { gte: hourAgo } },
    }),
    prisma.order.count({
      where: { status: { notIn: ['CANCELLED', 'REFUNDED'] }, createdAt: { gte: dayAgo } },
    }),
    prisma.orderItem.groupBy({
      by: ['itemId'],
      _sum: { qty: true },
      where: { order: { createdAt: { gte: dayAgo }, status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
      orderBy: { _sum: { qty: 'desc' } },
      take: 1,
    }),
  ]);

  let trending: { id: string; name: string; qty: number } | null = null;
  if (trendingRow[0]) {
    const item = await prisma.item.findUnique({ where: { id: trendingRow[0].itemId } });
    if (item) trending = { id: item.id, name: item.name, qty: trendingRow[0]._sum.qty ?? 0 };
  }

  res.json({ ordersThisHour, ordersToday, trending });
});
