// Auto-assignment algorithm (doc §5.3) — score riders by distance / rating /
// load and dispatch to top scorer with a 10s accept window.

import { prisma, now } from '../db';
import { config } from '../config';
import { haversineKm } from '../util/geo';
import { bus } from '../realtime';

type Pending = {
  orderId: string;
  attempts: { riderId: string; sentAt: number }[];
  timer?: NodeJS.Timeout;
};
const pending = new Map<string, Pending>();

export async function tryAssignRider(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  if (order.type !== 'DELIVERY' || order.status !== 'READY' || order.riderId) return;

  const branch = await prisma.branch.findUnique({ where: { id: order.branchId } });
  if (!branch) return;

  const tried = pending.get(orderId)?.attempts.map((a) => a.riderId) ?? [];

  const candidates = await prisma.rider.findMany({
    where: { status: 'AVAILABLE', id: { notIn: tried } },
    include: { user: true },
  });

  const scored = candidates
    .map((r) => {
      const dist = r.lastLat && r.lastLng
        ? haversineKm({ lat: r.lastLat, lng: r.lastLng }, { lat: branch.lat, lng: branch.lng })
        : Infinity;
      if (dist > config.rider.radiusKm) return null;
      // 60% distance (lower is better → invert) + 30% rating + 10% load balance
      const distScore = Math.max(0, 1 - dist / config.rider.radiusKm);
      const ratingScore = r.ratingAvg / 5;
      // load: fewer-shifts-today = higher score
      const loadScore = 0.5; // simplified
      const score = 0.6 * distScore + 0.3 * ratingScore + 0.1 * loadScore;
      return { rider: r, score, dist };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    const att = (pending.get(orderId)?.attempts.length ?? 0);
    if (att >= config.rider.maxAttempts) {
      bus.emit('admin:orders', { id: orderId, type: 'no_rider' });
      console.warn(`[fleet] no rider for order ${orderId} after ${att} attempts — pageing operator`);
      return;
    }
    // retry in 30s
    setTimeout(() => tryAssignRider(orderId), 30_000);
    return;
  }

  const top = scored[0].rider;
  let entry = pending.get(orderId);
  if (!entry) {
    entry = { orderId, attempts: [] };
    pending.set(orderId, entry);
  }
  entry.attempts.push({ riderId: top.id, sentAt: Date.now() });

  // reserve rider
  await prisma.rider.update({ where: { id: top.id }, data: { status: 'ON_DELIVERY' } });
  await prisma.order.update({ where: { id: orderId }, data: { riderId: top.id } });
  bus.emit(`rider:${top.id}`, { type: 'order_offered', orderId });
  bus.emit('admin:fleet', { riderId: top.id, orderId });
  bus.emit(`order:${orderId}`, { type: 'rider_offered', riderId: top.id });

  // timeout: if rider doesn't accept in N seconds, cycle
  entry.timer = setTimeout(() => {
    expire(orderId, top.id).catch((e) => console.error('expire err', e));
  }, config.rider.acceptWindowSec * 1000);
}

async function expire(orderId: string, riderId: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o || o.riderId !== riderId) return; // already accepted or reassigned
  // unassign and try next
  await prisma.order.update({ where: { id: orderId }, data: { riderId: null } });
  await prisma.rider.update({ where: { id: riderId }, data: { status: 'AVAILABLE' } });
  bus.emit(`rider:${riderId}`, { type: 'offer_expired', orderId });
  return tryAssignRider(orderId);
}

export async function acceptOffer(orderId: string, riderId: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o || o.riderId !== riderId) throw new Error('not_assigned');
  const entry = pending.get(orderId);
  if (entry?.timer) clearTimeout(entry.timer);
  pending.delete(orderId);
  await prisma.order.update({
    where: { id: orderId },
    data: { riderAssignAttempts: entry?.attempts.length ?? 1, updatedAt: now() },
  });
  bus.emit(`order:${orderId}`, { type: 'rider_accepted', riderId });
}

export async function declineOffer(orderId: string, riderId: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o || o.riderId !== riderId) return;
  const entry = pending.get(orderId);
  if (entry?.timer) clearTimeout(entry.timer);
  await prisma.order.update({ where: { id: orderId }, data: { riderId: null } });
  await prisma.rider.update({ where: { id: riderId }, data: { status: 'AVAILABLE' } });
  return tryAssignRider(orderId);
}
