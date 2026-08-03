import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import AuthLayout from './AuthLayout';

/**
 * Two jobs in one route.
 *
 * Straight after signup there is no token in the URL, so this is just the
 * "check your inbox" notice. Arriving from the emailed link there is a
 * `?token=`, which gets spent here.
 *
 * Nothing is gated on verification — signup already returns a session — so
 * a failed or ignored link costs the user nothing.
 */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { verifyEmail, refreshAccount } = useAuth();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'verifying' : 'sent');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    verifyEmail(token)
      .then(async () => {
        if (!active) return;
        await refreshAccount();
        setState('done');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setState('failed');
      });
    return () => {
      active = false;
    };
    // Runs once for the token in the URL; verifyEmail/refreshAccount are
    // stable context callbacks and re-running on their identity would spend
    // the token twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const title = {
    sent: 'Check your email',
    verifying: 'Confirming your email…',
    done: 'Email confirmed',
    failed: 'That link did not work',
  }[state];

  return (
    <AuthLayout
      title={title}
      footer={
        <Link to="/dashboard" className="text-brand-600 font-semibold">
          Go to your workspace
        </Link>
      }
    >
      {state === 'sent' && (
        <p className="text-[13px] text-ink-600">
          We sent you a confirmation link. Your account is already active — confirming
          simply verifies the address.
        </p>
      )}
      {state === 'verifying' && (
        <p className="text-[13px] text-ink-600">One moment…</p>
      )}
      {state === 'done' && (
        <p className="text-[13px] text-ink-600">
          Thanks — your email address is confirmed.
        </p>
      )}
      {state === 'failed' && (
        <p className="text-[13px] text-ink-600">
          {error || 'This link is invalid or has expired.'} Links are single-use and
          time-limited; you can request a new one from your profile.
        </p>
      )}
    </AuthLayout>
  );
}
