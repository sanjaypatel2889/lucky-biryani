import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { requireAuth } from '../auth';
import { buildQuote, CartLine } from '../services/pricing';
import { newOrderNumber } from '../util/ids';
import { payments } from '../services/payments';
import { transition } from '../services/orders';
import { bus } from '../realtime';

function randomOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export const orderRouter = Router();

const cartSchema = z.array(
  z.object({
    itemId: z.string(),
    qty: z.number().int().positive(),
    modifierIds: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
);

orderRouter.post('/quote', async (req, res) => {
  const body = z
    .object({
      branchId: z.string(),
      type: z.enum(['DELIVERY', 'PICKUP', 'DINEIN']),
      cart: cartSchema,
      destination: z.object({ lat: z.number(), lng: z.number() }).optional(),
      couponCode: z.string().optional(),
      loyaltyPointsToUse: z.number().int().nonnegative().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body', detail: body.error.issues });
  const q = await buildQuote(body.data);
  res.json(q);
});

orderRouter.post('/', requireAuth(), async (req, res) => {
  const body = z
    .object({
      branchId: z.string(),
      type: z.enum(['DELIVERY', 'PICKUP', 'DINEIN']),
      paymentMode: z.enum(['ONLINE', 'COD']),
      cart: cartSchema,
      address: z
        .object({
          line1: z.string(), line2: z.string().optional(),
          pincode: z.string(), lat: z.number(), lng: z.number(),
        })
        .optional(),
      couponCode: z.string().optional(),
      loyaltyPointsToUse: z.number().int().nonnegative().optional(),
      notes: z.string().optional(),
      scheduledFor: z.string().datetime().optional(), // ISO timestamp
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body', detail: body.error.issues });
  const b = body.data;
  if (b.type === 'DELIVERY' && !b.address) return res.status(400).json({ error: 'address_required' });

  // Scheduled-for must be in the future and within open hours window
  if (b.scheduledFor) {
    const t = new Date(b.scheduledFor).getTime();
    if (Number.isNaN(t) || t < Date.now() + 15 * 60_000) {
      return res.status(400).json({ error: 'invalid_schedule', detail: 'schedule must be at least 15 min in the future' });
    }
  }

  const q = await buildQuote({
    branchId: b.branchId, type: b.type, cart: b.cart,
    destination: b.address && { lat: b.address.lat, lng: b.address.lng },
    couponCode: b.couponCode, loyaltyPointsToUse: b.loyaltyPointsToUse,
  });
  if (q.errors.length) return res.status(400).json({ error: 'quote_failed', detail: q.errors });

  // COD cap check for first-time customers
  if (b.paymentMode === 'COD') {
    const prior = await prisma.order.count({
      where: { userId: req.user!.id, status: 'DELIVERED' },
    });
    const cap = prior === 0 ? 2000 : 5000;
    if (q.total > cap) return res.status(400).json({ error: 'cod_cap_exceeded', cap });
  }

  // create order
  const orderNumber = newOrderNumber();
  const created = await prisma.order.create({
    data: {
      orderNumber,
      userId: req.user!.id,
      branchId: b.branchId,
      type: b.type,
      status: b.paymentMode === 'COD' ? 'PAID' : 'PENDING_PAYMENT',
      paymentMode: b.paymentMode,
      subtotal: q.subtotal,
      tax: q.tax,
      deliveryFee: q.deliveryFee,
      weatherFee: q.weatherFee,
      discount: q.discount,
      loyaltyUsed: q.loyaltyUsed,
      total: q.total,
      couponCode: q.couponCode,
      notes: b.notes,
      addressLine: b.address ? `${b.address.line1}${b.address.line2 ? ', ' + b.address.line2 : ''}` : null,
      pincode: b.address?.pincode,
      lat: b.address?.lat,
      lng: b.address?.lng,
      scheduledFor: b.scheduledFor ?? null,
      deliveryOtp: b.type === 'DELIVERY' ? randomOtp() : null,
      createdAt: now(),
      updatedAt: now(),
      items: {
        create: q.lines.map((l) => ({
          itemId: l.itemId, qty: l.qty, unitPrice: l.unitPrice,
          modifiers: JSON.stringify(l.modifiers), notes: l.notes,
          lineTotal: l.lineTotal,
        })),
      },
    },
    include: { items: true },
  });

  // deduct loyalty if used
  if (q.loyaltyUsed > 0) {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { loyaltyPoints: { decrement: q.loyaltyUsed } },
    });
    await prisma.loyaltyLedger.create({
      data: { userId: req.user!.id, delta: -q.loyaltyUsed, reason: 'REDEEMED', refOrderId: created.id, createdAt: now() },
    });
  }
  if (q.couponCode) {
    await prisma.coupon.update({ where: { code: q.couponCode }, data: { usedCount: { increment: 1 } } });
  }

  // online payment? create Razorpay order
  let razorpay: any = null;
  if (b.paymentMode === 'ONLINE') {
    razorpay = await payments.createOrder(q.total, orderNumber);
    await prisma.order.update({
      where: { id: created.id },
      data: { razorpayOrderId: razorpay.id },
    });
  } else {
    // COD: emit paid event so KDS picks it up
    bus.emit('admin:orders', { id: created.id, status: 'PAID' });
    await prisma.orderEvent.create({
      data: {
        orderId: created.id, fromStatus: null, toStatus: 'PAID',
        actor: 'SYSTEM', note: 'COD auto-paid', createdAt: now(),
      },
    });
  }

  res.json({ order: created, razorpay });
});

orderRouter.post('/:id/confirm-payment', requireAuth(), async (req, res) => {
  const { id } = req.params;
  const body = z.object({
    razorpayOrderId: z.string().optional(),
    razorpayPaymentId: z.string().optional(),
    razorpaySignature: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user!.id) return res.status(404).json({ error: 'not_found' });

  const ok = await payments.verifySignature(
    body.data.razorpayOrderId ?? order.razorpayOrderId ?? '',
    body.data.razorpayPaymentId ?? '',
    body.data.razorpaySignature ?? '',
  );
  if (!ok) return res.status(400).json({ error: 'bad_signature' });

  await prisma.order.update({
    where: { id },
    data: {
      razorpayPaymentId: body.data.razorpayPaymentId,
      razorpaySignature: body.data.razorpaySignature,
    },
  });
  const updated = await transition(id, 'PAID', `CUSTOMER:${req.user!.id}`, 'payment_confirmed');
  res.json({ order: updated });
});

orderRouter.get('/', requireAuth(), async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { item: true } } },
    take: 50,
  });
  res.json({ orders });
});

