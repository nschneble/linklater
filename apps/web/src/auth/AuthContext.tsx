import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  clearStoredToken,
  getMe,
  getStoredToken,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  resendVerificationEmail as apiResendVerificationEmail,
} from '../lib/api';

/**
 * The minimal user object stored in auth state. Populated from `GET /auth/me`
 * after login or after page load when a stored JWT is found.
 */
export interface User {
  /** The user's current email address. */
  email: string;
  /** ISO timestamp of when the email was verified, or `null` if unverified. */
  emailVerifiedAt: string | null;
  /**
   * The new email address awaiting verification, or `null` if no change is pending.
   * Shown in `AccountSettingsForm` so the user knows their change is in progress.
   */
  pendingEmail: string | null;
  /** The current color mode (`'light'` or `'dark'`). */
  mode: string;
  /** The current theme identifier (e.g. `'scanner-darkly'`). */
  theme: string;
  /** The user's UUID (renamed from `id` to `userId` by `GET /auth/me`). */
  userId: string;
}

/**
 * The shape of the value provided by `AuthContext`. All authentication
 * actions and state are accessed through this interface via `useAuth`.
 */
interface AuthContextValue {
  /** `true` while the initial `/auth/me` check is in progress on page load. */
  loading: boolean;
  /** Authenticates the user. Resolves on success, rejects with an error on failure. */
  login: (email: string, password: string) => Promise<void>;
  /** Clears the stored JWT and sets `user` to `null`. */
  logout: () => void;
  /** Creates a new account and immediately logs in. */
  register: (email: string, password: string) => Promise<void>;
  /** Resends the email verification message to the current user's address. */
  resendVerificationEmail: () => Promise<void>;
  /**
   * Optimistically updates the `pendingEmail` field in auth state without
   * re-fetching from the server. Called by `AccountSettingsForm` immediately
   * after a successful `requestEmailChange` response.
   */
  setPendingEmail: (email: string) => void;
  /** The authenticated user, or `null` when logged out. */
  user: User | null;
}

// createContext with `undefined` forces consumers to check that they are
// wrapped in `AuthProvider`. The custom `useAuth` hook throws a clear error
// if the context value is still `undefined`.
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides authentication state and actions to the component tree.
 *
 * On mount, checks `localStorage` for an existing JWT and, if found, calls
 * `GET /auth/me` to validate it and populate `user`. Clears the stored token
 * if the check fails (expired or revoked token).
 *
 * @param children - The subtree that should have access to auth state.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
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
        setUser({
          userId: me.userId,
          email: me.email,
          emailVerifiedAt: me.emailVerifiedAt,
          pendingEmail: me.pendingEmail,
          mode: me.mode,
          theme: me.theme,
        });
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
  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    const me = await getMe();
    setUser({
      userId: me.userId,
      email: me.email,
      emailVerifiedAt: me.emailVerifiedAt,
      pendingEmail: me.pendingEmail,
      mode: me.mode,
      theme: me.theme,
    });
  }, []);

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

  /** Clears the stored JWT and removes `user` from state. */
  const logout = useCallback(() => {
    apiLogout();
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

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      login,
      logout,
      register,
      resendVerificationEmail,
      setPendingEmail,
      user,
    }),
    [
      loading,
      login,
      logout,
      register,
      resendVerificationEmail,
      setPendingEmail,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Provides access to authentication state and actions from any component
 * within the `AuthProvider` tree.
 *
 * @throws {Error} When called outside of an `AuthProvider`.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');

  return context;
}
