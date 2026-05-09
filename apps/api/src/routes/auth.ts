import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { otp } from '../services/otp';
import { signToken, requireAuth } from '../auth';

export const authRouter = Router();

const emailSchema = z.string().trim().toLowerCase().email();

authRouter.post('/otp/send', async (req, res) => {
  const email = emailSchema.safeParse(req.body?.email);
  if (!email.success) return res.status(400).json({ error: 'invalid_email' });
  await otp.send(email.data);
  res.json({ ok: true });
});

authRouter.post('/otp/verify', async (req, res) => {
  const body = z
    .object({ email: emailSchema, otp: z.string().length(6), name: z.string().optional() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const { email, otp: code, name } = body.data;
  if (!otp.verify(email, code)) return res.status(401).json({ error: 'invalid_otp' });

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // First-time login. Phone is required by the schema for legacy reasons,
    // so we synthesise a unique placeholder until the user supplies a real
    // phone number from their profile screen.
    const placeholderPhone = `email:${email}`;
    user = await prisma.user.create({
      data: {
        email,
        phone: placeholderPhone,
        name: name ?? null,
        role: 'CUSTOMER',
        createdAt: now(),
      },
    });
  }
  const token = signToken({ id: user.id, role: user.role, phone: user.phone });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({
    token,
    user: { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role },
  });
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
