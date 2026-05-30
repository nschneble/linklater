/**
 * The minimal user object stored in auth state. Populated from `GET /auth/me`
 * after login or after page load when a stored JWT is found.
 */
export interface User {
  /** The OAuth providers connected to this account. */
  connectedProviders: Array<{
    provider: string;
    providerEmail: string;
    connectedAt: string;
  }>;
  /** When `true`, CVD mode is enabled on the server. */
  cvdMode: boolean;
  /** The user's current email address. */
  email: string;
  /** ISO timestamp of when the email was verified, or `null` if unverified. */
  emailVerifiedAt: string | null;
  /** `true` when the account has a password set; `false` for SSO-only accounts. */
  hasPassword: boolean;
  /**
   * The new email address awaiting verification, or `null` if no change is pending.
   * Shown in `AccountSettingsForm` so the user knows their change is in progress.
   */
  pendingEmail: string | null;
  /** The current color mode (`'light'` or `'dark'`). */
  mode: string;
  /** The current theme identifier (e.g. `'scanner-darkly'`). */
  theme: string;
  /** The active MFA method, or `null` when MFA is disabled. */
  multiFactorMethod: 'totp' | null;
  /** `true` when the user has started TOTP setup but not yet verified it. */
  multiFactorPending: boolean;
  /** The user's UUID (renamed from `id` to `userId` by `GET /auth/me`). */
  userId: string;
  /**
   * ISO timestamp of when the user dismissed the welcome modal, or `null` if
   * they have not seen it yet. New users created after the feature shipped
   * land with `null` and see the welcome modal on first sign-in.
   */
  welcomedAt: string | null;
}

/**
 * The shape of the value provided by `AuthContext`. All authentication
 * actions and state are accessed through this interface via `useAuth`.
 */
export interface AuthContextValue {
  /** `true` while the initial `/auth/me` check is in progress on page load. */
  loading: boolean;
  /**
   * Authenticates the user. On success, populates `user` and resolves to `void`.
   * When the account has MFA enabled, resolves to `{ mfaToken, mfaMethod }` instead
   * and leaves `user` unpopulated — the caller must present the OTP challenge.
   */
  login: (
    email: string,
    password: string,
  ) => Promise<{ mfaToken: string; mfaMethod: 'totp' } | void>;
  /** Stores OAuth-issued tokens and fetches the user profile. Used by `OAuthCallbackPage`. */
  loginWithToken: (accessToken: string, refreshToken?: string) => Promise<void>;
  /** Revokes all server sessions, clears stored tokens, and sets `user` to `null`. */
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
  /** Re-fetches the current user profile from the server and updates auth state. */
  refreshUser: () => Promise<void>;
  /**
   * Records that the user has dismissed the welcome modal. Calls the welcome
   * endpoint and optimistically updates `user.welcomedAt` so the modal
   * disappears immediately. Errors are swallowed and logged — the modal
   * dismissal is not blocking, and the next page load will retry naturally.
   */
  markWelcomed: () => Promise<void>;
  /** The authenticated user, or `null` when logged out. */
  user: User | null;
}