orderRouter.get('/:id', requireAuth(), async (req, res) => {
  const o = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { item: true } },
      events: { orderBy: { createdAt: 'asc' } },
      rider: { include: { user: true } },
    },
  });
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.userId !== req.user!.id && !['ADMIN', 'OWNER'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  res.json({ order: o });
});

orderRouter.post('/:id/cancel', requireAuth(), async (req, res) => {
  const o = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!o || o.userId !== req.user!.id) return res.status(404).json({ error: 'not_found' });
  if (!['PENDING_PAYMENT', 'PAID'].includes(o.status))
    return res.status(400).json({ error: 'too_late_to_cancel' });
  const updated = await transition(o.id, 'CANCELLED', `CUSTOMER:${req.user!.id}`, 'self_cancel');
  res.json({ order: updated });
});

// Tip the rider (any time before / after delivery)
orderRouter.post('/:id/tip', requireAuth(), async (req, res) => {
  const body = z.object({ amount: z.number().int().min(0).max(2000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const o = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!o || o.userId !== req.user!.id) return res.status(404).json({ error: 'not_found' });
  const updated = await prisma.order.update({
    where: { id: o.id },
    data: { riderTip: body.data.amount, updatedAt: now() },
  });
  res.json({ order: { id: updated.id, riderTip: updated.riderTip } });
});

orderRouter.post('/:id/reorder', requireAuth(), async (req, res) => {
  const old = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!old || old.userId !== req.user!.id) return res.status(404).json({ error: 'not_found' });
  const cart: CartLine[] = old.items.map((i) => ({
    itemId: i.itemId,
    qty: i.qty,
    modifierIds: (JSON.parse(i.modifiers) as Array<{ id: string }>).map((m) => m.id),
    notes: i.notes ?? undefined,
  }));
  res.json({ cart, branchId: old.branchId });
});
