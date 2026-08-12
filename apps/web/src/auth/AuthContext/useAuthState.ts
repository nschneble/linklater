import {
  acknowledgeWelcome as apiAcknowledgeWelcome,
  getMe,
  getStoredToken,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  resendEmailChangeVerification as apiResendEmailChangeVerification,
  resendVerificationEmail as apiResendVerificationEmail,
  setStoredToken,
} from '../../lib/api';
import { dropCarriedEmail } from '../../components/auth/carriedEmail';
import {
  forgetRenderedIdentity,
  noteRenderedIdentity,
} from './renderedIdentity';
import { mapMeToUser } from './mapMeToUser';
import {
  reconcileColdBootIdentity,
  useIdentityGuard,
} from './useIdentityGuard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthContextValue, User } from './types';
import type { MeResponse } from '../../lib/api';

/**
 * Encapsulates authentication state, effects, and action handlers.
 * Consumed by `AuthProvider`, which passes the returned value into context.
 *
 * Watching the stored token for an identity that stopped matching the
 * rendered one lives next door in `useIdentityGuard`, which this hook
 * feeds a mirror of `user` and its own `refreshUser`.
 */
export function useAuthState(): AuthContextValue {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // a [] callback captures a first-render user that is always null
  const userReference = useRef<User | null>(null);
  useEffect(() => {
    userReference.current = user;
  }, [user]);

  // a getMe in flight when logout fires must not resurrect the session
  const sessionEpochReference = useRef(0);

  // rendering a user and recording who this tab is rendering are one act
  const adoptUser = useCallback((me: MeResponse) => {
    const nextUser = mapMeToUser(me);
    noteRenderedIdentity(nextUser.userId);
    // an offer that reached here landed, so its carry is spent
    dropCarriedEmail();
    setUser(nextUser);
  }, []);

  // on mount: hydrate auth state from the stored JWT, if any
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // a token belonging to someone else is a switch, not a boot
    if (reconcileColdBootIdentity(token)) return;

    // no epoch check: loading hides every affordance a sign-out could use
    (async () => {
      try {
        const me = await getMe();
        adoptUser(me);
      } catch (error) {
        console.error('Failed to fetch current user', error);
        // leave the token on failed hydration; core clears it only on a 401/403
      } finally {
        setLoading(false);
      }
    })();
  }, [adoptUser]);

  /**
   * Calls the API login endpoint, then fetches the user profile to populate
   * state. The JWT is stored automatically by `apiLogin` via `setStoredToken`.
   */
  const login = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ mfaToken: string; mfaMethod: 'totp' } | void> => {
      const result = await apiLogin(email, password);
      if ('mfaToken' in result) {
        return { mfaToken: result.mfaToken, mfaMethod: result.mfaMethod };
      }
      const me = await getMe();
      adoptUser(me);
    },
    [adoptUser],
  );

  const loginWithToken = useCallback(
    async (accessToken: string, refreshToken?: string) => {
      setStoredToken(accessToken, refreshToken);
      const me = await getMe();
      adoptUser(me);
    },
    [adoptUser],
  );

  /**
   * Creates an account then immediately logs in so the user lands on the
   * app without an extra step.
   */
  const register = useCallback(
    async (email: string, password: string) => {
      await apiRegister(email, password);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    sessionEpochReference.current += 1;
    void apiLogout();
    forgetRenderedIdentity();
    setUser(null);
  }, []);

  // module-level stable, so no useCallback wrapper needed
  const resendVerificationEmail = apiResendVerificationEmail;
  const resendEmailChangeVerification = apiResendEmailChangeVerification;

  /**
   * Optimistically updates `user.pendingEmail` after the user submits an
   * email change request. This prevents a stale value from being shown while
   * the user's browser tab is still open.
   */
  const setPendingEmail = useCallback((email: string) => {
    setUser((previous) =>
      previous ? { ...previous, pendingEmail: email } : previous,
    );
  }, []);

  const refreshUser = useCallback(async () => {
    const epochAtStart = sessionEpochReference.current;
    try {
      const me = await getMe();
      if (sessionEpochReference.current !== epochAtStart) return;
      adoptUser(me);
    } catch (error) {
      console.error('Failed to refresh user', error);
    }
  }, [adoptUser]);

  useIdentityGuard(userReference, refreshUser);

  const markWelcomed = useCallback(async () => {
    setUser((previous) =>
      previous
        ? { ...previous, welcomedAt: new Date().toISOString() }
        : previous,
    );
    try {
      await apiAcknowledgeWelcome();
    } catch (error) {
      console.error('Failed to acknowledge welcome', error);
    }
  }, []);

  return useMemo<AuthContextValue>(
    () => ({
      loading,
      login,
      loginWithToken,
      logout,
      markWelcomed,
      refreshUser,
      register,
      resendEmailChangeVerification,
      resendVerificationEmail,
      setPendingEmail,
      user,
    }),
    [
      loading,
      login,
      loginWithToken,
      logout,
      markWelcomed,
      refreshUser,
      register,
      resendEmailChangeVerification,
      resendVerificationEmail,
      setPendingEmail,
      user,
    ],
  );
}
