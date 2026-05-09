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
    let status = 'SENT';
    let error: string | undefined;

    if (config.fast2sms.enabled && template === 'OTP') {
      // Fast2SMS "OTP route" — works for Indian +91 numbers, no DLT required.
      // Their fixed template sends the otp value directly.
      try {
        const tenDigits = to.replace(/^\+?91/, '').replace(/\D/g, '');
        if (tenDigits.length !== 10) {
          throw new Error(`Fast2SMS needs 10-digit IN number, got "${to}"`);
        }
        const url = new URL('https://www.fast2sms.com/dev/bulkV2');
        url.searchParams.set('authorization', config.fast2sms.apiKey);
        url.searchParams.set('route', 'otp');
        url.searchParams.set('numbers', tenDigits);
        url.searchParams.set('variables_values', String(vars.otp ?? ''));

        const res = await fetch(url.toString(), { method: 'GET' });
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok || json?.return !== true) {
          throw new Error(`Fast2SMS rejected: ${JSON.stringify(json).slice(0, 200)}`);
        }
        console.log(`[SMS → ${to}] sent via Fast2SMS (request_id=${json.request_id})`);
      } catch (e: any) {
        status = 'FAILED';
        error = e?.message || 'fast2sms_failed';
        console.error('[Fast2SMS] failed:', error);
      }
    } else if (config.msg91.enabled) {
      // TODO: real MSG91 call
      console.log(`[SMS → ${to}] ${body}  (msg91 stub)`);
    } else {
      console.log(`[SMS → ${to}] ${body}`);
    }
    await record({ channel: 'SMS', to, template, payload: { body, vars }, status, error });
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
    let status = 'SENT';
    let error: string | undefined;

    if (config.email.enabled) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.email.resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: config.email.from,
            to: [to],
            subject,
            html: body,
          }),
        });
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok || !json?.id) {
          throw new Error(`Resend rejected: ${JSON.stringify(json).slice(0, 300)}`);
        }
        console.log(`[MAIL → ${to}] sent via Resend (id=${json.id})`);
      } catch (e: any) {
        status = 'FAILED';
        error = e?.message || 'resend_failed';
        console.error('[Resend] failed:', error);
      }
    } else {
      console.log(`[MAIL → ${to}] ${subject}\n${body}`);
    }
    await record({ channel: 'EMAIL', to, template: subject, payload: { body }, status, error });
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
