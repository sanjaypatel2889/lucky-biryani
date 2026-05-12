// Address book — CRUD on saved delivery addresses. The cart picks from
// this list at checkout (or lets the user add a new one inline).

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../auth';

export const addressRouter = Router();

const addressInput = z.object({
  label: z.string().min(1).max(30).default('Home'),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  pincode: z.string().regex(/^\d{6}$/),
  city: z.string().max(80).default('Hyderabad'),
  lat: z.number(),
  lng: z.number(),
  isDefault: z.boolean().optional(),
});

addressRouter.get('/', requireAuth(), async (req, res) => {
  const list = await prisma.address.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
  });
  res.json({ addresses: list });
});

addressRouter.post('/', requireAuth(), async (req, res) => {
  const body = addressInput.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body', detail: body.error.issues });
  // If marking default, clear the flag elsewhere first
  if (body.data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user!.id, isDefault: true },
      data: { isDefault: false },
    });
  }
  const a = await prisma.address.create({
    data: { ...body.data, userId: req.user!.id },
  });
  res.json({ address: a });
});

addressRouter.patch('/:id', requireAuth(), async (req, res) => {
  const body = addressInput.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });
  const owned = await prisma.address.findUnique({ where: { id: req.params.id } });
  if (!owned || owned.userId !== req.user!.id) return res.status(404).json({ error: 'not_found' });
  if (body.data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user!.id, isDefault: true, NOT: { id: req.params.id } },
      data: { isDefault: false },
    });
  }
  const a = await prisma.address.update({ where: { id: req.params.id }, data: body.data });
  res.json({ address: a });
});

addressRouter.delete('/:id', requireAuth(), async (req, res) => {
  const owned = await prisma.address.findUnique({ where: { id: req.params.id } });
  if (!owned || owned.userId !== req.user!.id) return res.status(404).json({ error: 'not_found' });
  await prisma.address.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
