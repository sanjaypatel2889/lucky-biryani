import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma, now } from '../db';
import { requireAuth } from '../auth';
import { availabilityForDate, pickBestTable } from '../services/bookings';
import { newBookingNumber, randomToken } from '../util/ids';
import { config } from '../config';
import { notify } from '../services/notify';
import { bus } from '../realtime';

export const bookingRouter = Router();

bookingRouter.get('/availability', async (req, res) => {
  const branchId = req.query.branchId as string;
  const date = req.query.date as string; // YYYY-MM-DD
  const partySize = Number(req.query.partySize ?? 2);
  if (!branchId || !date) return res.status(400).json({ error: 'invalid_params' });
  const r = await availabilityForDate({ branchId, date, partySize });
  res.json(r);
});

bookingRouter.post('/', requireAuth(), async (req, res) => {
  const body = z
    .object({
      branchId: z.string(),
      partySize: z.number().int().min(1).max(20),
      slotStart: z.string(), // ISO
      occasion: z.string().optional(),
      specialRequest: z.string().optional(),
      requireDeposit: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const b = body.data;

  const slotStart = new Date(b.slotStart);
  if (Number.isNaN(slotStart.getTime())) return res.status(400).json({ error: 'invalid_slot' });
  const slotEnd = new Date(slotStart.getTime() + config.booking.holdMinutes * 60_000);

  const table = await pickBestTable({
    branchId: b.branchId,
    partySize: b.partySize,
    slotStart: slotStart.toISOString(),
    slotEnd: slotEnd.toISOString(),
  });
  if (!table) return res.status(409).json({ error: 'no_table_available' });

  // deposit required if user flagged or explicit
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  const depositRequired = b.requireDeposit || (user?.flagged ?? false);
  const deposit = depositRequired ? b.partySize * config.booking.depositPerSeat : 0;

  const booking = await prisma.booking.create({
    data: {
      bookingNumber: newBookingNumber(),
      userId: req.user!.id,
      branchId: b.branchId,
      tableId: table.id,
      partySize: b.partySize,
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
      status: depositRequired ? 'PENDING' : 'CONFIRMED',
      depositAmount: deposit,
      depositPaid: false,
      qrToken: randomToken(40),
      occasion: b.occasion,
      specialRequest: b.specialRequest,
      createdAt: now(),
    },
  });

  if (booking.status === 'CONFIRMED' && user) {
    const qr = await QRCode.toDataURL(`${config.frontendUrl}/checkin/${booking.qrToken}`);
    await notify.whatsapp(user.phone, 'BOOKING_CONFIRMED', {
      slotStart: slotStart.toLocaleString(),
      partySize: b.partySize,
      qrUrl: `${config.frontendUrl}/bookings/${booking.id}`,
    });
    bus.emit('admin:bookings', { id: booking.id, status: booking.status });
    return res.json({ booking, qr });
  }
  res.json({ booking });
});

bookingRouter.get('/', requireAuth(), async (req, res) => {
  const list = await prisma.booking.findMany({
    where: { userId: req.user!.id },
    orderBy: { slotStart: 'desc' },
    include: { table: true, branch: true },
  });
  res.json({ bookings: list });
});

bookingRouter.get('/:id', requireAuth(), async (req, res) => {
  const b = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { table: true, branch: true, preOrder: { include: { items: { include: { item: true } } } } },
  });
  if (!b) return res.status(404).json({ error: 'not_found' });
  if (b.userId !== req.user!.id && !['ADMIN', 'OWNER'].includes(req.user!.role))
    return res.status(403).json({ error: 'forbidden' });
  const qr = await QRCode.toDataURL(`${config.frontendUrl}/checkin/${b.qrToken}`);
  res.json({ booking: b, qr });
});

bookingRouter.post('/:id/cancel', requireAuth(), async (req, res) => {
  const b = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!b || b.userId !== req.user!.id) return res.status(404).json({ error: 'not_found' });
  if (!['PENDING', 'CONFIRMED'].includes(b.status))
    return res.status(400).json({ error: 'cannot_cancel' });
  const minsToSlot = (new Date(b.slotStart).getTime() - Date.now()) / 60_000;
  if (minsToSlot < 60) return res.status(400).json({ error: 'too_close_to_slot' });
  const upd = await prisma.booking.update({
    where: { id: b.id }, data: { status: 'CANCELLED' },
  });
  bus.emit('admin:bookings', { id: b.id, status: 'CANCELLED' });
  res.json({ booking: upd });
});

// host scans QR — token-based
bookingRouter.post('/checkin/:token', async (req, res) => {
  const b = await prisma.booking.findUnique({ where: { qrToken: req.params.token } });
  if (!b) return res.status(404).json({ error: 'not_found' });
  if (b.status !== 'CONFIRMED' && b.status !== 'CHECKED_IN')
    return res.status(400).json({ error: `bad_status:${b.status}` });
  const upd = await prisma.booking.update({
    where: { id: b.id },
    data: { status: 'SEATED', checkedInAt: now(), seatedAt: now() },
  });
  bus.emit('admin:bookings', { id: b.id, status: 'SEATED' });
  res.json({ booking: upd });
});
