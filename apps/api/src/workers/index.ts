// Rule-based automations (doc §6.1).
// In a Redis+BullMQ setup these would be queued jobs with retries and a UI.
// For dev, simple setInterval is enough — clean enough to lift later.

import { prisma, now } from '../db';
import { config } from '../config';
import { transition } from '../services/orders';
import { tryAssignRider } from '../services/fleet';
import { notify } from '../services/notify';
import { payments } from '../services/payments';
import { bus } from '../realtime';

const MIN = 60_000;

function every(seconds: number, fn: () => Promise<void>, name: string) {
  const run = () => fn().catch((e) => console.error(`[worker:${name}]`, e));
  setInterval(run, seconds * 1000);
  setTimeout(run, 5_000); // initial delayed run
}

// 1) Stale unpaid orders → cancel after 15 min
async function staleOrders() {
  const cutoff = new Date(Date.now() - 15 * MIN).toISOString();
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
  });
  for (const o of stale) {
    await transition(o.id, 'CANCELLED', 'SYSTEM', 'stale_unpaid');
  }
}

// 2) No-show release for bookings (15 min after slotStart, no checkin)
async function noShowRelease() {
  const cutoff = new Date(Date.now() - config.booking.graceMinutes * MIN).toISOString();
  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED', 'PENDING'] },
      slotStart: { lt: cutoff },
      checkedInAt: null,
    },
    include: { user: true },
  });
  for (const b of candidates) {
    await prisma.booking.update({
      where: { id: b.id }, data: { status: 'NO_SHOW' },
    });
    await prisma.user.update({
      where: { id: b.userId },
      data: { noShowCount: { increment: 1 } },
    });
    if (b.user) {
      await notify.whatsapp(b.user.phone, 'BOOKING_NO_SHOW', { bookingNumber: b.bookingNumber });
    }
    // 3 no-shows in 90d → flag (simplified: just count)
    const u = await prisma.user.findUnique({ where: { id: b.userId } });
    if (u && u.noShowCount >= 3 && !u.flagged) {
      await prisma.user.update({ where: { id: u.id }, data: { flagged: true } });
    }
    bus.emit('admin:bookings', { id: b.id, status: 'NO_SHOW' });
  }
}

// 3) 2h reminders for upcoming bookings
async function bookingReminders() {
  const t1 = new Date(Date.now() + 2 * 60 * MIN);
  const t2 = new Date(Date.now() + 2.1 * 60 * MIN); // 6-min window
  const upcoming = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      slotStart: { gte: t1.toISOString(), lt: t2.toISOString() },
    },
    include: { user: true },
  });
  for (const b of upcoming) {
    const sent = await prisma.notificationLog.findFirst({
      where: { template: 'BOOKING_REMINDER', to: b.user.phone, payload: { contains: b.bookingNumber } },
    });
    if (sent) continue;
    await notify.whatsapp(b.user.phone, 'BOOKING_REMINDER', {
      bookingNumber: b.bookingNumber,
      qrUrl: `${config.frontendUrl}/bookings/${b.id}`,
    });
  }
}

// 4) Pre-order kick-off — 25 min before slotStart, push pre-order to KDS
async function preOrderKick() {
  const t1 = new Date(Date.now() + 24 * MIN);
  const t2 = new Date(Date.now() + 26 * MIN);
  const upcoming = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      preOrderId: { not: null },
      slotStart: { gte: t1.toISOString(), lt: t2.toISOString() },
    },
  });
  for (const b of upcoming) {
    if (!b.preOrderId) continue;
    const o = await prisma.order.findUnique({ where: { id: b.preOrderId } });
    if (!o || o.status !== 'PAID') continue;
    await transition(o.id, 'ACCEPTED', 'SYSTEM', 'preorder_kick');
    await transition(o.id, 'PREPARING', 'SYSTEM', 'preorder_kick');
  }
}

// 5) Review request — 24h after DELIVERED, no review yet
async function reviewRequests() {
  const t1 = new Date(Date.now() - 24.2 * 60 * MIN).toISOString();
  const t2 = new Date(Date.now() - 24 * 60 * MIN).toISOString();
  const orders = await prisma.order.findMany({
    where: { status: 'DELIVERED', deliveredAt: { gte: t1, lt: t2 } },
    include: { user: true, reviews: true },
  });
  for (const o of orders) {
    if (o.reviews.length) continue;
    await notify.whatsapp(o.user.phone, 'ORDER_DELIVERED', {
      orderNumber: o.orderNumber, reviewUrl: `${config.frontendUrl}/orders/${o.id}/review`,
    });
  }
}

// 6) Demand-based promo — if next-hour bookings < 30% capacity, push promo (simplified)
async function demandPromo() {
  const start = new Date();
  const end = new Date(Date.now() + 60 * MIN);
  const totalTables = await prisma.table.count({ where: { isActive: true } });
  if (totalTables === 0) return;
  const booked = await prisma.booking.count({
    where: {
      status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'SEATED'] },
      slotStart: { gte: start.toISOString(), lt: end.toISOString() },
    },
  });
  const ratio = booked / totalTables;
  if (ratio >= 0.3) return;

  // throttle: only emit once per hour
  const lastSent = await prisma.notificationLog.findFirst({
    where: { template: 'PROMO' },
    orderBy: { createdAt: 'desc' },
  });
  if (lastSent && Date.now() - new Date(lastSent.createdAt).getTime() < 60 * MIN) return;

  // Find or activate the OFFPEAK10 coupon
  const coupon = await prisma.coupon.findFirst({ where: { code: 'OFFPEAK10', isActive: true } });
  if (!coupon) return;
  // Notify last 50 active customers
  const recent = await prisma.user.findMany({
    where: { role: 'CUSTOMER', orders: { some: {} } },
    take: 50,
    orderBy: { id: 'desc' },
  });
  for (const u of recent) {
    await notify.whatsapp(u.phone, 'PROMO', {
      code: coupon.code,
      value: coupon.type === 'PERCENT' ? `${coupon.value}%` : `₹${coupon.value}`,
      validUntil: coupon.validUntil.slice(0, 10),
    });
  }
}

// 7) Auto-assign retry sweep — orders READY without a rider for >30s
async function assignSweep() {
  const cutoff = new Date(Date.now() - 30_000).toISOString();
  const ready = await prisma.order.findMany({
    where: {
      status: 'READY', type: 'DELIVERY', riderId: null,
      updatedAt: { lt: cutoff },
    },
  });
  for (const o of ready) tryAssignRider(o.id).catch(() => {});
}

export function startWorkers() {
  if (!config.enableAutomation) {
    console.log('[workers] disabled via ENABLE_AUTOMATION=false');
    return;
  }
  every(60, staleOrders, 'stale-orders');
  every(60, noShowRelease, 'no-show-release');
  every(120, bookingReminders, 'booking-reminders');
  every(120, preOrderKick, 'preorder-kick');
  every(300, reviewRequests, 'review-requests');
  every(300, demandPromo, 'demand-promo');
  every(30, assignSweep, 'assign-sweep');
  console.log('[workers] started');
}
