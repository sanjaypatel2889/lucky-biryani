// Notifications adapter — SMS / WhatsApp / Email.
// In dev, prints to console + records in NotificationLog.
// In prod, swap each `send*` for the real provider call.

import { config } from '../config';
import { prisma, now } from '../db';

type Channel = 'SMS' | 'WHATSAPP' | 'EMAIL';

async function record(c: {
  channel: Channel;
  to: string;
  template: string;
  payload: any;
  status?: string;
  error?: string;
}) {
  await prisma.notificationLog.create({
    data: {
      channel: c.channel,
      to: c.to,
      template: c.template,
      payload: JSON.stringify(c.payload ?? {}),
      status: c.status ?? 'SENT',
      error: c.error,
      createdAt: now(),
    },
  });
}

export const notify = {
  async sms(to: string, template: string, vars: Record<string, any>) {
    const body = renderTemplate(template, vars);
    if (config.msg91.enabled) {
      // TODO: real MSG91 call
    } else {
      console.log(`[SMS → ${to}] ${body}`);
    }
    await record({ channel: 'SMS', to, template, payload: { body, vars } });
  },

  async whatsapp(to: string, template: string, vars: Record<string, any>) {
    const body = renderTemplate(template, vars);
    if (config.whatsapp.enabled) {
      // TODO: real WhatsApp Cloud call
    } else {
      console.log(`[WA  → ${to}] ${body}`);
    }
    await record({ channel: 'WHATSAPP', to, template, payload: { body, vars } });
  },

  async email(to: string, subject: string, body: string) {
    if (config.email.enabled) {
      // TODO: real Resend call
    } else {
      console.log(`[MAIL → ${to}] ${subject}\n${body}`);
    }
    await record({ channel: 'EMAIL', to, template: subject, payload: { body } });
  },
};

const TEMPLATES: Record<string, string> = {
  OTP: 'Your Lucky Biryani OTP is {{otp}}. Valid for 5 min.',
  ORDER_PAID: 'Order {{orderNumber}} confirmed! Total ₹{{total}}. Track: {{trackUrl}}',
  ORDER_OUT_FOR_DELIVERY:
    'Your order {{orderNumber}} is on the way 🛵. Rider: {{riderName}}, ETA {{etaMin}} min.',
  ORDER_DELIVERED:
    'Enjoy! Order {{orderNumber}} delivered. Rate it: {{reviewUrl}}',
  BOOKING_CONFIRMED:
    'Table booked at Lucky Biryani for {{slotStart}} (party {{partySize}}). QR: {{qrUrl}}',
  BOOKING_REMINDER:
    'Reminder: your reservation {{bookingNumber}} is in 2h. Show this QR at the host stand: {{qrUrl}}',
  BOOKING_NO_SHOW:
    'We missed you for booking {{bookingNumber}}. Deposit forfeited per policy.',
  PROMO:
    'Hungry? Use code {{code}} for {{value}} off — valid till {{validUntil}}.',
};

function renderTemplate(name: string, vars: Record<string, any>) {
  const tpl = TEMPLATES[name] ?? `${name} ${JSON.stringify(vars)}`;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}
