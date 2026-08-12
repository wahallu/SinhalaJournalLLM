import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Dialog from './ui/Dialog';

/**
 * A route rendered as a modal over whatever is behind it.
 *
 * Sign in, sign up, the password screens and the profile page keep their own
 * URLs — they are linked to from emails and from several places in the app,
 * and a modal that cannot be deep-linked would break both. So the route still
 * exists; it just renders in a dialog.
 *
 * Closing returns the user where they came from. `history.state.idx` is
 * React Router's own position counter: greater than zero means this entry was
 * pushed inside the app and going back lands somewhere we own. Zero means the
 * dialog was the first thing loaded — a link out of an email, a pasted URL —
 * where `navigate(-1)` would leave the site entirely, so it falls back to the
 * dashboard instead.
 */
export default function RouteDialog({ title, description, size, showHeader, inverseClose, children }) {
  const navigate = useNavigate();

  const close = useCallback(() => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next) close(); }}
      title={title}
      description={description}
      size={size}
      showHeader={showHeader}
      inverseClose={inverseClose}
    >
      {children}
    </Dialog>
  );
}
