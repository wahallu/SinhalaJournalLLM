import { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID, loadGoogleIdentityScript } from '../../auth/googleIdentity';

/**
 * Renders Google's own "Sign in with Google" button via Google Identity
 * Services and forwards the resulting ID token to `onCredential`.
 *
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is unset, so an environment
 * without Google configured simply doesn't show the option.
 */
export default function GoogleButton({ onCredential, disabled = false }) {
  const containerRef = useRef(null);
  // Kept fresh every render (in an effect, not during render — see
  // https://react.dev/reference/react/useRef) so the callback below never
  // goes stale, without making initialize()/renderButton() re-run below.
  const onCredentialRef = useRef(onCredential);
  useEffect(() => {
    onCredentialRef.current = onCredential;
  });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;
    let cancelled = false;

    loadGoogleIdentityScript()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredentialRef.current(response.credential),
        });
        google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width: Math.min(containerRef.current.offsetWidth || 320, 400),
        });
      })
      .catch(() => {
        // No Google option is a fine degraded state — email/password still
        // works. Nothing to surface: the container just stays empty.
      });

    return () => {
      cancelled = true;
    };
    // Intentionally run once. Calling initialize()/renderButton() again on
    // every render would make Google append another button into the
    // container instead of replacing the first one.
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div
      ref={containerRef}
      className={`flex justify-center ${disabled ? 'pointer-events-none opacity-45' : ''}`}
    />
  );
}
