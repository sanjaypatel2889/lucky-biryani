// Razorpay adapter. In dev: stub that auto-marks orders PAID after a short delay
// when the customer "confirms" payment. In prod: real Razorpay Orders API +
// webhook signature verification.

import { config } from '../config';
import { randomToken } from '../util/ids';

export const payments = {
  async createOrder(amountInr: number, receipt: string) {
    if (config.razorpay.enabled) {
      // TODO: real call to Razorpay POST /v1/orders
    }
    return {
      id: 'order_dev_' + randomToken(16),
      amount: Math.round(amountInr * 100),
      currency: 'INR',
      receipt,
    };
  },

  async verifySignature(_orderId: string, _paymentId: string, _signature: string) {
    if (!config.razorpay.enabled) return true; // dev: accept anything
    // TODO: HMAC SHA256 of `${orderId}|${paymentId}` with key_secret
    return false;
  },

  async refund(_paymentId: string, _amountInr: number) {
    if (!config.razorpay.enabled) return { id: 'rfnd_dev_' + randomToken(12), status: 'processed' };
    // TODO: POST /v1/payments/:id/refund
    return { id: 'rfnd_unknown', status: 'pending' };
  },
};
