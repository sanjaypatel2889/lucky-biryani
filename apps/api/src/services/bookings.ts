// Table availability algorithm (doc §4.1.1)

import { prisma } from '../db';
import { config } from '../config';

const MIN = 60_000;

export async function availabilityForDate(args: {
  branchId: string;
  date: string; // YYYY-MM-DD
  partySize: number;
  holdMinutes?: number;
}) {
  const hold = (args.holdMinutes ?? config.booking.holdMinutes) * MIN;

  const branch = await prisma.branch.findUnique({ where: { id: args.branchId } });
  if (!branch) return { slots: [] as { start: string; end: string; freeTables: number }[] };

  // tables of sufficient capacity
  const tables = await prisma.table.findMany({
    where: { branchId: args.branchId, isActive: true, capacity: { gte: args.partySize } },
  });
  if (!tables.length) return { slots: [] };

  // bookings on that date that aren't cancelled
  const dayStart = new Date(`${args.date}T00:00:00.000Z`).getTime();
  const dayEnd = dayStart + 24 * 60 * MIN;
  const bookings = await prisma.booking.findMany({
    where: {
      branchId: args.branchId,
      status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'SEATED'] },
      slotStart: { gte: new Date(dayStart).toISOString(), lt: new Date(dayEnd).toISOString() },
    },
  });

  // build 30-min slots within branch operating window
  const slots: { start: string; end: string; freeTables: number }[] = [];
  const slotMs = config.booking.slotMinutes * MIN;

  for (let t = dayStart + branch.openHour * 60 * MIN; t + hold <= dayStart + branch.closeHour * 60 * MIN; t += slotMs) {
    const slotStart = t;
    const slotEnd = t + hold;
    let free = 0;
    for (const tbl of tables) {
      const overlap = bookings.some((b) => {
        if (b.tableId !== tbl.id) return false;
        const bs = new Date(b.slotStart).getTime();
        const be = new Date(b.slotEnd).getTime();
        return bs < slotEnd && be > slotStart;
      });
      if (!overlap) free++;
    }
    if (free > 0) {
      slots.push({
        start: new Date(slotStart).toISOString(),
        end: new Date(slotEnd).toISOString(),
        freeTables: free,
      });
    }
  }

  return { slots };
}

export async function pickBestTable(args: {
  branchId: string;
  partySize: number;
  slotStart: string;
  slotEnd: string;
}) {
  const tables = await prisma.table.findMany({
    where: { branchId: args.branchId, isActive: true, capacity: { gte: args.partySize } },
    orderBy: { capacity: 'asc' }, // smallest fit wins (doc §4.1.1.6)
  });
  for (const t of tables) {
    const conflict = await prisma.booking.findFirst({
      where: {
        tableId: t.id,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'SEATED'] },
        AND: [
          { slotStart: { lt: args.slotEnd } },
          { slotEnd: { gt: args.slotStart } },
        ],
      },
    });
    if (!conflict) return t;
  }
  return null;
}
