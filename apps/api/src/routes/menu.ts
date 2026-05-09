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
  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: {
      category: true,
      modifierGroups: { include: { group: { include: { modifiers: true } } } },
      inventory: branchId ? { where: { branchId } } : true,
    },
    orderBy: { name: 'asc' },
  });
  // shape: include availability info
  const shaped = items.map((i) => ({
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
  }));
  res.json({ items: shaped });
});

menuRouter.get('/branch', async (_req, res) => {
  const b = await prisma.branch.findFirst({ where: { isActive: true } });
  res.json({ branch: b });
});
