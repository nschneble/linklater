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
  // which provider is awaiting disconnect confirmation; row shows confirm
  // UI when confirmDisconnect === provider
  confirmDisconnect: string | null;
  connection: ProviderConnection | null;
  disconnecting: boolean;
  label: string;
  icon: string;
  provider: string;
  onCancelDisconnect: () => void;
  onConfirmDisconnect: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}
