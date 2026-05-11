import { Router } from 'express';
import { prisma } from '../db';

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
      prepMinutes: i.prepMinutes,
      availDelivery: i.availDelivery,
      availDinein: i.availDinein,
      available: (i.inventory[0]?.available ?? 999) > 0,
      allergens,
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
