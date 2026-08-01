/**
 * Gate for the admin dashboard.
 *
 * Non-admins — signed out or not — are redirected to the app's normal
 * landing route rather than shown a "forbidden" page. Telling someone the
 * admin surface exists but is closed to them is information they do not
 * need; a 403 page advertises the attack surface.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function AdminRoute({ children }) {
  const { loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="w-6 h-6 rounded-full border-2 border-ink-200 border-t-brand-600 animate-spin"
          role="status"
          aria-label="Checking your session"
        />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
