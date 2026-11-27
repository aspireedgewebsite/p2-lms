import { randomBytes } from 'node:crypto';
import { StudentGender } from '@prisma/client';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { fail } from './http.js';
import { studentPhone, studentPhoneKey } from './student-phone.js';
import { createEmailOtp, otpConfig, otpCooldownSeconds, sendEmailOtp } from './registration-otp.js';

export const studentDetails = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  phone: studentPhone,
  gender: z.nativeEnum(StudentGender),
}).strict();

export const registerSchema = studentDetails.extend({
  password: z.string().min(12).max(128),
  confirmPassword: z.string(),
}).refine(v => Boolean(studentPhoneKey(v.phone)), { message: 'Mobile number is required', path: ['phone'] }).refine(v => v.password === v.confirmPassword, { message: 'Passwords must match', path: ['confirmPassword'] });

export async function registerStudent({ name, email, phone, password, gender }: z.infer<typeof registerSchema>, actorId?: string) {
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    fail(409, 'EMAIL_TAKEN', 'This email already has an account. Please sign in.');
  }
  const phoneKey = studentPhoneKey(phone);
  const config = otpConfig(email);
  const passwordHash = await argon2.hash(password);
  const otp = createEmailOtp(email, config.secret);
  // Random student codes avoid exposing database sequence information. DB uniqueness enforces collision safety.
  const studentCode = 'STU' + randomBytes(6).toString('hex').toUpperCase();
  const student = await prisma.$transaction(async tx => {
    if (phoneKey && await tx.studentAccount.findFirst({ where: { phoneKey }, select: { id: true } })) {
      fail(409, 'PHONE_TAKEN', 'This mobile number already has an account. Please sign in.');
    }
    const user = await tx.user.create({ data: { email, name, passwordHash, ...otp.fields,
    directStudent: { create: { studentCode, phone: phone || null, phoneKey, gender } },
    }, select: { directStudent: { select: { id: true, studentCode: true } } } });
    const record = user.directStudent!;
    if (actorId) await tx.auditLog.create({ data: { actorId, action: 'STUDENT_CREATED', entityType: 'StudentAccount', entityId: record.id } });
    return record;
  }, { isolationLevel: 'Serializable' });
  const delivered = await sendEmailOtp(email, name, otp.code, config);
  return { ...student, delivered, resendAfterSeconds: otpCooldownSeconds, ...(config.channel === 'local' ? { delivery: 'local' as const } : {}) };
}
