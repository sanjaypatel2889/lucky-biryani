import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { requireAuth } from '../auth';
import { acceptOffer, declineOffer } from '../services/fleet';
import { transition } from '../services/orders';
import { bus } from '../realtime';

export const riderRouter = Router();

async function meRider(userId: string) {
  return prisma.rider.findUnique({ where: { userId }, include: { user: true } });
}

riderRouter.get('/me', requireAuth(['RIDER', 'ADMIN', 'OWNER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });
  res.json({ rider: r });
});

// Earnings dashboard — today + last 7 days + last 30 days.
// Per-order payout = base rate (₹25) + per-km rate (₹6) + 100% of customer tip.
// Real ops should drive these via config; hard-coded constants are fine for the demo.
riderRouter.get('/earnings', requireAuth(['RIDER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });

  const BASE_PER_ORDER = 25;
  const PER_KM = 6;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const month = new Date(Date.now() - 30 * 24 * 60 * 60_000);

  const orders = await prisma.order.findMany({
    where: { riderId: r.id, status: 'DELIVERED', deliveredAt: { gte: month.toISOString() } },
    orderBy: { deliveredAt: 'desc' },
  });

  // Distance estimate from branch to delivery point — same haversine the
  // pricing engine uses. For real ops you'd store the rider's actual path
  // length per delivery; this is a reasonable demo proxy.
  const { config } = await import('../config');
  const { haversineKm } = await import('../util/geo');

  let allRows = orders.map((o) => {
    const km = o.lat != null && o.lng != null
      ? haversineKm({ lat: config.branch.lat, lng: config.branch.lng }, { lat: o.lat, lng: o.lng })
      : 0;
    const payout = BASE_PER_ORDER + PER_KM * km + (o.riderTip ?? 0);
    return { id: o.id, deliveredAt: o.deliveredAt, km, payout, tip: o.riderTip ?? 0 };
  });

  const sumPayout = (rows: typeof allRows, since: Date) =>
    rows
      .filter((x) => x.deliveredAt && new Date(x.deliveredAt) >= since)
      .reduce((s, x) => s + x.payout, 0);

  const sumKm = (rows: typeof allRows, since: Date) =>
    rows
      .filter((x) => x.deliveredAt && new Date(x.deliveredAt) >= since)
      .reduce((s, x) => s + x.km, 0);

  res.json({
    today:  { count: allRows.filter((x) => x.deliveredAt && new Date(x.deliveredAt) >= today).length, earnings: round(sumPayout(allRows, today)), km: round(sumKm(allRows, today)) },
    week:   { count: allRows.filter((x) => x.deliveredAt && new Date(x.deliveredAt) >= week).length,  earnings: round(sumPayout(allRows, week)),  km: round(sumKm(allRows, week))  },
    month:  { count: allRows.length, earnings: round(sumPayout(allRows, month)), km: round(sumKm(allRows, month)) },
    recent: allRows.slice(0, 20).map((x) => ({ ...x, km: round(x.km), payout: round(x.payout) })),
  });

  function round(n: number) { return Math.round(n * 10) / 10; }
});

riderRouter.post('/shifts/start', requireAuth(['RIDER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });
  const open = await prisma.riderShift.findFirst({
    where: { riderId: r.id, endedAt: null },
  });
  if (open) return res.json({ shift: open });
  const shift = await prisma.riderShift.create({
    data: { riderId: r.id, startedAt: now() },
  });
  await prisma.rider.update({ where: { id: r.id }, data: { status: 'AVAILABLE' } });
  bus.emit('admin:fleet', { riderId: r.id, status: 'AVAILABLE' });
  res.json({ shift });
});

riderRouter.post('/shifts/end', requireAuth(['RIDER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });
  const open = await prisma.riderShift.findFirst({
    where: { riderId: r.id, endedAt: null },
  });
  if (!open) return res.status(400).json({ error: 'no_open_shift' });
  const shift = await prisma.riderShift.update({
    where: { id: open.id },
    data: {
      endedAt: now(),
      cashHandedOver: req.body?.cashHandedOver ?? null,
    },
  });
  await prisma.rider.update({ where: { id: r.id }, data: { status: 'OFFLINE' } });
  bus.emit('admin:fleet', { riderId: r.id, status: 'OFFLINE' });
  res.json({ shift });
});

riderRouter.post('/ping', requireAuth(['RIDER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });
  const body = z.object({ lat: z.number(), lng: z.number() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  await prisma.rider.update({
    where: { id: r.id },
    data: { lastLat: body.data.lat, lastLng: body.data.lng, lastPingAt: now() },
  });
  await prisma.riderPing.create({
    data: { riderId: r.id, lat: body.data.lat, lng: body.data.lng, recordedAt: now() },
  });
  // forward to any customer watching this rider's current order
  const active = await prisma.order.findFirst({
    where: { riderId: r.id, status: 'OUT_FOR_DELIVERY' },
  });
  if (active) {
    bus.emit(`order:${active.id}`, { type: 'rider_geo', lat: body.data.lat, lng: body.data.lng });
  }
  bus.emit('admin:fleet', { riderId: r.id, lat: body.data.lat, lng: body.data.lng });
  res.json({ ok: true });
});

riderRouter.get('/orders/active', requireAuth(['RIDER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });
  const active = await prisma.order.findMany({
    where: { riderId: r.id, status: { in: ['READY', 'OUT_FOR_DELIVERY'] } },
    include: { user: true, items: { include: { item: true } } },
  });
  res.json({ orders: active });
});

riderRouter.post('/orders/:id/accept', requireAuth(['RIDER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });
  await acceptOffer(req.params.id, r.id);
  res.json({ ok: true });
});

riderRouter.post('/orders/:id/decline', requireAuth(['RIDER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });
  await declineOffer(req.params.id, r.id);
  res.json({ ok: true });
});

riderRouter.post('/orders/:id/picked-up', requireAuth(['RIDER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });
  const o = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!o || o.riderId !== r.id) return res.status(403).json({ error: 'not_yours' });
  const upd = await transition(o.id, 'OUT_FOR_DELIVERY', `RIDER:${r.id}`);
  res.json({ order: upd });
});

riderRouter.post('/orders/:id/delivered', requireAuth(['RIDER']), async (req, res) => {
  const r = await meRider(req.user!.id);
  if (!r) return res.status(404).json({ error: 'not_a_rider' });
  const o = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!o || o.riderId !== r.id) return res.status(403).json({ error: 'not_yours' });
  // Optional delivery-OTP verification for safer COD / verified delivery.
  // If the order has a deliveryOtp and the rider supplied one, it must match.
  const supplied = (req.body?.otp ?? '').toString().trim();
  if (supplied && o.deliveryOtp && supplied !== o.deliveryOtp) {
    return res.status(400).json({ error: 'bad_otp' });
  }
  // Optional photo proof
  const proof = (req.body?.proofUrl ?? '').toString().trim();
  if (proof) {
    await prisma.order.update({ where: { id: o.id }, data: { deliveryProofUrl: proof } });
  }
  const upd = await transition(o.id, 'DELIVERED', `RIDER:${r.id}`);
  // free rider, count cash
  const cash = o.paymentMode === 'COD' ? o.total : 0;
  if (cash > 0) {
    const sh = await prisma.riderShift.findFirst({
      where: { riderId: r.id, endedAt: null },
    });
    if (sh) {
      await prisma.riderShift.update({
        where: { id: sh.id },
        data: {
          ordersCompleted: { increment: 1 },
          cashCollected: { increment: cash },
        },
      });
    }
  }
  await prisma.rider.update({ where: { id: r.id }, data: { status: 'AVAILABLE' } });
  bus.emit('admin:fleet', { riderId: r.id, status: 'AVAILABLE' });
  res.json({ order: upd });
});

// admin onboard
riderRouter.post('/onboard', requireAuth(['ADMIN', 'OWNER']), async (req, res) => {
  const body = z
    .object({
      phone: z.string(), name: z.string(),
      vehicleType: z.string().optional(), vehicleNumber: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  let user = await prisma.user.findUnique({ where: { phone: body.data.phone } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone: body.data.phone, name: body.data.name, role: 'RIDER', createdAt: now() },
    });
  } else if (user.role !== 'RIDER') {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: 'RIDER' } });
  }
  const rider = await prisma.rider.upsert({
    where: { userId: user.id },
    update: {
      vehicleType: body.data.vehicleType ?? 'BIKE',
      vehicleNumber: body.data.vehicleNumber,
    },
    create: {
      userId: user.id,
      vehicleType: body.data.vehicleType ?? 'BIKE',
      vehicleNumber: body.data.vehicleNumber,
    },
  });
  res.json({ rider });
});
