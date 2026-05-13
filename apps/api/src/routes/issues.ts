// Order issues — customer submits a problem ("missing item" / "wrong item" /
// "late" / "cold" / "quality" / "billing" / "other"). Lands in an admin queue
// and surfaces on the order page as a chip ("Issue reported"). Admin can
// resolve with a refund amount (recorded on the issue).

import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { requireAuth } from '../auth';
import { bus } from '../realtime';

export const issuesRouter = Router();

const CATEGORIES = ['MISSING_ITEM', 'WRONG_ITEM', 'LATE', 'COLD', 'QUALITY', 'BILLING', 'OTHER'] as const;

// Customer creates an issue against one of their delivered orders.
issuesRouter.post('/', requireAuth(), async (req, res) => {
  const body = z.object({
    orderId: z.string(),
    category: z.enum(CATEGORIES),
    description: z.string().min(5).max(2000),
    photoUrl: z.string().url().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });

  const order = await prisma.order.findUnique({ where: { id: body.data.orderId } });
  if (!order || order.userId !== req.user!.id) return res.status(404).json({ error: 'order_not_found' });
  if (!['DELIVERED', 'OUT_FOR_DELIVERY', 'PAID', 'ACCEPTED', 'PREPARING', 'READY'].includes(order.status)) {
    return res.status(409).json({ error: 'bad_status' });
  }

  const issue = await prisma.orderIssue.create({
    data: {
      orderId: order.id,
      userId: req.user!.id,
      category: body.data.category,
      description: body.data.description,
      photoUrl: body.data.photoUrl ?? null,
      createdAt: now(),
    },
  });

  bus.emit('admin:issues', { id: issue.id, orderId: order.id, category: issue.category });
  res.json({ issue });
});

// Customer lists their issues (most recent first).
issuesRouter.get('/me', requireAuth(), async (req, res) => {
  const rows = await prisma.orderIssue.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json({ issues: rows });
});

// Customer fetches issues for a specific order.
issuesRouter.get('/order/:orderId', requireAuth(), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
  if (!order) return res.status(404).json({ error: 'not_found' });
  if (order.userId !== req.user!.id && !['ADMIN', 'OWNER'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const rows = await prisma.orderIssue.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ issues: rows });
});

// Admin queue + resolve
issuesRouter.get('/admin/queue', requireAuth(['ADMIN', 'OWNER']), async (_req, res) => {
  const rows = await prisma.orderIssue.findMany({
    where: { status: { in: ['OPEN', 'INVESTIGATING'] } },
    orderBy: { createdAt: 'asc' },
    include: { order: { select: { orderNumber: true, total: true } }, user: { select: { name: true, email: true } } },
    take: 100,
  });
  res.json({ issues: rows });
});

issuesRouter.post('/admin/:id/resolve', requireAuth(['ADMIN', 'OWNER']), async (req, res) => {
  const body = z.object({
    status: z.enum(['INVESTIGATING', 'RESOLVED', 'REJECTED']),
    resolution: z.string().max(2000).optional(),
    refundedAmount: z.number().nonnegative().max(50_000).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });

  const isTerminal = body.data.status === 'RESOLVED' || body.data.status === 'REJECTED';
  const updated = await prisma.orderIssue.update({
    where: { id: req.params.id },
    data: {
      status: body.data.status,
      resolution: body.data.resolution ?? undefined,
      refundedAmount: body.data.refundedAmount ?? undefined,
      resolvedAt: isTerminal ? now() : undefined,
    },
  });
  bus.emit('admin:issues', { id: updated.id, status: updated.status });
  res.json({ issue: updated });
});
