import { createContext, useContext, type ReactNode } from 'react';

import { useAuthState } from './useAuthState';
import type { AuthContextValue, User } from './types';

export type { User };

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
  const value = useAuthState();

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
