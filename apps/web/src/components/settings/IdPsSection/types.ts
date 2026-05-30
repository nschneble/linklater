/** One connected IdP, as exposed by `AuthContext.User.connectedProviders`. */
export interface ProviderConnection {
  provider: string;
  providerEmail: string;
  connectedAt: string;
}

/** Props for the IdPs settings section. */
export interface IdPsSectionProps {
  appleEnabled?: boolean;
  googleEnabled?: boolean;
  // set from `link_error` query param on OAuth redirect return
  linkError?: string | null;
  // set from `linked` query param when OAuth linking completes
  linkedMessage?: string | null;
}

/** Props for a single OAuth provider row. */
export interface ProviderRowProps {
  connection: ProviderConnection | null;
  label: string;
  icon: string;
  /**
   * Async unlink action invoked when the user confirms a disconnect. Errors
   * are caught by the row's `ActionGuard` and surfaced as an inline alert.
   */
  onDisconnect: () => Promise<void>;
  onConnect: () => void;
}
