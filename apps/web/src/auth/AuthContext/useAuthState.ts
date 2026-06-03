import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  acknowledgeWelcome as apiAcknowledgeWelcome,
  clearStoredToken,
  getMe,
  getStoredToken,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  resendVerificationEmail as apiResendVerificationEmail,
  setStoredToken,
} from '../../lib/api';
import type { MeResponse } from '../../lib/api';
import { VALID_BASE_THEME_IDS } from '../../theme/constants';
import type { BaseTheme, Mode } from '../../theme/constants';
import type { AuthContextValue, User } from './types';

/**
 * Narrows the server-returned `theme` string to a `BaseTheme`, falling back
 * to `'scanner-darkly'` if the server returns an id this client doesn't
 * know about (schema drift between API and web releases).
 */
function narrowTheme(theme: string): BaseTheme {
  return VALID_BASE_THEME_IDS.has(theme)
    ? (theme as BaseTheme)
    : 'scanner-darkly';
}

/**
 * Narrows the server-returned `mode` string to a `Mode`, falling back to
 * `'dark'` for any unexpected value.
 */
function narrowMode(mode: string): Mode {
  return mode === 'light' || mode === 'dark' ? mode : 'dark';
}

/**
 * Maps the raw `GET /auth/me` response shape to the `User` interface.
 * Extracted to avoid repetition in every code path that calls `getMe`
 * (e.g. mount, login, loginWithToken, refreshUser).
 */
function mapMeToUser(me: MeResponse): User {
  return {
    cvdMode: me.cvdMode,
    connectedProviders: me.connectedProviders,
    email: me.email,
    emailVerifiedAt: me.emailVerifiedAt,
    hasPassword: me.hasPassword,
    mode: narrowMode(me.mode),
    pendingEmail: me.pendingEmail,
    theme: narrowTheme(me.theme),
    multiFactorMethod: me.multiFactorMethod,
    multiFactorPending: me.multiFactorPending,
    userId: me.userId,
    welcomedAt: me.welcomedAt,
  };
}

/**
 * Encapsulates all authentication state, effects, and action handlers.
 * Consumed by `AuthProvider`, which passes the returned value into context.
 */
export function useAuthState(): AuthContextValue {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // On mount: hydrate auth state from the stored JWT, if any.
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const me = await getMe();
        setUser(mapMeToUser(me));
      } catch (error) {
        console.error('Failed to fetch current user', error);
        clearStoredToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      setUser(mapMeToUser(me));
    },
    [],
  );

  const loginWithToken = useCallback(
    async (accessToken: string, refreshToken?: string) => {
      setStoredToken(accessToken, refreshToken);
      const me = await getMe();
      setUser(mapMeToUser(me));
    },
    [],
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
    void apiLogout();
    setUser(null);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    await apiResendVerificationEmail();
  }, []);

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
    try {
      const me = await getMe();
      setUser(mapMeToUser(me));
    } catch (error) {
      console.error('Failed to refresh user', error);
    }
  }, []);

  // When the user returns to the tab, re-fetch the current user so state
  // mutated elsewhere (another tab, another device, a server-side flag flip
  // during MFA setup) is picked up automatically. Guarded by a 2s stale
  // threshold so rapid tab-switching can't fan out N requests, and skipped
  // when there is no signed-in user.
  const lastVisibilityRefreshReference = useRef(0);
  useEffect(() => {
    const VISIBILITY_REFRESH_MIN_INTERVAL_MS = 2000;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!getStoredToken()) return;
      const now = Date.now();
      if (
        now - lastVisibilityRefreshReference.current <
        VISIBILITY_REFRESH_MIN_INTERVAL_MS
      ) {
        return;
      }
      lastVisibilityRefreshReference.current = now;
      void refreshUser();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshUser]);

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
      resendVerificationEmail,
      setPendingEmail,
      user,
    ],
  );
}
