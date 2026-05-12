// Razorpay adapter. With no keys: stub that auto-accepts everything (dev).
// With keys: real Razorpay Orders API + HMAC-SHA256 signature verification
// for the checkout callback and webhook.

import crypto from 'crypto';
import { config } from '../config';
import { randomToken } from '../util/ids';

export const payments = {
  async createOrder(amountInr: number, receipt: string) {
    if (config.razorpay.enabled) {
      const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
      const r = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amountInr * 100),
          currency: 'INR',
          receipt,
          notes: { orderNumber: receipt },
        }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok || !j?.id) throw new Error(`razorpay_create_failed:${JSON.stringify(j).slice(0, 200)}`);
      return { id: j.id, amount: j.amount, currency: j.currency, receipt: j.receipt, keyId: config.razorpay.keyId };
    }
    return {
      id: 'order_dev_' + randomToken(16),
      amount: Math.round(amountInr * 100),
      currency: 'INR',
      receipt,
      keyId: 'rzp_test_dev',
    };
  },

  async verifySignature(orderId: string, paymentId: string, signature: string) {
    if (!config.razorpay.enabled) return true; // dev: accept anything
    if (!orderId || !paymentId || !signature) return false;
    const expected = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    // Constant-time compare to avoid timing attacks
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  },

  // Used by the webhook handler. Razorpay signs each webhook body with the
  // configured webhook secret (separate from the API key secret).
  verifyWebhookSignature(rawBody: string, signature: string) {
    if (!config.razorpay.webhookSecret) return true; // dev: accept
    const expected = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature ?? '', 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  },

  async refund(paymentId: string, amountInr: number) {
    if (!config.razorpay.enabled) return { id: 'rfnd_dev_' + randomToken(12), status: 'processed' };
    const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
    const r = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(amountInr * 100) }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.id) return { id: 'rfnd_failed', status: 'failed', error: j };
    return { id: j.id, status: j.status };
  },
};
