// Notifications inbox — the customer-visible feed of order/booking events.
// Backed by NotificationLog (every outbound message gets a row). We surface
// the ones that are actionable from a user inbox (orders, bookings, promos,
// loyalty) and return them with a stable shape for the frontend.

import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../auth';

export const notificationsRouter = Router();

// User-facing inbox. Joins NotificationLog rows addressed to this user's
// email or phone, plus any push notifications keyed to their userId.
notificationsRouter.get('/', requireAuth(), async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { email: true, phone: true, id: true },
  });
  if (!u) return res.status(401).json({ error: 'user_missing' });

  const tos = [u.id, u.phone].concat(u.email ? [u.email] : []);
  const rows = await prisma.notificationLog.findMany({
    where: { to: { in: tos } },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  // Shape into an inbox-friendly payload (title, body, icon, link).
  const items = rows.map((r) => {
    const payload = safeJson<{ body?: string; vars?: any }>(r.payload, {});
    const vars = payload.vars ?? {};
    const orderUrl = vars.orderNumber || vars.trackUrl ? vars.trackUrl ?? null : null;
    const meta = templateMeta(r.template, vars);
    return {
      id: r.id,
      template: r.template,
      channel: r.channel,
      title: meta.title,
      body: payload.body ?? meta.fallbackBody ?? '',
      icon: meta.icon,
      tone: meta.tone,
      url: meta.url ?? orderUrl ?? '/orders',
      status: r.status,
      createdAt: r.createdAt,
    };
  });

  res.json({ items });
});

// Unread count — for the bell badge in the header. Anything in the last 24h
// counts as "unread" since we don't yet track per-row read state.
notificationsRouter.get('/unread', requireAuth(), async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { email: true, phone: true, id: true },
  });
  if (!u) return res.json({ count: 0 });
  const tos = [u.id, u.phone].concat(u.email ? [u.email] : []);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const count = await prisma.notificationLog.count({
    where: { to: { in: tos }, createdAt: { gte: dayAgo } },
  });
  res.json({ count });
});

function templateMeta(template: string, vars: any): {
  title: string;
  fallbackBody?: string;
  icon: string;
  tone: 'info' | 'success' | 'warning';
  url?: string;
} {
  switch (template) {
    case 'OTP':
      return { title: 'Login code sent', icon: '🔐', tone: 'info' };
    case 'ORDER_PAID':
      return { title: `Order ${vars.orderNumber ?? ''} confirmed`, icon: '✅', tone: 'success', url: vars.trackUrl };
    case 'ORDER_OUT_FOR_DELIVERY':
      return { title: `Out for delivery · ${vars.orderNumber ?? ''}`, icon: '🛵', tone: 'info', url: vars.trackUrl };
    case 'ORDER_DELIVERED':
      return { title: `Delivered · ${vars.orderNumber ?? ''}`, icon: '🎉', tone: 'success', url: vars.reviewUrl };
    case 'BOOKING_CONFIRMED':
      return { title: 'Table booked', icon: '🍽', tone: 'success', url: vars.qrUrl };
    case 'BOOKING_REMINDER':
      return { title: 'Your reservation is in 2h', icon: '⏰', tone: 'info', url: vars.qrUrl };
    case 'BOOKING_NO_SHOW':
      return { title: 'We missed you', icon: '😕', tone: 'warning' };
    case 'PROMO':
      return { title: `Offer · ${vars.code ?? 'use code'}`, icon: '🎁', tone: 'info' };
    case 'GENERIC':
      return { title: 'Update', icon: '🔔', tone: 'info' };
    default:
      return { title: template.replace(/_/g, ' '), icon: '🔔', tone: 'info' };
  }
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
