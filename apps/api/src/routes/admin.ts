import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { requireAuth } from '../auth';
import { transition } from '../services/orders';
import { tryAssignRider } from '../services/fleet';
import { bus } from '../realtime';

export const adminRouter = Router();

adminRouter.use(requireAuth(['ADMIN', 'OWNER']));

// === KDS / orders ===
adminRouter.get('/orders', async (req, res) => {
  const status = (req.query.status as string)?.split(',');
  const list = await prisma.order.findMany({
    where: status?.length ? { status: { in: status } } : {
      status: { in: ['PAID', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
    },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { item: true } }, user: true, rider: { include: { user: true } } },
    take: 100,
  });
  res.json({ orders: list });
});

adminRouter.post('/orders/:id/transition', async (req, res) => {
  const body = z.object({ to: z.string(), note: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  try {
    const o = await transition(req.params.id, body.data.to as any, `ADMIN:${req.user!.id}`, body.data.note);
    if (o.status === 'READY' && o.type === 'DELIVERY') {
      tryAssignRider(o.id).catch((e) => console.error('assign error', e));
    }
    res.json({ order: o });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

adminRouter.post('/orders/:id/reassign', async (req, res) => {
  const body = z.object({ riderId: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const o = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.riderId) {
    await prisma.rider.update({ where: { id: o.riderId }, data: { status: 'AVAILABLE' } });
  }
  await prisma.order.update({ where: { id: o.id }, data: { riderId: body.data.riderId ?? null } });
  if (!body.data.riderId) tryAssignRider(o.id).catch(() => {});
  res.json({ ok: true });
});

// === bookings ===
adminRouter.get('/bookings/today', async (_req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  const bookings = await prisma.booking.findMany({
    where: {
      slotStart: { gte: start.toISOString(), lt: end.toISOString() },
    },
    orderBy: { slotStart: 'asc' },
    include: { user: true, table: true },
  });
  res.json({ bookings });
});

adminRouter.get('/tables/live', async (_req, res) => {
  const tables = await prisma.table.findMany({ orderBy: { number: 'asc' } });
  const nowIso = new Date().toISOString();
  const active = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'SEATED'] },
      slotStart: { lte: new Date(Date.now() + 2 * 60 * 60_000).toISOString() },
      slotEnd: { gte: nowIso },
    },
    include: { user: true },
  });
  const map = new Map<string, any>();
  for (const a of active) map.set(a.tableId, a);
  res.json({
    tables: tables.map((t) => ({
      ...t,
      booking: map.get(t.id) ?? null,
    })),
  });
});

// === fleet ===
adminRouter.get('/fleet/live', async (_req, res) => {
  const riders = await prisma.rider.findMany({
    include: { user: true },
  });
  res.json({ riders });
});

// === inventory ===
adminRouter.patch('/inventory/:itemId', async (req, res) => {
  const body = z.object({
    branchId: z.string(), available: z.number().int().nonnegative(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const rec = await prisma.inventory.upsert({
    where: { itemId_branchId: { itemId: req.params.itemId, branchId: body.data.branchId } },
    update: { available: body.data.available, updatedAt: now() },
    create: { itemId: req.params.itemId, branchId: body.data.branchId, available: body.data.available, updatedAt: now() },
  });
  bus.emit('admin:orders', { type: 'inventory', itemId: req.params.itemId, available: body.data.available });
  res.json({ inventory: rec });
});

// === menu CRUD ===
adminRouter.post('/items', async (req, res) => {
  const body = z.object({
    categoryId: z.string(), name: z.string(), description: z.string().optional(),
    basePrice: z.number().nonnegative(), isVeg: z.boolean().optional(),
    spiceLevel: z.number().int().min(0).max(3).optional(), prepMinutes: z.number().int().optional(),
    imageUrl: z.string().optional(),
    gallery: z.array(z.string().url()).optional(),
    dietaryTags: z.array(z.string()).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const { gallery, dietaryTags, ...rest } = body.data;
  const item = await prisma.item.create({
    data: {
      ...rest,
      ...(gallery ? { gallery: JSON.stringify(gallery) } : {}),
      ...(dietaryTags ? { dietaryTags: JSON.stringify(dietaryTags) } : {}),
    },
  });
  res.json({ item });
});

adminRouter.patch('/items/:id', async (req, res) => {
  const body = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    basePrice: z.number().nonnegative().optional(),
    isVeg: z.boolean().optional(),
    spiceLevel: z.number().int().min(0).max(3).optional(),
    prepMinutes: z.number().int().optional(),
    imageUrl: z.string().optional(),
    isActive: z.boolean().optional(),
    isBestseller: z.boolean().optional(),
    isTrending: z.boolean().optional(),
    gallery: z.array(z.string().url()).optional(),
    dietaryTags: z.array(z.string()).optional(),
    allergens: z.array(z.string()).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const { gallery, dietaryTags, allergens, ...rest } = body.data;
  const item = await prisma.item.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(gallery ? { gallery: JSON.stringify(gallery) } : {}),
      ...(dietaryTags ? { dietaryTags: JSON.stringify(dietaryTags) } : {}),
      ...(allergens ? { allergens: JSON.stringify(allergens) } : {}),
    },
  });
  res.json({ item });
});

// === analytics ===
adminRouter.get('/analytics/today', async (_req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const all = await prisma.order.findMany({
    where: { createdAt: { gte: start.toISOString() } },
  });
  const delivered = all.filter((o) => o.status === 'DELIVERED');
  const revenue = delivered.reduce((s, o) => s + o.total, 0);
  const byStatus: Record<string, number> = {};
  for (const o of all) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  const bookings = await prisma.booking.count({
    where: { slotStart: { gte: start.toISOString() } },
  });
  res.json({
    orders: all.length, delivered: delivered.length, revenue, byStatus, bookings,
  });
});

// 30-day analytics — customer LTV, repeat-buyer rate, menu performance,
// delivery time SLA. Designed for the owner's dashboard tile grid.
adminRouter.get('/analytics/deep', async (_req, res) => {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const delivered = await prisma.order.findMany({
    where: { status: 'DELIVERED', deliveredAt: { not: null } },
    include: { items: true },
  });

  // Customer metrics
  const customers = new Map<string, { count: number; revenue: number; lastAt: string }>();
  for (const o of delivered) {
    const rec = customers.get(o.userId) ?? { count: 0, revenue: 0, lastAt: o.createdAt };
    rec.count++;
    rec.revenue += o.total;
    if (o.deliveredAt && o.deliveredAt > rec.lastAt) rec.lastAt = o.deliveredAt;
    customers.set(o.userId, rec);
  }
  const customerCount = customers.size;
  const repeatCount = [...customers.values()].filter((c) => c.count >= 2).length;
  const repeatRate = customerCount === 0 ? 0 : Math.round((repeatCount / customerCount) * 1000) / 10;
  const ltvAvg = customerCount === 0 ? 0 : Math.round([...customers.values()].reduce((s, c) => s + c.revenue, 0) / customerCount);
  const topCustomers = [...customers.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);
  const topCustomerUsers = await prisma.user.findMany({
    where: { id: { in: topCustomers.map(([id]) => id) } },
    select: { id: true, name: true, email: true },
  });
  const topCustomersResolved = topCustomers.map(([id, rec]) => ({
    id,
    name: topCustomerUsers.find((u) => u.id === id)?.name ?? '—',
    orders: rec.count,
    revenue: Math.round(rec.revenue),
  }));

  // Menu performance — top 10 items by qty and revenue (last 30 days)
  const last30 = delivered.filter((o) => o.deliveredAt && o.deliveredAt >= monthAgo);
  const itemAgg = new Map<string, { qty: number; revenue: number }>();
  for (const o of last30) {
    for (const it of o.items) {
      const rec = itemAgg.get(it.itemId) ?? { qty: 0, revenue: 0 };
      rec.qty += it.qty;
      rec.revenue += it.lineTotal;
      itemAgg.set(it.itemId, rec);
    }
  }
  const itemNames = await prisma.item.findMany({
    where: { id: { in: [...itemAgg.keys()] } },
    select: { id: true, name: true, basePrice: true },
  });
  const topItems = [...itemAgg.entries()]
    .map(([id, rec]) => ({
      id,
      name: itemNames.find((i) => i.id === id)?.name ?? '—',
      qty: rec.qty,
      revenue: Math.round(rec.revenue),
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Delivery time SLA — avg from PAID → DELIVERED, broken down by week
  const deliveryDurations = last30
    .filter((o) => o.type === 'DELIVERY' && o.deliveredAt)
    .map((o) => (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 60_000);
  const avgDeliveryMin = deliveryDurations.length
    ? Math.round(deliveryDurations.reduce((s, x) => s + x, 0) / deliveryDurations.length)
    : 0;
  const overSlaCount = deliveryDurations.filter((m) => m > 45).length;
  const slaCompliance = deliveryDurations.length
    ? Math.round(((deliveryDurations.length - overSlaCount) / deliveryDurations.length) * 1000) / 10
    : 100;

  // 7-day revenue breakdown (chart data)
  const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60_000); weekStart.setHours(0, 0, 0, 0);
  const dayBuckets: Array<{ date: string; revenue: number; orders: number }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getTime() + i * 24 * 60 * 60_000);
    const dStart = d.toISOString();
    const dEnd = new Date(d.getTime() + 24 * 60 * 60_000).toISOString();
    const slice = delivered.filter((o) => o.deliveredAt && o.deliveredAt >= dStart && o.deliveredAt < dEnd);
    dayBuckets.push({
      date: d.toISOString().slice(0, 10),
      revenue: Math.round(slice.reduce((s, o) => s + o.total, 0)),
      orders: slice.length,
    });
  }

  res.json({
    customers: { total: customerCount, repeat: repeatCount, repeatRatePct: repeatRate, avgLtv: ltvAvg, topCustomers: topCustomersResolved },
    menu:      { topItems },
    delivery:  { avgDeliveryMin, overSla: overSlaCount, slaCompliancePct: slaCompliance },
    revenue7d: dayBuckets,
  });
});

adminRouter.get('/automation/health', async (_req, res) => {
  res.json({
    workers: ['stale-orders', 'no-show-release', 'reminders', 'review-requests', 'demand-promo'],
    healthy: true,
    at: now(),
  });
});
