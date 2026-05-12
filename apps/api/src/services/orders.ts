// Order state machine + transitions. Centralised so workers and HTTP routes
// agree on what's allowed and emit the same events.

import { prisma, now } from '../db';
import { bus } from '../realtime';
import { notify } from './notify';
import { push } from './push';

export const ORDER_STATES = [
  'PENDING_PAYMENT', 'PAID', 'ACCEPTED', 'PREPARING', 'READY',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED',
] as const;

export type OrderState = typeof ORDER_STATES[number];

const ALLOWED: Record<OrderState, OrderState[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID:            ['ACCEPTED', 'CANCELLED', 'REFUNDED'],
  ACCEPTED:        ['PREPARING', 'CANCELLED', 'REFUNDED'],
  PREPARING:       ['READY', 'CANCELLED'],
  READY:           ['OUT_FOR_DELIVERY', 'DELIVERED'], // pickup goes straight to DELIVERED
  OUT_FOR_DELIVERY:['DELIVERED'],
  DELIVERED:       ['REFUNDED'],
  CANCELLED:       [],
  REFUNDED:        [],
};

export async function transition(
  orderId: string,
  to: OrderState,
  actor: string,
  note?: string,
) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o) throw new Error('order_not_found');
  if (!ALLOWED[o.status as OrderState]?.includes(to)) {
    throw new Error(`illegal_transition:${o.status}->${to}`);
  }
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: to,
      updatedAt: now(),
      ...(to === 'OUT_FOR_DELIVERY' ? { pickedUpAt: now() } : {}),
      ...(to === 'DELIVERED' ? { deliveredAt: now() } : {}),
    },
  });
  await prisma.orderEvent.create({
    data: {
      orderId, fromStatus: o.status, toStatus: to,
      actor, note: note ?? null, createdAt: now(),
    },
  });

  // Side-effects
  bus.emit(`order:${orderId}`, { status: to });
  bus.emit('admin:orders', { id: orderId, status: to });

  // Notifications
  const user = await prisma.user.findUnique({ where: { id: o.userId } });
  const trackUrl = `${process.env.FRONTEND_URL ?? ''}/orders/${o.id}`;
  if (user) {
    if (to === 'PAID') {
      await notify.whatsapp(user.phone, 'ORDER_PAID', {
        orderNumber: o.orderNumber, total: o.total.toFixed(2), trackUrl,
      });
      push.sendToUser(user.id, { title: 'Order confirmed', body: `${o.orderNumber} · ₹${o.total.toFixed(0)}`, url: trackUrl }).catch(() => {});
    } else if (to === 'ACCEPTED') {
      push.sendToUser(user.id, { title: 'Kitchen accepted your order', body: `${o.orderNumber} is on its way to the pan`, url: trackUrl }).catch(() => {});
    } else if (to === 'PREPARING') {
      push.sendToUser(user.id, { title: 'Cooking now', body: `${o.orderNumber} is in the dum`, url: trackUrl }).catch(() => {});
    } else if (to === 'READY') {
      push.sendToUser(user.id, { title: 'Ready', body: `${o.orderNumber} packed for delivery`, url: trackUrl }).catch(() => {});
    } else if (to === 'OUT_FOR_DELIVERY') {
      const r = o.riderId
        ? await prisma.rider.findUnique({ where: { id: o.riderId }, include: { user: true } })
        : null;
      await notify.whatsapp(user.phone, 'ORDER_OUT_FOR_DELIVERY', {
        orderNumber: o.orderNumber,
        riderName: r?.user.name ?? 'our rider',
        etaMin: 25,
      });
      push.sendToUser(user.id, { title: 'On the way', body: `${r?.user.name ?? 'Rider'} is heading to you · ~25 min`, url: trackUrl }).catch(() => {});
    } else if (to === 'DELIVERED') {
      await notify.whatsapp(user.phone, 'ORDER_DELIVERED', {
        orderNumber: o.orderNumber,
        reviewUrl: `${process.env.FRONTEND_URL ?? ''}/orders/${o.id}/review`,
      });
      push.sendToUser(user.id, { title: 'Delivered', body: 'Enjoy! Tap to leave a quick review.', url: `${trackUrl}/review` }).catch(() => {});
    } else if (to === 'CANCELLED') {
      push.sendToUser(user.id, { title: 'Order cancelled', body: `${o.orderNumber} was cancelled`, url: trackUrl }).catch(() => {});
    }
  }

  // Loyalty crediting on DELIVERED
  if (to === 'DELIVERED') {
    let points = Math.floor(updated.total / 10);
    // Lucky Club members earn 2× points
    const u = await prisma.user.findUnique({
      where: { id: updated.userId },
      select: { membershipTier: true, membershipUntil: true },
    });
    const memberActive = u?.membershipUntil ? new Date(u.membershipUntil).getTime() > Date.now() : false;
    if (memberActive && u?.membershipTier === 'CLUB') points *= 2;
    if (points > 0) {
      await prisma.user.update({
        where: { id: updated.userId },
        data: { loyaltyPoints: { increment: points } },
      });
      await prisma.loyaltyLedger.create({
        data: {
          userId: updated.userId, delta: points,
          reason: memberActive ? 'ORDER_DELIVERED_CLUB' : 'ORDER_DELIVERED',
          refOrderId: updated.id, createdAt: now(),
        },
      });
    }
  }

  // Inventory decrement on PAID
  if (to === 'PAID') {
    const items = await prisma.orderItem.findMany({ where: { orderId } });
    for (const oi of items) {
      const inv = await prisma.inventory.findUnique({
        where: { itemId_branchId: { itemId: oi.itemId, branchId: updated.branchId } },
      });
      if (inv) {
        await prisma.inventory.update({
          where: { itemId_branchId: { itemId: oi.itemId, branchId: updated.branchId } },
          data: { available: Math.max(0, inv.available - oi.qty), updatedAt: now() },
        });
        if (inv.available - oi.qty <= 0) {
          bus.emit('admin:orders', { type: 'oos', itemId: oi.itemId });
        }
      }
    }
  }

  return updated;
}
