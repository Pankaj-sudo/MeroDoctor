import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAuthErrorMessage } from '../services/authService';
import { GoogleButton } from '../components/GoogleButton';

/**
 * Premium sign-in screen. Google is the primary (and currently only) method.
 * Once sign-in succeeds we show a brief success state; <PublicRoute> then
 * redirects to the user's role home as soon as the global auth state settles.
 */
export function Login() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
      // Stay busy — the success overlay shows while PublicRoute redirects.
      setSuccess(true);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      if (message) setError(message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth__aura" aria-hidden="true" />

      <section className="auth__card" aria-labelledby="auth-title">
        <div className="auth__brand">
          <span className="auth__wordmark">MERODOCTOR</span>
          <span className="auth__tag">Private Telemedicine</span>
        </div>

        <h1 id="auth-title" className="auth__title">
          Welcome back
        </h1>
        <p className="auth__subtitle">
          Sign in to reach your doctor — private, unhurried, and entirely yours.
        </p>

        <div className="auth__action">
          <GoogleButton onClick={handleGoogle} busy={busy} />
        </div>

        {error ? (
          <p className="auth__error" role="alert">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="auth__success" role="status">
            <span className="auth__check" aria-hidden="true">✓</span>
            Signed in — taking you in…
          </p>
        ) : null}

        <p className="auth__legal">
          By continuing you agree to MeroDoctor’s Terms and acknowledge the Privacy Policy.
        </p>
      </section>

      <p className="auth__footer">Encrypted · Confidential · By appointment</p>
    </main>
  );
}
