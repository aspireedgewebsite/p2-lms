import { z } from 'zod';

export const studentPhone = z.string().trim().max(25)
  .refine(value => !value || /^[+0-9() .-]+$/.test(value) && /[0-9]/.test(value), 'Enter a valid mobile number.')
  .optional();

export function studentPhoneKey(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/[^0-9]/g, '').replace(/^00(?=\d)/, '');
  return digits.replace(/^(?:91|0)(?=[6-9]\d{9}$)/, '') || null;
}
