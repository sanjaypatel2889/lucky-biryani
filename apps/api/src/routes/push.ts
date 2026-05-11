// Web push — subscription registration. The browser hands us a PushSubscription
// JSON which we persist so workers/services can deliver notifications later.

import { Router } from 'express';
import { z } from 'zod';
import { prisma, now } from '../db';
import { requireAuth } from '../auth';
import { config } from '../config';

export const pushRouter = Router();

pushRouter.get('/public-key', (_req, res) => {
  res.json({
    enabled: config.push.enabled,
    publicKey: config.push.vapidPublic || null,
  });
});

pushRouter.post('/subscribe', requireAuth(), async (req, res) => {
  const body = z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
    ua: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });

  // upsert by endpoint
  await prisma.pushSubscription.upsert({
    where: { endpoint: body.data.endpoint },
    create: {
      userId: req.user!.id,
      endpoint: body.data.endpoint,
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
      ua: body.data.ua ?? null,
      createdAt: now(),
    },
    update: {
      userId: req.user!.id,
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
      ua: body.data.ua ?? null,
    },
  });
  res.json({ ok: true });
});

pushRouter.post('/unsubscribe', requireAuth(), async (req, res) => {
  const body = z.object({ endpoint: z.string().url() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  await prisma.pushSubscription
    .delete({ where: { endpoint: body.data.endpoint } })
    .catch(() => {});
  res.json({ ok: true });
});
