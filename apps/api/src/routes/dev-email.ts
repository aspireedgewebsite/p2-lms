import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncRoute, fail } from '../lib/http.js';
import { resendConfig, sendResendEmail } from '../lib/resend.js';

const router = Router();
const loopback = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);
const localHost = new Set(['localhost', '127.0.0.1', '[::1]']);

router.post('/email-test', (req, res, next) => {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_DEV_EMAIL_TEST !== 'true'
    || !loopback.has(req.socket.remoteAddress ?? '') || !localHost.has(req.hostname)
    || req.headers.origin || req.headers['x-forwarded-for'] || req.headers.forwarded) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
    return;
  }
  next();
}, rateLimit({
  windowMs: 60_000, limit: 3, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: { code: 'EMAIL_TEST_RATE_LIMIT', message: 'Try again in a minute.' } },
}), asyncRoute(async (_req, res) => {
  const config = resendConfig();
  const recipient = z.string().email().safeParse(process.env.RESEND_TEST_RECIPIENT?.trim());
  if (!config) fail(503, 'RESEND_NOT_CONFIGURED', 'Set RESEND_API_KEY on the local API.');
  if (!recipient.success) fail(503, 'TEST_RECIPIENT_NOT_CONFIGURED', 'Set RESEND_TEST_RECIPIENT on the local API.');
  const result = await sendResendEmail(config, {
    to: recipient.data,
    subject: 'Aspireedge local email test',
    text: 'This message verifies that your local Aspireedge API can send email through Resend.',
    html: '<p>This message verifies that your local <strong>Aspireedge</strong> API can send email through Resend.</p>',
  });
  if (!result.ok) {
    res.status(502).json({ error: { code: result.code, message: 'Resend did not accept the test email.', providerStatus: result.providerStatus } });
    return;
  }
  res.json({ data: { status: 'accepted', id: result.id } });
}));

export default router;
