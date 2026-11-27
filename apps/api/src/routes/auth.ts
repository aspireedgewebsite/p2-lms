import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncRoute, fail } from '../lib/http.js';
import { cookieConfig, cookieName, randomToken, SESSION_DURATION_MS, sha256 } from '../lib/security.js';
import { requireAuth } from '../middleware/auth.js';
import { registerSchema, registerStudent } from '../lib/student-registration.js';
import { createEmailOtp, otpAttempts, otpConfig, otpCooldownSeconds, otpHash, otpSecret, sendEmailOtp } from '../lib/registration-otp.js';

const router = Router();
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(1).max(128),
  tenantSlug: z.string().regex(/^[a-z0-9-]{2,50}$/).optional(),
});
const emailInput = loginSchema.shape.email;
async function issueSession(userId: string, tenantId: string | null, res: import('express').Response) {
  const raw = randomToken();
  const csrfToken = randomToken();
  await prisma.session.create({ data: {
    tokenHash: sha256(raw), csrfToken, userId, tenantId,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  } });
  res.cookie(cookieName, raw, cookieConfig());
  return csrfToken;
}

router.post('/register', asyncRoute(async (req, res) => {
  const { delivered, resendAfterSeconds, delivery } = await registerStudent(registerSchema.parse(req.body));
  res.status(201).json({ data: { delivered, resendAfterSeconds, ...(delivery ? { delivery } : {}) } });
}));

router.post('/verify-email', asyncRoute(async (req, res) => {
  const { email, otp } = z.object({ email: emailInput, otp: z.string().regex(/^[0-9]{6}$/) }).strict().parse(req.body);
  const now = new Date();
  const where = { email, emailVerifiedAt: null, directStudent: { status: 'ACTIVE' as const }, emailOtpExpiresAt: { gt: now }, emailOtpAttempts: { lt: otpAttempts } };
  const current = await prisma.user.findFirst({ where, select: { emailOtpHash: true, emailOtpLastSentAt: true } });
  const hash = otpHash(email, otp, otpSecret());
  const result = await prisma.user.updateMany({
    where: { ...where, emailOtpHash: hash },
    data: { emailVerifiedAt: now, emailOtpHash: null, emailOtpExpiresAt: null, emailOtpAttempts: 0, emailOtpLastSentAt: null },
  });
  if (!result.count) {
    if (current?.emailOtpHash && current.emailOtpHash !== hash) await prisma.user.updateMany({ where: { ...where, emailOtpHash: current?.emailOtpHash ?? null, emailOtpLastSentAt: current?.emailOtpLastSentAt ?? null }, data: { emailOtpAttempts: { increment: 1 } } });
    fail(400, 'OTP_INVALID', 'The code is incorrect, expired, or out of attempts. Request a new code if needed.');
  }
  res.json({ data: { verified: true } });
}));

router.post('/resend-otp', asyncRoute(async (req, res) => {
  const { email } = z.object({ email: emailInput }).strict().parse(req.body);
  const user = await prisma.user.findUnique({ where: { email }, select: {
    id: true, name: true, emailVerifiedAt: true, emailOtpHash: true, directStudent: { select: { status: true } },
  } });
  if (user?.directStudent?.status !== 'ACTIVE' || user.emailVerifiedAt) {
    fail(400, 'OTP_UNAVAILABLE', 'No pending student verification is available for this email.');
  }
  const config = otpConfig(email);
  const otp = createEmailOtp(email, config.secret, user.emailOtpHash);
  const cutoff = new Date(otp.fields.emailOtpLastSentAt.getTime() - otpCooldownSeconds * 1000);
  const result = await prisma.user.updateMany({
    where: { id: user.id, emailVerifiedAt: null, OR: [{ emailOtpLastSentAt: null }, { emailOtpLastSentAt: { lte: cutoff } }] },
    data: otp.fields,
  });
  if (!result.count) fail(429, 'OTP_COOLDOWN', 'Please wait before requesting another code.');
  const delivered = await sendEmailOtp(email, user.name, otp.code, config);
  res.json({ data: { delivered, resendAfterSeconds: otpCooldownSeconds, ...(config.channel === 'local' ? { delivery: 'local' } : {}) } });
}));

router.post('/login', asyncRoute(async (req, res) => {
  const { email, password, tenantSlug } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
    fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  if (tenantSlug) fail(403, 'COMPANY_LOGIN_DISABLED', 'Company login is no longer supported in the student academy.');
  const tenantId: null = null;
  if (user.platformRole !== 'SUPER_ADMIN') {
    const student = await prisma.studentAccount.findUnique({ where: { userId: user.id } });
    if (!student || student.status !== 'ACTIVE') fail(403, 'ACCOUNT_UNAVAILABLE', 'Student account is unavailable.');
    if (!user.emailVerifiedAt) fail(403, 'EMAIL_UNVERIFIED', 'Verify your email before signing in.');
  }
  // Invalidate the old session if a user signs in again in the same browser.
  const oldCookie = req.cookies?.[cookieName];
  if (typeof oldCookie === 'string') await prisma.session.deleteMany({ where: { tokenHash: sha256(oldCookie) } });
  const csrfToken = await issueSession(user.id, tenantId, res);
  res.json({ data: { user: { id: user.id, name: user.name, email: user.email },
    scope: tenantId ? 'TENANT' : user.platformRole === 'SUPER_ADMIN' ? 'PLATFORM' : 'STUDENT', csrfToken } });
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const auth = req.auth!;
  const [user, tenant] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { id: true, name: true, email: true, directStudent: { select: { studentCode: true, gender: true } } } }),
    auth.tenantId ? prisma.tenant.findUnique({ where: { id: auth.tenantId }, select: { id: true, name: true, slug: true } }) : Promise.resolve(null),
  ]);
  res.json({ data: { user, tenant, roles: auth.roles, scope: auth.tenantId ? 'TENANT' : auth.platformRole === 'SUPER_ADMIN' ? 'PLATFORM' : 'STUDENT', csrfToken: auth.csrfToken } });
}));

router.post('/logout', requireAuth, asyncRoute(async (req, res) => {
  const raw = req.cookies?.[cookieName];
  if (raw && typeof raw === 'string') {
    await prisma.session.deleteMany({ where: { tokenHash: sha256(raw) } });
  }
  res.clearCookie(cookieName, { path: '/', sameSite: 'lax', secure: cookieConfig().secure });
  res.json({ data: { success: true } });
}));

export default router;
