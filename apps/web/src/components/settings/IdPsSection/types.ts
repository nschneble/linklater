/** One connected IdP, as exposed by `AuthContext.User.connectedProviders`. */
export interface ProviderConnection {
  provider: string;
  providerEmail: string;
  connectedAt: string;
}

/** Props for the IdPs settings section. */
export interface IdPsSectionProps {
  /**
   * When `true`, the Apple row is shown. Defaults to the value of
   * `VITE_APPLE_SSO_ENABLED`. Overridable in tests.
   */
  appleEnabled?: boolean;
  /**
   * When `true`, the Google row is shown. Defaults to the value of
   * `VITE_GOOGLE_SSO_ENABLED`. Overridable in tests.
   */
  googleEnabled?: boolean;
  /**
   * Error message to display when an account-linking redirect returned a
   * `link_error` query parameter (currently only `'already_linked'`). Null
   * when no error.
   */
  linkError?: string | null;
  /**
   * Success message to display when the OAuth linking flow completed
   * (e.g. the `linked=google` query parameter is present). Null when absent.
   */
  linkedMessage?: string | null;
  /**
   * Called when the user clicks "Use <providerEmail> instead". Carries the
   * provider's email so the parent (`SettingsView`) can push it into the
   * email-change form via `EmailPrefillContext`.
   */
  onUpdateAccountEmailTo?: (email: string) => void;
}

/** Props for a single OAuth provider row. */
export interface ProviderRowProps {
  /** The current Linklater account email. Compared with `providerEmail`. */
  accountEmail: string;
  /**
   * The provider key currently awaiting confirmation, or `null`. This row
   * renders its confirmation UI when `confirmDisconnect === provider`.
   */
  confirmDisconnect: string | null;
  /** The connection record when this provider is linked; `null` otherwise. */
  connection: ProviderConnection | null;
  /** Whether a disconnect request is in flight (disables buttons). */
  disconnecting: boolean;
  /**
   * When `false`, the disconnect button is disabled to prevent the user
   * from losing their only way to log in.
   */
  hasPassword: boolean;
  /** Display name shown next to the controls (e.g. `'Google'`). */
  label: string;
  /** Font Awesome brand icon shown next to the display name (e.g. `'fa-google'`). */
  icon: string;
  /** Internal provider key used for the confirmation check (e.g. `'google'`). */
  provider: string;
  /**
   * Whether to show a "Connect" button when not connected. Apple omits
   * the connect button because web-initiated Apple linking is not supported.
   */
  showConnect: boolean;
  /** Called when the user cancels the disconnect confirmation step. */
  onCancelDisconnect: () => void;
  /** Called when the user confirms the disconnect. */
  onConfirmDisconnect: () => void;
  /** Called to start the OAuth linking flow for this provider. */
  onConnect: () => void;
  /** Called to enter the disconnect confirmation step. */
  onDisconnect: () => void;
  /** Bubbled up to `IdPsSection`'s parent — drives the email prefill flow. */
  onUpdateAccountEmailTo?: (email: string) => void;
}
