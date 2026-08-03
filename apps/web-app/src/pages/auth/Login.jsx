import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import ActionButton from '../../components/ui/ActionButton';
import AuthLayout from './AuthLayout';
import { ERROR, INPUT, LABEL } from './formStyles';

export default function Login() {
  const { signIn } = useAuth();
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
      await signIn(email, password);
      navigate(location.state?.from ?? location.state?.backgroundLocation?.pathname ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Continue to your SinAi workspace."
      footer={
        <>
          No account?{' '}
          <Link
            to="/signup"
            state={{ backgroundLocation: location.state?.backgroundLocation }}
            className="text-brand-600 font-semibold"
          >
            Create one
          </Link>
        </>
      }
    >
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </div>

        {error && (
          <p role="alert" className={ERROR}>
            {error}
          </p>
        )}

        <ActionButton type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </ActionButton>

        <Link
          to="/forgot-password"
          state={{ backgroundLocation: location.state?.backgroundLocation }}
          className="block text-center text-[12.5px] text-ink-500 hover:text-brand-600"
        >
          Forgot your password?
        </Link>
      </form>
    </AuthLayout>
  );
}
