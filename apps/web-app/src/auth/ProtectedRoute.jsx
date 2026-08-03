/**
 * Gate for routes that require a session.
 *
 * Renders a spinner while the session is still being restored — redirecting
 * during that window would bounce a signed-in user to /login on every hard
 * refresh.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 border-ink-200 border-t-brand-600 animate-spin"
          role="status"
          aria-label="Checking your session"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, backgroundLocation: location.state?.backgroundLocation }}
      />
    );
  }

  return children;
}
