import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { fail } from './http.js';

export function razorpayConfig() {
  const { RAZORPAY_KEY_ID: key, RAZORPAY_KEY_SECRET: secret, RAZORPAY_WEBHOOK_SECRET: webhookSecret } = process.env;
  return key && secret && webhookSecret ? { key, secret, webhookSecret } : null;
}

export function razorpayPrice(pricePaise: number) {
  const surchargePaise = Math.round(pricePaise * 31 / 1000);
  return { surchargePaise, totalPaise: pricePaise + surchargePaise };
}

export function razorpayCheckoutKey(key: string, userId: string, courseId: string) {
  return `${key.startsWith('rzp_live_') ? 'live' : 'test'}:${userId}:${courseId}`;
}

export function requireRazorpay() {
  return razorpayConfig() ?? fail(503, 'PAYMENTS_UNAVAILABLE', 'Online checkout is temporarily unavailable.');
}

export function validRazorpaySignature(data: Buffer | string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(data).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

async function razorpayRequest(path: string, init?: RequestInit) {
  const { key, secret } = requireRazorpay();
  try {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init, signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' },
    });
    if (response.ok) return await response.json() as unknown;
  } catch {
    // Provider errors can include sensitive data.
  }
  fail(502, 'PAYMENT_PROVIDER_ERROR', 'Razorpay could not complete the request. Please try again.');
}

export const paymentId = z.string().regex(/^pay_[A-Za-z0-9]+$/);
const orderId = z.string().regex(/^order_[A-Za-z0-9]+$/);
const providerOrder = z.object({ id: orderId, amount: z.number().int(), currency: z.literal('INR') });
export const providerPayment = z.object({
  id: paymentId, order_id: orderId, amount: z.number().int(), currency: z.string(), status: z.string(),
});

export async function createRazorpayOrder(receipt: string, amount: number) {
  const order = providerOrder.safeParse(await razorpayRequest('/orders', {
    method: 'POST', body: JSON.stringify({ amount, currency: 'INR', receipt }),
  }));
  if (!order.success || order.data.amount !== amount) fail(502, 'INVALID_PROVIDER_ORDER', 'Razorpay returned an invalid order.');
  return order.data;
}

export async function fetchRazorpayPayment(id: string) {
  const payment = providerPayment.safeParse(await razorpayRequest(`/payments/${id}`));
  if (!payment.success || payment.data.id !== id) fail(502, 'INVALID_PROVIDER_PAYMENT', 'Razorpay returned an invalid payment.');
  return payment.data;
}
