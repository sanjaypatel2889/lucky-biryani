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
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const item = await prisma.item.create({ data: body.data });
  res.json({ item });
});

adminRouter.patch('/items/:id', async (req, res) => {
  const item = await prisma.item.update({ where: { id: req.params.id }, data: req.body });
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

adminRouter.get('/automation/health', async (_req, res) => {
  res.json({
    workers: ['stale-orders', 'no-show-release', 'reminders', 'review-requests', 'demand-promo'],
    healthy: true,
    at: now(),
  });
});
