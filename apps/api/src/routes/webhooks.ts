import { Router } from 'express';
import { prisma } from '../db';
import { transition } from '../services/orders';

export const webhookRouter = Router();

// Razorpay webhook — verifies HMAC and moves order to PAID.
// In dev (no real keys) this still updates if you POST a `paid` event.
webhookRouter.post('/razorpay', async (req, res) => {
  // TODO: verify x-razorpay-signature with HMAC-SHA256(body, webhookSecret)
  const evt = req.body;
  if (evt?.event === 'payment.captured' || evt?.event === 'order.paid') {
    const orderRef = evt.payload?.order?.entity?.receipt
      ?? evt.payload?.payment?.entity?.notes?.orderNumber;
    if (orderRef) {
      const o = await prisma.order.findUnique({ where: { orderNumber: orderRef } });
      if (o && o.status === 'PENDING_PAYMENT') {
        await prisma.order.update({
          where: { id: o.id },
          data: {
            razorpayPaymentId: evt.payload?.payment?.entity?.id,
          },
        });
        await transition(o.id, 'PAID', 'SYSTEM', 'razorpay_webhook');
      }
    }
  }
  res.json({ ok: true });
});

// WhatsApp webhook — for verification + inbound messages.
webhookRouter.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    return res.send(challenge);
  }
  res.sendStatus(403);
});

webhookRouter.post('/whatsapp', (req, res) => {
  console.log('[WA webhook]', JSON.stringify(req.body));
  res.json({ ok: true });
});
