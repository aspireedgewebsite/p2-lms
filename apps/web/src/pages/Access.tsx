import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react';
import { StudentGenderField } from '../components/StudentGenderField';
import { Brand } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { ApiError, messageFromError } from '../lib/api';
import learningPhoto from '../assets/academy-learning.jpg';
import './Access.css';

function PasswordField({ confirm = false, signup = false }: { confirm?: boolean; signup?: boolean }) {
  const [visible, setVisible] = useState(false);
  const label = confirm ? 'Confirm password' : 'Password';
  const id = confirm ? 'confirm-password' : 'password';

  return <div className="access-field">
    <label htmlFor={id}>{label}</label>
    <div className="access-password">
      <input id={id} name={id} type={visible ? 'text' : 'password'} required
        autoComplete={signup ? 'new-password' : 'current-password'}
        minLength={signup ? 12 : undefined} maxLength={signup ? 128 : undefined}
        aria-describedby={signup && !confirm ? 'password-hint' : undefined}/>
      <button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={19}/> : <Eye size={19}/>}
      </button>
    </div>
    {signup && !confirm && <small id="password-hint">Use at least 12 characters.</small>}
  </div>;
}

function AccessFrame({ children, signup }: { children: ReactNode; signup: boolean }) {
  return <main className={signup ? 'access-page access-page-signup' : 'access-page access-page-login'}>
    <aside className="access-visual">
      <img src={learningPhoto} alt=""/>
      <div className="access-visual-light" aria-hidden="true"/>
      <div className="access-visual-copy">
        <p>A unit of Aspireedge Pvt. Ltd.</p>
        <strong>Make time to learn something new.</strong>
      </div>
    </aside>
    <section className="access-content" aria-labelledby="access-title">
      <div className="access-ambient" aria-hidden="true"><span className="access-ribbons"/><span className="access-sparks"/></div>
      <div className="access-card">
        <Link className="access-brand" to="/"><Brand/></Link>
        {children}
      </div>
    </section>
  </main>;
}

function AccessPage({ signup = false }: { signup?: boolean }) {
  const { me, login, register } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState(() => typeof state?.email === 'string' ? state.email : '');
  const [phase, setPhase] = useState<'idle' | 'pending' | 'complete'>('idle');
  const [error, setError] = useState('');
  const destination = me?.scope === 'PLATFORM' ? '/admin' : '/student';
  const accepted = phase === 'complete' && Boolean(me);
  const pending = phase === 'pending';
  const sessionError = phase === 'complete' && !me ? 'Your session could not be started. Please sign in again.' : '';
  const feedback = pending ? (signup ? 'Creating account…' : 'Signing in…') : '';

  if (me && (phase === 'idle' || accepted)) return <Navigate to={destination} replace/>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || accepted) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    const confirmation = String(data.get('confirm-password') ?? '');
    setError('');
    setPhase('pending');

    try {
      if (signup) {
        if (password !== confirmation) throw new Error('Passwords must match.');
        const result = await register(String(data.get('name') ?? ''), email, String(data.get('phone') ?? ''), password, confirmation, String(data.get('gender') ?? ''));
        navigate('/verify-email', { replace: true, state: { email, ...result } });
        return;
      } else {
        await login(email, password);
      }
      setPhase('complete');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_UNVERIFIED') {
        setError('Your email is not verified yet. Choose Resend Verification OTP below to verify this account.');
        setPhase('idle');
        return;
      }
      setError(messageFromError(err));
      setPhase('idle');
    }
  }

  return <AccessFrame signup={signup}>
    <header className="access-heading">
      <h1 id="access-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
      <p>{signup ? 'Create a student account to enroll in courses and track your progress.' : 'Sign in to your student or administrator account.'}</p>
    </header>
    {(error || sessionError) && <p className="access-error" role="alert">
      {error || sessionError} {sessionError && signup && <Link to="/login">Go to sign in</Link>}
    </p>}
    <form className="access-form" onSubmit={submit}>
      {signup && <div className="access-field"><label htmlFor="name">Full name</label>
        <input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120}/>
      </div>}
      <div className="access-field"><label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)}/>
      </div>
      {signup && <div className="access-field"><label htmlFor="phone">Mobile number</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={25} required/>
      </div>}
      {signup && <div className="access-field"><StudentGenderField required/></div>}
      <PasswordField signup={signup}/>
      {signup ? <PasswordField signup confirm/> : <div className="access-recovery-links">
        <Link to="/forgot-password">Forgot password?</Link>
        <Link to="/verify-email" state={{ email: email.trim() }}>Resend Verification OTP</Link>
      </div>}
      <button className="primary-button access-submit" disabled={pending}>
        {pending ? <LoaderCircle className="access-spinner" size={19}/> : <KeyRound size={19}/>}
        {feedback || (signup ? 'Create student account' : 'Sign in')}
      </button>
      <span className="access-status" role="status">{feedback}</span>
    </form>
    <p className="access-switch">
      {signup ? 'Already have an account?' : 'New to Aspireedge?'}{' '}
      <Link to={signup ? '/login' : '/register'}>{signup ? 'Sign in' : 'Create a free account'}</Link>
    </p>
  </AccessFrame>;
}

export function Login() { return <AccessPage/>; }
export function Register() { return <AccessPage signup/>; }
