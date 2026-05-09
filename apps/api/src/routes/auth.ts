import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { otp } from '../services/otp';
import { signToken, requireAuth } from '../auth';

export const authRouter = Router();

const phoneSchema = z.string().regex(/^\+?\d{10,13}$/);

authRouter.post('/otp/send', async (req, res) => {
  const phone = phoneSchema.safeParse(req.body?.phone);
  if (!phone.success) return res.status(400).json({ error: 'invalid_phone' });
  const r = await otp.send(phone.data);
  res.json({ ok: true, devOtp: r.devOtp });
});

authRouter.post('/otp/verify', async (req, res) => {
  const body = z
    .object({ phone: phoneSchema, otp: z.string().length(6), name: z.string().optional() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const { phone, otp: code, name } = body.data;
  if (!otp.verify(phone, code)) return res.status(401).json({ error: 'invalid_otp' });

  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone, name: name ?? null, role: 'CUSTOMER', createdAt: now() },
    });
  }
  const token = signToken({ id: user.id, role: user.role, phone: user.phone });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ token, user: { id: user.id, phone: user.phone, name: user.name, role: user.role } });
});

authRouter.get('/me', requireAuth(), async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true, phone: true, name: true, email: true, role: true, loyaltyPoints: true,
    },
  });
  res.json({ user: u });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});
