/**
 * Session context.
 *
 * `loading` starts true and only flips once the stored token has been
 * checked against /auth/me. Route guards must wait for it — rendering a
 * redirect before the session is known would bounce a signed-in user to
 * /login on every hard refresh.
 *
 * Replaced Supabase Auth. The account object comes from this project's own
 * backend, which reads role and status from the profiles row, so a role
 * change takes effect on the next request rather than when a token expires.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as authClient from './authClient';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore whatever session the stored token still supports. fetchMe
  // refreshes once behind the scenes if the access token has expired, and
  // resolves to null when there is nothing valid — which is simply
  // "signed out", not an error to surface.
  useEffect(() => {
    let active = true;
    authClient
      .fetchMe()
      .then((me) => {
        if (active) setAccount(me);
      })
      .catch(() => {
        if (active) setAccount(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const session = await authClient.login(email, password);
    authClient.storeTokens(session);
    setAccount(session.user);
    return session;
  }, []);

  const signUp = useCallback(async (email, password, fullName) => {
    const session = await authClient.signup(email, password, fullName);
    authClient.storeTokens(session);
    setAccount(session.user);
    return session;
  }, []);

  const signInWithGoogle = useCallback(async (credential) => {
    const session = await authClient.loginWithGoogle(credential);
    authClient.storeTokens(session);
    setAccount(session.user);
    return session;
  }, []);

  const signOut = useCallback(async () => {
    // Tokens are stateless, so signing out is purely local: drop them and
    // the short-lived access token expires on its own.
    authClient.clearTokens();
    setAccount(null);
  }, []);

  const updateAccount = useCallback((nextAccount) => {
    setAccount((current) => current ? { ...current, ...nextAccount } : nextAccount);
  }, []);

  const value = useMemo(
    () => ({
      // `user` and `profile` are the same object now. Both names are kept
      // because components across the app read one or the other, and the
      // backend returns id/email/role/status/category_id in a single shape.
      user: account,
      profile: account,
      loading,
      isAdmin: account?.role === 'admin',
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      updateAccount,
      resetPassword: (email) => authClient.requestPasswordReset(email),
      updatePassword: (token, password) => authClient.resetPassword(token, password),
      verifyEmail: (token) => authClient.verifyEmail(token),
      refreshAccount: async () => {
        const me = await authClient.fetchMe();
        setAccount(me);
        return me;
      },
    }),
    [account, loading, signIn, signUp, signInWithGoogle, signOut, updateAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
