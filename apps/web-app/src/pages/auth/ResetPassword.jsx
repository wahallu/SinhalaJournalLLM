import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import ActionButton from '../../components/ui/ActionButton';
import AuthLayout from './AuthLayout';
import { ERROR, INPUT, LABEL } from './formStyles';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // The single-use token from the emailed link. Supabase used to put a
  // recovery session in the URL fragment and consume it automatically; the
  // token is now an explicit query parameter this page spends.
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(token, password);
      // Not signed in by this — the new password has to be used once.
      navigate('/login', {
        replace: true,
        state: { backgroundLocation: location.state?.backgroundLocation },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="Reset link required"
        footer={
          <Link
            to="/forgot-password"
            state={{ backgroundLocation: location.state?.backgroundLocation }}
            className="text-brand-600 font-semibold"
          >
            Request a reset link
          </Link>
        }
      >
        <p className="text-[13px] text-ink-600">
          Open this page from the link in your reset email.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className={LABEL}>
            New password
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
        </div>

        <div>
          <label htmlFor="confirm" className={LABEL}>
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={INPUT}
          />
        </div>

        {error && (
          <p role="alert" className={ERROR}>
            {error}
          </p>
        )}

        <ActionButton type="submit" variant="primary" size="lg" loading={busy} className="w-full">
          {busy ? 'Saving…' : 'Update password'}
        </ActionButton>
      </form>
    </AuthLayout>
  );
}
