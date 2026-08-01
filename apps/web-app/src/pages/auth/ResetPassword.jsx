import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import ActionButton from '../../components/ui/ActionButton';
import AuthLayout from './AuthLayout';
import { ERROR, INPUT, LABEL } from './formStyles';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
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
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    // Supabase puts the recovery session in the URL fragment and
    // detectSessionInUrl consumes it, so the visitor is already
    // authenticated by the time this renders.
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
