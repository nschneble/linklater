import type { BaseTheme, Mode } from '../../theme/constants';
import type { CustomTheme } from '../../theme/customTheme';

/** The server profile from `GET /auth/me`; timestamps are ISO. */
export interface User {
  connectedProviders: Array<{
    provider: string;
    providerEmail: string;
    connectedAt: string;
  }>;
  cvdMode: boolean;
  dyslexicFont: boolean;
  /** Normalized on arrival, so only known bundle token keys survive. */
  customTheme: CustomTheme | null;
  /** Opt-in for the picker menus only; the editor always reaches it. */
  customThemeEnabled: boolean;
  email: string;
  emailVerifiedAt: string | null;
  hasPassword: boolean;
  pendingEmail: string | null;
  mode: Mode;
  theme: BaseTheme;
  multiFactorMethod: 'totp' | null;
  /** TOTP setup was started but never verified. */
  multiFactorPending: boolean;
  /**
   * A deletion confirmation is outstanding. Server-side so the waiting
   * panel survives navigating away from settings and back.
   */
  accountDeletionPending: boolean;
  /** The API renames `id` to this on the way out. */
  userId: string;
  welcomedAt: string | null;
}

/** Auth state and actions, reached through `useAuth`. */
export interface AuthContextValue {
  /** True while the initial session check runs on page load. */
  loading: boolean;
  /**
   * Resolves to an MFA challenge instead of signing in when the account
   * has MFA enabled, leaving `user` unpopulated for the caller to handle.
   */
  login: (
    email: string,
    password: string,
  ) => Promise<{ mfaToken: string; mfaMethod: 'totp' } | void>;
  loginWithToken: (accessToken: string, refreshToken?: string) => Promise<void>;
  /** Revokes every server session, not just this device's. */
  logout: () => void;
  register: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  resendEmailChangeVerification: () => Promise<void>;
  /** Optimistic; does not re-fetch the profile. */
  setPendingEmail: (email: string) => void;
  refreshUser: () => Promise<void>;
  /**
   * Optimistic, and never rejects: a failure is logged and the next page
   * load retries naturally.
   */
  markWelcomed: () => Promise<void>;
  user: User | null;
}
