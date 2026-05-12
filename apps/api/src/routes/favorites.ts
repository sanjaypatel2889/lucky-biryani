// Wishlist / favorites — heart an item to come back to it later.

import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { requireAuth } from '../auth';

export const favoritesRouter = Router();

favoritesRouter.get('/', requireAuth(), async (req, res) => {
  const rows = await prisma.favorite.findMany({
    where: { userId: req.user!.id },
    include: { item: { include: { category: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    favorites: rows
      .filter((r) => r.item.isActive)
      .map((r) => ({
        id: r.id,
        itemId: r.itemId,
        name: r.item.name,
        basePrice: r.item.basePrice,
        imageUrl: r.item.imageUrl,
        isVeg: r.item.isVeg,
        categoryName: r.item.category.name,
        createdAt: r.createdAt,
      })),
  });
});

favoritesRouter.post('/:itemId', requireAuth(), async (req, res) => {
  const itemId = req.params.itemId;
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return res.status(404).json({ error: 'item_not_found' });
  const fav = await prisma.favorite.upsert({
    where: { userId_itemId: { userId: req.user!.id, itemId } },
    create: { userId: req.user!.id, itemId, createdAt: now() },
    update: {},
  });
  res.json({ favorite: fav });
});

favoritesRouter.delete('/:itemId', requireAuth(), async (req, res) => {
  await prisma.favorite
    .delete({ where: { userId_itemId: { userId: req.user!.id, itemId: req.params.itemId } } })
    .catch(() => {});
  res.json({ ok: true });
});

// Bulk lookup for the menu page — returns the set of itemIds the user has favorited
favoritesRouter.get('/ids', requireAuth(), async (req, res) => {
  const rows = await prisma.favorite.findMany({
    where: { userId: req.user!.id },
    select: { itemId: true },
  });
  res.json({ ids: rows.map((r) => r.itemId) });
});
