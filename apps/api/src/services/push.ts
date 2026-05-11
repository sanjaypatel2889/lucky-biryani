// Web Push — uses VAPID. Gracefully no-ops when keys aren't configured so the
// rest of the system keeps working in dev.

import webpush from 'web-push';
import { config } from '../config';
import { prisma, now } from '../db';

let ready = false;

export function initPush() {
  if (!config.push.enabled) {
    console.log('[push] disabled (no VAPID keys)');
    return;
  }
  webpush.setVapidDetails(
    config.push.contact,
    config.push.vapidPublic,
    config.push.vapidPrivate,
  );
  ready = true;
  console.log('[push] initialised');
}

export const push = {
  enabled: () => ready,

  async sendToUser(userId: string, payload: { title: string; body: string; url?: string }) {
    if (!ready) return;
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
          await prisma.notificationLog.create({
            data: {
              channel: 'PUSH', to: userId, template: 'GENERIC',
              payload: JSON.stringify(payload),
              status: 'SENT', createdAt: now(),
            },
          });
        } catch (e: any) {
          // 410 / 404 means the subscription is dead — drop it.
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          }
          await prisma.notificationLog.create({
            data: {
              channel: 'PUSH', to: userId, template: 'GENERIC',
              payload: JSON.stringify(payload),
              status: 'FAILED', error: e?.message ?? String(e),
              createdAt: now(),
            },
          });
        }
      }),
    );
  },
};
