import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { fail } from './http.js';
import { resendConfig, sendResendEmail } from './resend.js';

export const otpCooldownSeconds = 60;
export const otpAttempts = 5;
const otpLifetimeMs = 5 * 60 * 1000;

export function otpSecret() {
  const secret = process.env.EMAIL_OTP_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    fail(503, 'OTP_NOT_CONFIGURED', 'Email verification is not configured. Please contact support.');
  }
  return secret;
}

function isLocalAddress(value: string | undefined, protocols: string[]) {
  try {
    const url = new URL(value ?? '');
    return protocols.includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function otpConfig(email: string) {
  const local = process.env.NODE_ENV === 'development'
    && process.env.DEV_OTP_RECOVERY_EMAIL?.trim().toLowerCase() === email
    && isLocalAddress(process.env.DATABASE_URL, ['postgresql:', 'postgres:'])
    && isLocalAddress(process.env.WEB_ORIGIN || 'http://localhost:5173', ['http:', 'https:']);
  if (local) return { channel: 'local' as const, secret: otpSecret() };

  const config = resendConfig();
  if (!config) {
    fail(503, 'RESEND_NOT_CONFIGURED', process.env.NODE_ENV === 'development'
      ? 'Verification email cannot be sent because RESEND_API_KEY is missing on the local API.'
      : 'Verification email is unavailable. Please contact support.');
  }
  return { ...config, channel: 'resend' as const, secret: otpSecret() };
}

async function saveLocalOtp(email: string, code: string) {
  const folder = resolve('.local-mail');
  const tempFile = join(folder, `student-verification-${randomUUID()}.tmp`);
  try {
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await writeFile(tempFile, `To: ${email}\nVerification code: ${code}\nValid for five minutes.\n`, { flag: 'wx', mode: 0o600 });
    await rename(tempFile, join(folder, 'student-verification.txt'));
    return true;
  } catch {
    return false;
  } finally {
    await unlink(tempFile).catch(() => {});
  }
}

export function otpHash(email: string, otp: string, secret: string) {
  return createHmac('sha256', secret).update(email).update(':').update(otp).digest('hex');
}

export function createEmailOtp(email: string, secret: string, previousHash?: string | null) {
  let code: string;
  let hash: string;
  do {
    code = randomInt(1_000_000).toString().padStart(6, '0');
    hash = otpHash(email, code, secret);
  } while (hash === previousHash);
  const now = new Date();
  return { code, fields: {
    emailOtpHash: hash,
    emailOtpExpiresAt: new Date(now.getTime() + otpLifetimeMs),
    emailOtpAttempts: 0,
    emailOtpLastSentAt: now,
  }};
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function sendEmailOtp(email: string, name: string, code: string, config: ReturnType<typeof otpConfig>) {
  if (config.channel === 'local') return saveLocalOtp(email, code);
  const greeting = 'Welcome to Aspireedge! Thank you for registering with us. To complete your account registration, please verify your email address using the OTP below.';
  const security = 'Do not share this OTP with anyone. If you did not initiate this registration, please ignore this email.';
  const text = `Hello ${name},\n\n${greeting}\n\nYour Email Verification Code: ${code}\n\nThis OTP is valid for 5 minutes.\n\nFor your security: ${security}\n\nThank you for choosing Aspireedge.\n\nRegards,\nTeam Aspireedge\nnoreply@aspireedgegroup.com\nhttps://aspireedgegroup.com`;
  const html = `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0;background:#eef5ff;color:#10284d;font:16px Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border:1px solid #d5e5f7;border-radius:16px;overflow:hidden">
    <div style="background:#0752cc;color:#fff;padding:20px 24px;font-size:24px;font-weight:bold">Aspireedge</div>
    <div style="padding:24px;line-height:1.55"><p>Hello ${escapeHtml(name)},</p><p>${greeting}</p>
    <p><strong>Your Email Verification Code</strong></p><p style="background:#e7f4ff;color:#063da0;border-radius:10px;padding:14px;text-align:center;font:700 28px monospace;letter-spacing:4px">${code}</p>
    <p>This OTP is valid for <strong>5 minutes</strong>.</p><p><strong>For your security</strong><br>${security}</p><p>Thank you for choosing Aspireedge.</p>
    <p>Regards,<br>Team Aspireedge<br>noreply@aspireedgegroup.com<br><a href="https://aspireedgegroup.com">aspireedgegroup.com</a></p></div></div></div></body></html>`;
  const result = await sendResendEmail(config, {
    to: email, subject: 'Your Aspireedge Verification Code', text, html,
  });
  return result.ok;
}
