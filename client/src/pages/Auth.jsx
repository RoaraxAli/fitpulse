import React, { useEffect, useState } from 'react';
import { API_BASE } from '../api';
import { useAuth, useToast } from '../state';
import { navigate } from '../router';
import { Button, Field, Input } from '../components/ui';
import { Icon, Logo } from '../icons';
import { classNames } from '../utils';

const FEATURES = [
  { icon: 'dumbbell', title: 'Workout tracking', text: 'Build routines, log every set and watch your volume climb.' },
  { icon: 'apple', title: 'Nutrition insight', text: 'Track meals and macros against goals that adapt to you.' },
  { icon: 'chart', title: 'Progress that shows', text: 'Charts for weight, measurements, records and consistency.' },
];

export function AuthPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', identifier: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    // Google can bounce people back with ?error=… in the hash route.
    const query = (window.location.hash.split('?')[1] || '');
    if (!query) return;
    const message = new URLSearchParams(query).get('error');
    if (!message) return;
    setMode('login');
    setError(message);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/login`);
  }, []);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      if (mode === 'login') {
        await login(form.identifier.trim(), form.password);
      } else {
        await register({
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      }
      toast(mode === 'login' ? 'Welcome back!' : 'Account created — welcome to FitPulse!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      if (Array.isArray(err.details)) {
        const map = {};
        err.details.forEach((detail) => {
          map[detail.path] = detail.message;
        });
        setFieldErrors(map);
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setMode('login');
    setForm((current) => ({ ...current, identifier: 'alex', password: 'FitPulse123!' }));
  };

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="auth-hero-inner">
          <Logo size={44} />
          <div className="auth-hero-copy">
            <span className="eyebrow">Fitness, made measurable</span>
            <h1>
              Train with intent. <br />
              Track <em>everything</em> that matters.
            </h1>
            <p>
              FitPulse brings your workouts, nutrition, body metrics and community into one clean dashboard — so every
              session moves you forward.
            </p>
          </div>

          <div className="auth-showcase" aria-hidden="true">
            <div className="showcase-card">
              <div className="showcase-head">
                <span>Weekly volume</span>
                <span className="showcase-chip">+12.4%</span>
              </div>
              <svg viewBox="0 0 260 84" className="showcase-chart">
                <defs>
                  <linearGradient id="authFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9f75a" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#c9f75a" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 66 L36 56 L72 60 L108 42 L144 46 L180 28 L216 32 L252 12 L252 84 L0 84 Z" fill="url(#authFill)" />
                <path d="M0 66 L36 56 L72 60 L108 42 L144 46 L180 28 L216 32 L252 12" fill="none" stroke="#c9f75a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="showcase-stats">
                <div>
                  <strong>18,240</strong>
                  <span>kg lifted</span>
                </div>
                <div>
                  <strong>4</strong>
                  <span>sessions</span>
                </div>
                <div>
                  <strong>7</strong>
                  <span>day streak</span>
                </div>
              </div>
            </div>
            <div className="showcase-pill">
              <span className="pill-dot" /> 165 g protein · on target
            </div>
          </div>

          <ul className="auth-features">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <span className="auth-feature-icon">
                  <Icon name={feature.icon} size={18} />
                </span>
                <div>
                  <strong>{feature.title}</strong>
                  <span>{feature.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <Logo size={34} />
            <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p>{mode === 'login' ? 'Pick up where you left off.' : 'Start tracking in under a minute.'}</p>
          </div>

          <div className="segmented" role="tablist" aria-label="Authentication mode">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={classNames(mode === 'login' && 'is-active')} onClick={() => { setMode('login'); setError(null); setFieldErrors({}); }}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={classNames(mode === 'register' && 'is-active')} onClick={() => { setMode('register'); setError(null); setFieldErrors({}); }}>
              Create account
            </button>
          </div>

          <a
            className="btn btn-google btn-block"
            href={`${API_BASE}/auth/google/start?next=${encodeURIComponent('/dashboard')}`}
          >
            <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continue with Google
          </a>

          <div className="auth-divider"><span>or with email</span></div>

          {error && (
            <div className="form-alert" role="alert">
              <Icon name="info" size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {mode === 'register' ? (
              <>
                <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
                  <Input id="name" value={form.name} onChange={update('name')} placeholder="Alex Carter" autoComplete="name" required />
                </Field>
                <div className="form-grid two">
                  <Field label="Username" htmlFor="username" error={fieldErrors.username} hint="Letters, numbers, underscores">
                    <Input id="username" value={form.username} onChange={update('username')} placeholder="alex_c" autoComplete="username" required />
                  </Field>
                  <Field label="Email" htmlFor="email" error={fieldErrors.email}>
                    <Input id="email" type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" autoComplete="email" required />
                  </Field>
                </div>
              </>
            ) : (
              <Field label="Username or email" htmlFor="identifier" error={fieldErrors.identifier}>
                <Input id="identifier" value={form.identifier} onChange={update('identifier')} placeholder="alex" autoComplete="username" required />
              </Field>
            )}

            <Field label="Password" htmlFor="password" error={fieldErrors.password} hint={mode === 'register' ? 'At least 8 characters with a letter and a number.' : undefined}>
              <div className="input-with-action">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={update('password')}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button type="button" className="input-action" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" loading={loading} className="btn-block">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="auth-demo">
            <div>
              <strong>Just exploring?</strong>
              <span>Use the demo account with a full 10-week history.</span>
            </div>
            <Button variant="secondary" size="sm" onClick={fillDemo}>
              Fill demo
            </Button>
          </div>

          <p className="auth-fineprint">By continuing you agree to keep your data honest and your rest days earned.</p>
        </div>
      </section>
    </div>
  );
}
