import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AccountLink } from './Account';
import { Brand } from '../components/UI';
import { ApiError, api, messageFromError, type ApiOne } from '../lib/api';
import type { RegistrationResult } from '../context/AuthContext';

export function VerifyEmail() {
  const { hash } = useLocation();
  if (new URLSearchParams(hash.slice(1)).has('token')) return <AccountLink mode="verify"/>;
  return <OtpForm/>;
}

const deliveryFailure = 'The verification code could not be sent. Check your email address, then try after the countdown. If the problem continues, contact support.';

function deliveryNotice(channel?: RegistrationResult['delivery']) {
  return channel === 'local'
    ? 'A code was sent to the private development mailbox. Open the local student-verification.txt file.'
    : 'A 6-digit verification code was sent to your email address. Check Spam or Junk if it does not arrive.';
}

function OtpForm() {
  const { state } = useLocation();
  const initial = state as (Partial<RegistrationResult> & { email?: string }) | null;
  const [email, setEmail] = useState(initial?.email ?? '');
  const [otp, setOtp] = useState('');
  const [deadline, setDeadline] = useState(() => Date.now() + (initial?.resendAfterSeconds ?? 0) * 1000);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [notice, setNotice] = useState(initial?.delivered ? deliveryNotice(initial.delivery) : '');
  const [error, setError] = useState(initial?.delivered === false ? deliveryFailure : '');
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));

  useEffect(() => {
    if (!seconds) return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds, now]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resend = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'resend';
    if (busy || (resend && seconds)) return;
    if (resend && !event.currentTarget.querySelector<HTMLInputElement>('#verify-address')?.reportValidity()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (resend) {
        const { data } = await api<ApiOne<RegistrationResult>>('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) });
        setOtp('');
        setNow(Date.now());
        setDeadline(Date.now() + data.resendAfterSeconds * 1000);
        if (data.delivered) setNotice(deliveryNotice(data.delivery));
        else setError(deliveryFailure);
      } else {
        await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, otp }) });
        setVerified(true);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OTP_COOLDOWN') {
        setNow(Date.now());
        setDeadline(Date.now() + 60_000);
      }
      setError(messageFromError(err));
    } finally { setBusy(false); }
  }

  return <main className="academy-auth-alone">
    <section className="access-card" aria-labelledby="verify-title">
      <Link className="access-brand" to="/"><Brand/></Link>
      <header className="access-heading"><h1 id="verify-title">Verify Your Email</h1>
        {!verified && <p>{notice || 'Enter the six-digit code from your email, or request a new code.'}</p>}
      </header>
      {error && <p className="access-error" role="alert">{error}</p>}
      {verified ? <>
        <p role="status">Your email is verified. You can now sign in.</p>
        <Link className="primary-button inline-button" to="/login" state={{ email }}>Sign in</Link>
      </> : <form className="access-form" onSubmit={submit}>
        <div className="access-field"><label htmlFor="verify-address">Email address</label>
          <input id="verify-address" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required/>
        </div>
        <div className="access-field"><label htmlFor="verification-code">Verification code</label>
          <input id="verification-code" className="access-otp-input" type="text" inputMode="numeric"
            autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp}
            onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}/>
        </div>
        <button className="primary-button access-submit" disabled={busy}>Verify Email</button>
        <button className="academy-outline-button" type="submit" value="resend" formNoValidate disabled={busy || seconds > 0 || !email.trim()}>
          {seconds ? `Resend OTP in ${seconds}s` : 'Resend Verification OTP'}
        </button>
        <Link className="access-recovery" to="/login" state={{ email }}>Back to sign in</Link>
      </form>}
    </section>
  </main>;
}
