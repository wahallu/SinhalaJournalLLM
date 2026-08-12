import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import ActionButton from '../../components/ui/ActionButton';
import AuthLayout from './AuthLayout';
import { ERROR, INPUT, LABEL } from './formStyles';
import GoogleButton from './GoogleButton';
import { GOOGLE_CLIENT_ID } from '../../auth/googleIdentity';

export default function Signup() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Signup returns a session, so the new account is signed in already.
      // The verification link is informational — nothing is gated on it.
      await signUp(email, password);
      navigate('/verify-email', {
        replace: true,
        state: { backgroundLocation: location.state?.backgroundLocation },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setBusy(true);
    setError(null);
    try {
      // Google already vouches for the address, so there is no email to
      // verify — straight to the app rather than /verify-email.
      await signInWithGoogle(credential);
      navigate(location.state?.backgroundLocation?.pathname ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Save your work and pick up where you left off."
      footer={
        <>
          Already registered?{' '}
          <Link
            to="/login"
            state={{ backgroundLocation: location.state?.backgroundLocation }}
            className="text-brand-600 font-semibold"
          >
            Sign in
          </Link>
        </>
      }
    >
      {GOOGLE_CLIENT_ID && (
        <div className="space-y-4 mb-4">
          <GoogleButton onCredential={handleGoogleCredential} disabled={busy} />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-100" />
            <span className="text-[11.5px] font-semibold text-ink-400">OR</span>
            <div className="h-px flex-1 bg-ink-100" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={LABEL}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="password" className={LABEL}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
          <p className="text-[11.5px] text-ink-500 mt-1.5">At least 8 characters.</p>
        </div>

        {error && (
          <p role="alert" className={ERROR}>
            {error}
          </p>
        )}

        <ActionButton type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          {busy ? 'Creating…' : 'Create account'}
        </ActionButton>
      </form>
    </AuthLayout>
  );
}
