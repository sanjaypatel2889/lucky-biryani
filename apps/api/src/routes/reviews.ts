// Reviews — public list + authenticated submission. A review is bound to a
// delivered order; one review per (order, item) pair. Owner can reply once.

import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { requireAuth } from '../auth';

export const reviewsRouter = Router();

// Public — list reviews for an item with the customer's first name only
reviewsRouter.get('/item/:itemId', async (req, res) => {
  const itemId = req.params.itemId;
  const rows = await prisma.review.findMany({
    where: { itemId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const ratings = rows.map((r) => r.rating);
  const ratingAvg = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;
  res.json({
    ratingAvg,
    ratingCount: ratings.length,
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      ownerReply: r.ownerReply,
      ownerReplyAt: r.ownerReplyAt,
      author: firstName(r.user?.name ?? null),
      createdAt: r.createdAt,
    })),
  });
});

// Public — branch level summary
reviewsRouter.get('/branch', async (_req, res) => {
  const rows = await prisma.review.findMany({
    include: { user: { select: { name: true } }, item: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  const all = await prisma.review.findMany({ select: { rating: true } });
  const ratingAvg = all.length
    ? Math.round((all.reduce((a, r) => a + r.rating, 0) / all.length) * 10) / 10
    : null;
  res.json({
    ratingAvg,
    ratingCount: all.length,
    latest: rows.map((r) => ({
      id: r.id, rating: r.rating, comment: r.comment,
      itemName: r.item?.name ?? null,
      author: firstName(r.user?.name ?? null),
      createdAt: r.createdAt,
    })),
  });
});

// Customer — submit a review after delivery
reviewsRouter.post('/', requireAuth(), async (req, res) => {
  const body = z.object({
    orderId: z.string(),
    itemId: z.string().optional(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });

  const order = await prisma.order.findUnique({ where: { id: body.data.orderId } });
  if (!order || order.userId !== req.user!.id) {
    return res.status(404).json({ error: 'order_not_found' });
  }
  if (order.status !== 'DELIVERED') {
    return res.status(409).json({ error: 'order_not_delivered' });
  }
  // dedupe per (order,item) pair
  const existing = await prisma.review.findFirst({
    where: { orderId: order.id, itemId: body.data.itemId ?? null, userId: req.user!.id },
  });
  if (existing) return res.status(409).json({ error: 'review_exists', reviewId: existing.id });

  const r = await prisma.review.create({
    data: {
      orderId: order.id,
      userId: req.user!.id,
      itemId: body.data.itemId ?? null,
      rating: body.data.rating,
      comment: body.data.comment ?? null,
      createdAt: now(),
    },
  });
  res.json({ review: { id: r.id } });
});

// Customer — list my reviews
reviewsRouter.get('/me', requireAuth(), async (req, res) => {
  const rows = await prisma.review.findMany({
    where: { userId: req.user!.id },
    include: { item: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ reviews: rows });
});

// Owner / Admin — reply to a review
reviewsRouter.post('/:id/reply', requireAuth(['OWNER', 'ADMIN']), async (req, res) => {
  const body = z.object({ reply: z.string().min(1).max(1000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  try {
    const r = await prisma.review.update({
      where: { id: req.params.id },
      data: { ownerReply: body.data.reply, ownerReplyAt: now() },
    });
    res.json({ review: { id: r.id, ownerReply: r.ownerReply } });
  } catch {
    res.status(404).json({ error: 'review_not_found' });
  }
});

function firstName(name: string | null): string {
  if (!name) return 'Diner';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}
