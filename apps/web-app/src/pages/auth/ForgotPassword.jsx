import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import ActionButton from '../../components/ui/ActionButton';
import AuthLayout from './AuthLayout';
import { INPUT, LABEL } from './formStyles';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await resetPassword(email);
    setBusy(false);
    // Always the same outcome, success or not. A different message for
    // unknown addresses would let anyone test which emails have accounts.
    setSent(true);
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={sent ? undefined : 'We will email you a reset link.'}
      footer={
        <Link to="/login" className="text-brand-600 font-semibold">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="text-[13px] text-ink-600">
          If an account exists for <span className="font-semibold text-ink-900">{email}</span>, a
          reset link is on its way. Check your inbox and spam folder.
        </p>
      ) : (
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

          <ActionButton type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            {busy ? 'Sending…' : 'Send reset link'}
          </ActionButton>
        </form>
      )}
    </AuthLayout>
  );
}
