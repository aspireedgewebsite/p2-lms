import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, fail } from '../lib/http.js';
import { requireStudent } from '../middleware/auth.js';
import { enrollmentActive } from '../lib/enrollment.js';
import {
  createRazorpayOrder, fetchRazorpayPayment, paymentId, providerPayment, razorpayCheckoutKey, razorpayPrice, requireRazorpay, validRazorpaySignature,
} from '../lib/razorpay.js';

const router = Router();
router.use(requireStudent);

router.post('/orders', asyncRoute(async (req, res) => {
  const { courseId, expectedAmount } = z.object({
    courseId: z.string().uuid(), expectedAmount: z.number().int().positive().optional(),
  }).strict().parse(req.body);
  const { userId } = req.auth!;
  const { key } = requireRazorpay();
  const order = await prisma.$transaction(async tx => {
    const course = await tx.course.findFirst({
      where: { id: courseId, tenantId: null, status: 'PUBLISHED' },
      select: { title: true, pricePaise: true },
    });
    if (!course || course.pricePaise <= 0) fail(404, 'PAID_COURSE_NOT_FOUND', 'Paid course not found.');
    const checkoutKey = razorpayCheckoutKey(key, userId, courseId);
    const pending = await tx.courseOrder.upsert({
      where: { checkoutKey },
      create: { checkoutKey, userId, courseId, amountPaise: razorpayPrice(course.pricePaise).totalPaise, paymentMethod: 'RAZORPAY' },
      update: { checkoutKey },
    });
    if (enrollmentActive(await tx.directEnrollment.findUnique({ where: { userId_courseId: { userId, courseId } } }))) {
      fail(409, 'ALREADY_ENROLLED', 'You already have access to this course.');
    }
    if (expectedAmount !== undefined && expectedAmount !== pending.amountPaise) {
      fail(409, 'CHECKOUT_AMOUNT_CHANGED', 'The Razorpay total changed. Refresh this page to review the new amount.');
    }
    if (pending.razorpayOrderId) return { ...pending, title: course.title };
    const provider = await createRazorpayOrder(pending.id, pending.amountPaise);
    await tx.courseOrder.update({ where: { id: pending.id }, data: { razorpayOrderId: provider.id } });
    return { ...pending, razorpayOrderId: provider.id, title: course.title };
  }, { timeout: 15_000 });
  res.json({ data: { id: order.id, orderId: order.razorpayOrderId, key, amount: order.amountPaise, currency: 'INR', title: order.title } });
}));

async function settlePayment(payment: z.infer<typeof providerPayment>) {
  return prisma.$transaction(async tx => {
    const order = await tx.courseOrder.findUnique({ where: { razorpayOrderId: payment.order_id } });
    if (!order || order.paymentMethod !== 'RAZORPAY') return false;
    if (payment.status !== 'captured' || payment.currency !== 'INR' || payment.amount !== order.amountPaise) {
      fail(409, 'PAYMENT_NOT_CONFIRMED', 'Payment has not been confirmed for this order.');
    }
    if (order.status === 'PAID' && order.razorpayPaymentId === payment.id) return true;
    const claimed = await tx.courseOrder.updateMany({
      where: { id: order.id, status: 'PENDING' },
      data: { status: 'PAID', verifiedAt: new Date(), checkoutKey: null, razorpayPaymentId: payment.id, paymentReference: payment.id },
    });
    if (!claimed.count) {
      const current = await tx.courseOrder.findUniqueOrThrow({ where: { id: order.id } });
      if (current.status === 'PAID' && current.razorpayPaymentId === payment.id) return true;
      fail(409, 'PAYMENT_ALREADY_PROCESSED', 'This order was already processed.');
    }
    const { userId, courseId } = order;
    const relation = { userId_courseId: { userId, courseId } };
    if (!enrollmentActive(await tx.directEnrollment.findUnique({ where: relation }))) {
      await tx.directEnrollment.upsert({
        where: relation,
        create: { userId, courseId, source: 'ONLINE_PURCHASE', status: 'ACTIVE' },
        update: { source: 'ONLINE_PURCHASE', status: 'ACTIVE', expiresAt: null, revokedAt: null, grantedById: null, note: null },
      });
    }
    await tx.auditLog.create({ data: { actorId: userId, entityType: 'CourseOrder', entityId: order.id, action: 'ORDER_RAZORPAY_CAPTURED' } });
    return true;
  });
}

router.post('/verify', asyncRoute(async (req, res) => {
  const input = z.object({ id: z.string().uuid(), paymentId, signature: z.string().length(64) }).strict().parse(req.body);
  const order = await prisma.courseOrder.findFirst({ where: { id: input.id, userId: req.auth!.userId, paymentMethod: 'RAZORPAY' } });
  if (!order?.razorpayOrderId) fail(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (!validRazorpaySignature(`${order.razorpayOrderId}|${input.paymentId}`, input.signature, requireRazorpay().secret)) {
    fail(400, 'PAYMENT_SIGNATURE_INVALID', 'Payment verification failed.');
  }
  const payment = await fetchRazorpayPayment(input.paymentId);
  if (payment.order_id !== order.razorpayOrderId) fail(400, 'PAYMENT_ORDER_MISMATCH', 'Payment verification failed.');
  if (!(await settlePayment(payment))) fail(404, 'ORDER_NOT_FOUND', 'Order not found.');
  res.json({ data: { courseId: order.courseId } });
}));

export const razorpayWebhook = asyncRoute(async (req, res) => {
  const signature = req.header('x-razorpay-signature') || '';
  const { webhookSecret } = requireRazorpay();
  if (!Buffer.isBuffer(req.body) || !validRazorpaySignature(req.body, signature, webhookSecret)) {
    fail(401, 'WEBHOOK_SIGNATURE_INVALID', 'Invalid webhook signature.');
  }
  let payload: unknown;
  try { payload = JSON.parse(req.body.toString('utf8')); } catch { fail(400, 'WEBHOOK_INVALID', 'Invalid webhook data.'); }
  const event = z.object({ event: z.string() }).parse(payload);
  if (event.event === 'payment.captured') {
    const { payload: { payment: { entity } } } = z.object({
      payload: z.object({ payment: z.object({ entity: providerPayment }) }),
    }).parse(payload);
    await settlePayment(entity);
  }
  res.json({ received: true });
});

export default router;
