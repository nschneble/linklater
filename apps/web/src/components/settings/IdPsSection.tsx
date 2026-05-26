import Alert from '../common/Alert';
import IconButton from '../common/IconButton';
import LinkButton from '../common/LinkButton';
import StatusBadge from '../common/StatusBadge';
import { useAuth } from '../../auth/AuthContext';
import { initiateOAuthLink, unlinkOAuthProvider } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useFocusFirstButton } from '../../lib/hooks/useFocusFirstButton';
import { useRef, useState } from 'react';

/** Props for the IdPs settings section. */
interface IdPsSectionProps {
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

/**
 * Settings section for linking and disconnecting OAuth social accounts.
 *
 * Renders a row per enabled provider (Google, Apple). When the provider is
 * connected, the row shows the provider's email (announced as "Connected as
 * …" for screen readers) plus a "Disconnect" button with two-step confirmation.
 * When the provider's email differs from the account email, a "Use … instead"
 * button is offered as a shortcut into the existing email-change flow.
 *
 * The disconnect button is disabled for accounts without a password — losing
 * the only login method would orphan the account. The reason is exposed via
 * `aria-describedby` to keyboard + touch + AT users (a `title` attribute is
 * insufficient for those audiences).
 *
 * Returns `null` when both providers are disabled (no env vars set).
 */
export default function IdPsSection({
  appleEnabled = import.meta.env.VITE_APPLE_SSO_ENABLED === 'true',
  googleEnabled = import.meta.env.VITE_GOOGLE_SSO_ENABLED === 'true',
  linkError = null,
  linkedMessage = null,
  onUpdateAccountEmailTo,
}: IdPsSectionProps) {
  const { refreshUser, user } = useAuth();

  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(
    null,
  );
  const [connectError, setConnectError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const connectedProviders = user?.connectedProviders ?? [];
  const hasPassword = Boolean(user?.hasPassword);
  const accountEmail = user?.email ?? '';

  const findConnection = (provider: string) =>
    connectedProviders.find((entry) => entry.provider === provider) ?? null;

  const handleDisconnect = (provider: string) => {
    setConfirmDisconnect(provider);
    setDisconnectError(null);
  };

  const handleCancelDisconnect = () => {
    setConfirmDisconnect(null);
  };

  const handleConfirmDisconnect = async () => {
    if (!confirmDisconnect) {
      return;
    }

    setDisconnectError(null);
    setDisconnecting(true);

    try {
      await unlinkOAuthProvider(confirmDisconnect);
      setConfirmDisconnect(null);
      await refreshUser();
    } catch (error: unknown) {
      setDisconnectError(
        getErrorMessage(error, 'Failed to disconnect provider'),
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnect = async (provider: string) => {
    setConnectError(null);
    try {
      const { url } = await initiateOAuthLink(provider);
      window.location.assign(url);
    } catch (error: unknown) {
      setConnectError(
        getErrorMessage(error, `Failed to start ${provider} sign-in`),
      );
    }
  };

  if (!googleEnabled && !appleEnabled) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[var(--text)] text-sm font-semibold text-balance">
        IdPs
      </h3>
      <p className="text-[var(--text-muted)] text-xs text-pretty">
        Identity providers you've connected for signing in. The provider's email
        is shown for reference — it doesn't need to match your Linklater email.
      </p>

      {linkedMessage && <Alert variant="success">{linkedMessage}</Alert>}
      {linkError && <Alert variant="error">{linkError}</Alert>}
      {connectError && <Alert variant="error">{connectError}</Alert>}
      {disconnectError && <Alert variant="error">{disconnectError}</Alert>}

      <div className="space-y-3">
        {appleEnabled && (
          <ProviderRow
            accountEmail={accountEmail}
            confirmDisconnect={confirmDisconnect}
            connection={findConnection('apple')}
            disconnecting={disconnecting}
            hasPassword={hasPassword}
            provider="apple"
            label="Apple"
            icon="fa-apple"
            onCancelDisconnect={handleCancelDisconnect}
            onConfirmDisconnect={handleConfirmDisconnect}
            onConnect={() => handleConnect('apple')}
            onDisconnect={() => handleDisconnect('apple')}
            onUpdateAccountEmailTo={onUpdateAccountEmailTo}
            showConnect={false}
          />
        )}

        {googleEnabled && (
          <ProviderRow
            accountEmail={accountEmail}
            confirmDisconnect={confirmDisconnect}
            connection={findConnection('google')}
            disconnecting={disconnecting}
            hasPassword={hasPassword}
            provider="google"
            label="Google"
            icon="fa-google"
            onCancelDisconnect={handleCancelDisconnect}
            onConfirmDisconnect={handleConfirmDisconnect}
            onConnect={() => handleConnect('google')}
            onDisconnect={() => handleDisconnect('google')}
            onUpdateAccountEmailTo={onUpdateAccountEmailTo}
            showConnect
          />
        )}
      </div>
    </div>
  );
}

/** One connected IdP, as exposed by `AuthContext.User.connectedProviders`. */
interface ProviderConnection {
  provider: string;
  providerEmail: string;
  connectedAt: string;
}

/** Props for a single OAuth provider row. */
interface ProviderRowProps {
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

/**
 * A single row showing connect/disconnect controls for one OAuth provider.
 */
function ProviderRow({
  accountEmail,
  confirmDisconnect,
  connection,
  disconnecting,
  hasPassword,
  label,
  icon,
  provider,
  showConnect,
  onCancelDisconnect,
  onConfirmDisconnect,
  onConnect,
  onDisconnect,
  onUpdateAccountEmailTo,
}: ProviderRowProps) {
  const connected = connection !== null;
  const providerEmail = connection?.providerEmail ?? '';
  const emailsDiffer = connected && providerEmail !== accountEmail;
  const isConfirming = confirmDisconnect === provider;
  const confirmRowReference = useRef<HTMLDivElement>(null);
  const disconnectReasonId = `disconnect-${provider}-reason`;

  useFocusFirstButton(confirmRowReference, isConfirming);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-2 ${showConnect ? 'opacity-100' : 'opacity-60'}`}
        >
          <i className={`fa-brands ${icon} text-[0.7rem]`} aria-hidden="true" />
          <span className="text-[var(--text)] text-sm w-16">{label}</span>
          {connected && (
            <span className="text-[var(--text-muted)] text-xs break-all">
              <span className="sr-only">Connected as </span>
              {providerEmail}
            </span>
          )}
        </div>

        {connected ? (
          <div className="flex items-center gap-2">
            <StatusBadge variant="success" icon="fa-solid fa-circle-check">
              Connected
            </StatusBadge>

            {isConfirming ? (
              <div
                className="flex items-center gap-2 text-xs"
                ref={confirmRowReference}
              >
                <span className="text-[var(--text-muted)]">
                  Disconnect {label}?
                </span>
                <IconButton
                  aria-label={`Confirm disconnect ${label}`}
                  variant="danger-filled"
                  disabled={disconnecting}
                  onClick={onConfirmDisconnect}
                >
                  {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
                </IconButton>
                <IconButton
                  aria-label={`Cancel disconnect ${label}`}
                  variant="ghost"
                  onClick={onCancelDisconnect}
                >
                  Cancel
                </IconButton>
              </div>
            ) : (
              <IconButton
                variant="danger"
                disabled={!hasPassword}
                aria-describedby={!hasPassword ? disconnectReasonId : undefined}
                onClick={onDisconnect}
                aria-label={`Disconnect ${label} (${providerEmail})`}
              >
                Disconnect
              </IconButton>
            )}
          </div>
        ) : (
          <IconButton
            className="min-w-32"
            disabled={!showConnect}
            onClick={onConnect}
            aria-label={`Connect ${label}`}
          >
            Connect {label}
          </IconButton>
        )}
      </div>

      {connected && !hasPassword && (
        <p id={disconnectReasonId} className="text-[var(--text-muted)] text-xs">
          Add a password first to enable disconnecting.
        </p>
      )}

      {emailsDiffer && onUpdateAccountEmailTo && (
        <div className="pl-6 text-xs">
          <LinkButton
            aria-label={`Use ${providerEmail} as your account email — opens the email change form`}
            onClick={() => onUpdateAccountEmailTo(providerEmail)}
          >
            Use {providerEmail} instead
          </LinkButton>
        </div>
      )}
    </div>
  );
}
