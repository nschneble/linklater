import Alert from '../common/Alert';
import IconButton from '../common/IconButton';
import StatusBadge from '../common/StatusBadge';
import { useAuth } from '../../auth/AuthContext';
import { unlinkOAuthProvider } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useEffect, useRef, useState } from 'react';

/** Props for the social logins settings section. */
interface SocialLoginsSectionProps {
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
   * Error message to display when an account-linking redirect returned
   * a `link_error` query parameter (e.g. `'email_mismatch'` or
   * `'already_linked'`). Null when no error.
   */
  linkError?: string | null;
  /**
   * Success message to display when the OAuth linking flow completed
   * (e.g. the `linked=google` query parameter is present). Null when absent.
   */
  linkedMessage?: string | null;
}

/**
 * Settings section for linking and disconnecting OAuth social accounts.
 *
 * Renders a row per enabled provider (Google, Apple). When the provider
 * is already connected, a "Disconnect" button with a two-step confirmation
 * is shown. When not connected, a "Connect" button navigates to
 * `GET /auth/<provider>/link` to start the OAuth linking flow.
 *
 * The disconnect button is disabled for accounts without a password —
 * disconnecting would otherwise leave the user with no way to log in.
 * A tooltip explains why the button is disabled in that case.
 *
 * Returns `null` when both providers are disabled (no env vars set).
 */
export default function SocialLoginsSection({
  appleEnabled = import.meta.env.VITE_APPLE_SSO_ENABLED === 'true',
  googleEnabled = import.meta.env.VITE_GOOGLE_SSO_ENABLED === 'true',
  linkError = null,
  linkedMessage = null,
}: SocialLoginsSectionProps) {
  const { refreshUser, user } = useAuth();

  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(
    null,
  );
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const connectedProviders = user?.connectedProviders ?? [];
  const hasPassword = Boolean(user?.hasPassword);

  const isConnected = (provider: string) =>
    connectedProviders.some((connected) => connected.provider === provider);

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

  const handleConnect = (provider: string) => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/${provider}/link`;
  };

  if (!googleEnabled && !appleEnabled) {
    return null;
  }

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-[var(--text)] text-xl font-semibold text-balance">
        Social logins
      </h2>

      {linkedMessage && <Alert variant="success">{linkedMessage}</Alert>}
      {linkError && <Alert variant="error">{linkError}</Alert>}
      {disconnectError && <Alert variant="error">{disconnectError}</Alert>}

      <div className="space-y-3">
        {googleEnabled && (
          <ProviderRow
            confirmDisconnect={confirmDisconnect}
            connected={isConnected('google')}
            disconnecting={disconnecting}
            hasPassword={hasPassword}
            provider="google"
            label="Google"
            onCancelDisconnect={handleCancelDisconnect}
            onConfirmDisconnect={handleConfirmDisconnect}
            onConnect={() => handleConnect('google')}
            onDisconnect={() => handleDisconnect('google')}
            showConnect
          />
        )}

        {appleEnabled && (
          <ProviderRow
            confirmDisconnect={confirmDisconnect}
            connected={isConnected('apple')}
            disconnecting={disconnecting}
            hasPassword={hasPassword}
            provider="apple"
            label="Apple"
            onCancelDisconnect={handleCancelDisconnect}
            onConfirmDisconnect={handleConfirmDisconnect}
            onConnect={() => handleConnect('apple')}
            onDisconnect={() => handleDisconnect('apple')}
            showConnect={false}
          />
        )}
      </div>
    </div>
  );
}

/** Props for a single OAuth provider row. */
interface ProviderRowProps {
  /**
   * The provider key currently awaiting confirmation, or `null`. This row
   * renders its confirmation UI when `confirmDisconnect === provider`.
   */
  confirmDisconnect: string | null;
  /** Whether this provider is currently linked to the user's account. */
  connected: boolean;
  /** Whether a disconnect request is in flight (disables buttons). */
  disconnecting: boolean;
  /**
   * When `false`, the disconnect button is disabled to prevent the user
   * from losing their only way to log in.
   */
  hasPassword: boolean;
  /** Display name shown next to the controls (e.g. `'Google'`). */
  label: string;
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
}

/**
 * A single row showing connect/disconnect controls for one OAuth provider.
 */
function ProviderRow({
  confirmDisconnect,
  connected,
  disconnecting,
  hasPassword,
  label,
  provider,
  showConnect,
  onCancelDisconnect,
  onConfirmDisconnect,
  onConnect,
  onDisconnect,
}: ProviderRowProps) {
  const isConfirming = confirmDisconnect === provider;
  const confirmRowReference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isConfirming) {
      confirmRowReference.current?.querySelector('button')?.focus();
    }
  }, [isConfirming]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-[var(--text)] text-sm w-16">{label}</span>

      {connected ? (
        <>
          <StatusBadge variant="success" icon="fa-solid fa-circle-check">
            Connected
          </StatusBadge>

          {isConfirming ? (
            <div className="flex items-center gap-2 text-xs" ref={confirmRowReference}>
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
              title={!hasPassword ? 'Add a password first' : undefined}
              onClick={onDisconnect}
              aria-label={`Disconnect ${label}`}
            >
              Disconnect
            </IconButton>
          )}
        </>
      ) : (
        showConnect && (
          <IconButton onClick={onConnect} aria-label={`Connect ${label}`}>
            Connect
          </IconButton>
        )
      )}
    </div>
  );
}
