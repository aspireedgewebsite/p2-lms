import { z } from 'zod';

const sender = 'Aspireedge <noreply@aspireedgegroup.com>';
const responseSchema = z.object({ id: z.string().uuid() });

export function resendConfig() {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || sender;
  return key ? { key, from } : null;
}

export type ResendConfig = NonNullable<ReturnType<typeof resendConfig>>;

export async function sendResendEmail(
  config: ResendConfig,
  message: { to: string; subject: string; text: string; html: string },
) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...message, to: [message.to], from: config.from }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false as const, providerStatus: response.status, code: 'RESEND_REJECTED' };
    const result = responseSchema.safeParse(await response.json());
    if (!result.success) return { ok: false as const, code: 'RESEND_INVALID_RESPONSE' };
    return { ok: true as const, id: result.data.id };
  } catch {
    return { ok: false as const, code: 'RESEND_CONNECTION_FAILED' };
  }
}
