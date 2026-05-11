import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { otp } from '../services/otp';
import { signToken, requireAuth } from '../auth';

export const authRouter = Router();

const emailSchema = z.string().trim().toLowerCase().email();

function makeReferralCode(seed: string) {
  // 8-char code: first 4 from a stable hash of seed, rest random — keeps the
  // shareable code short and reasonably unique.
  const base = seed.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4).padEnd(4, 'X');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LUCKY-${base}${rand}`.slice(0, 14);
}

authRouter.post('/otp/send', async (req, res) => {
  const email = emailSchema.safeParse(req.body?.email);
  if (!email.success) return res.status(400).json({ error: 'invalid_email' });
  await otp.send(email.data);
  res.json({ ok: true });
});

authRouter.post('/otp/verify', async (req, res) => {
  const body = z
    .object({
      email: emailSchema,
      otp: z.string().length(6),
      name: z.string().optional(),
      referralCode: z.string().trim().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const { email, otp: code, name, referralCode } = body.data;
  if (!otp.verify(email, code)) return res.status(401).json({ error: 'invalid_otp' });

  let user = await prisma.user.findUnique({ where: { email } });
  let isNew = false;
  if (!user) {
    // First-time login. Phone is required by the schema for legacy reasons,
    // so we synthesise a unique placeholder until the user supplies a real
    // phone number from their profile screen.
    const placeholderPhone = `email:${email}`;

    // Resolve referrer if a code was supplied
    let referredByUserId: string | null = null;
    if (referralCode) {
      const ref = await prisma.user.findUnique({ where: { referralCode: referralCode.toUpperCase() } });
      if (ref) referredByUserId = ref.id;
    }

    user = await prisma.user.create({
      data: {
        email,
        phone: placeholderPhone,
        name: name ?? null,
        role: 'CUSTOMER',
        referralCode: makeReferralCode(email),
        referredByUserId,
        createdAt: now(),
      },
    });
    isNew = true;

    // Award welcome points to both parties when a valid referrer was attached.
    // Loyalty config lives in config.referrals.
    if (referredByUserId) {
      const { config } = await import('../config');
      const pts = config.referrals.bothEarnPoints;
      await prisma.user.update({ where: { id: user.id }, data: { loyaltyPoints: { increment: pts } } });
      await prisma.user.update({ where: { id: referredByUserId }, data: { loyaltyPoints: { increment: pts } } });
      await prisma.loyaltyLedger.create({ data: { userId: user.id, delta: pts, reason: 'REFERRAL_SIGNUP', createdAt: now() } });
      await prisma.loyaltyLedger.create({ data: { userId: referredByUserId, delta: pts, reason: 'REFERRAL_FRIEND', createdAt: now() } });
    }
  }
  const token = signToken({ id: user.id, role: user.role, phone: user.phone });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({
    token,
    isNew,
    user: {
      id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role,
      loyaltyPoints: user.loyaltyPoints, referralCode: user.referralCode,
    },
  });
});

authRouter.get('/me', requireAuth(), async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true, phone: true, name: true, email: true, role: true,
      loyaltyPoints: true, referralCode: true, dob: true, membershipTier: true,
    },
  });
  res.json({ user: u });
});

authRouter.post('/me', requireAuth(), async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(80).optional(),
    phone: z.string().regex(/^\+\d{8,15}$/).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  try {
    const u = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: body.data.name ?? undefined,
        phone: body.data.phone ?? undefined,
        dob:   body.data.dob ?? undefined,
      },
      select: { id: true, name: true, phone: true, dob: true, email: true, role: true, referralCode: true, loyaltyPoints: true },
    });
    res.json({ user: u });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'phone_in_use' });
    throw e;
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});
