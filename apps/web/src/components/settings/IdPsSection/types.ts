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
  // carries provider email → parent pushes it into EmailPrefillContext
  onUpdateAccountEmailTo?: (email: string) => void;
}

/** Props for a single OAuth provider row. */
export interface ProviderRowProps {
  accountEmail: string;
  // which provider is awaiting disconnect confirmation; row shows confirm
  // UI when confirmDisconnect === provider
  confirmDisconnect: string | null;
  connection: ProviderConnection | null;
  disconnecting: boolean;
  // false → disconnect button disabled; user has no other login method
  hasPassword: boolean;
  label: string;
  icon: string;
  provider: string;
  // false for Apple — web-initiated Apple linking is not supported
  showConnect: boolean;
  onCancelDisconnect: () => void;
  onConfirmDisconnect: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onUpdateAccountEmailTo?: (email: string) => void;
}
