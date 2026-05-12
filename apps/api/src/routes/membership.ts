// Lucky Club — paid membership. Plans are seeded once (idempotent) and the
// /enroll endpoint flips the user's membershipTier/membershipUntil. In dev
// "billing" is a stub; with Razorpay keys the same flow can chain into a real
// subscription order via payments.createOrder.

import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { requireAuth } from '../auth';

export const membershipRouter = Router();

// Seed the canonical plans on first hit. Cheap, idempotent.
async function ensurePlans() {
  const existing = await prisma.membershipPlan.count();
  if (existing > 0) return;
  await prisma.membershipPlan.createMany({
    data: [
      {
        code: 'CLUB_MONTHLY',
        name: 'Lucky Club — Monthly',
        description: 'Free delivery, 5% off every order, 2× loyalty points.',
        pricePaisa: 19900,         // ₹199 / month
        durationDays: 30,
        perkFreeDelivery: true,
        perkDiscountPct: 0.05,
        perkPointsMultiplier: 2,
        createdAt: now(),
      },
      {
        code: 'CLUB_ANNUAL',
        name: 'Lucky Club — Annual',
        description: 'All monthly perks + 2 months free. ₹1,999 for the year.',
        pricePaisa: 199900,        // ₹1,999 / year
        durationDays: 365,
        perkFreeDelivery: true,
        perkDiscountPct: 0.05,
        perkPointsMultiplier: 2,
        createdAt: now(),
      },
    ],
  });
}

membershipRouter.get('/plans', async (_req, res) => {
  await ensurePlans();
  const plans = await prisma.membershipPlan.findMany({ where: { isActive: true }, orderBy: { pricePaisa: 'asc' } });
  res.json({ plans });
});

membershipRouter.get('/me', requireAuth(), async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { membershipTier: true, membershipUntil: true },
  });
  const active = isActive(u?.membershipUntil ?? null) && (u?.membershipTier ?? 'FREE') !== 'FREE';
  res.json({
    tier: u?.membershipTier ?? 'FREE',
    until: u?.membershipUntil ?? null,
    active,
  });
});

membershipRouter.post('/enroll', requireAuth(), async (req, res) => {
  const body = z.object({ planCode: z.enum(['CLUB_MONTHLY', 'CLUB_ANNUAL']) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  await ensurePlans();
  const plan = await prisma.membershipPlan.findUnique({ where: { code: body.data.planCode } });
  if (!plan || !plan.isActive) return res.status(404).json({ error: 'plan_not_found' });

  // Stub billing: in dev we just flip the user state. With Razorpay configured
  // the caller should first create a subscription order via /payments and
  // confirm before hitting this endpoint.
  const current = await prisma.user.findUnique({ where: { id: req.user!.id } });
  const fromTs = isActive(current?.membershipUntil ?? null)
    ? new Date(current!.membershipUntil!)
    : new Date();
  const until = new Date(fromTs.getTime() + plan.durationDays * 24 * 60 * 60_000);

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { membershipTier: 'CLUB', membershipUntil: until.toISOString() },
    select: { membershipTier: true, membershipUntil: true },
  });
  res.json({ ok: true, tier: updated.membershipTier, until: updated.membershipUntil, planName: plan.name });
});

membershipRouter.post('/cancel', requireAuth(), async (req, res) => {
  // Cancel = stops auto-renew. Perks remain until membershipUntil.
  // For demo we just clear the date so perks lapse immediately.
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { membershipTier: 'FREE', membershipUntil: null },
  });
  res.json({ ok: true });
});

export function isActive(membershipUntil: string | null): boolean {
  if (!membershipUntil) return false;
  return new Date(membershipUntil).getTime() > Date.now();
}
