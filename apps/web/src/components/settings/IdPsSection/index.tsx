import Alert from '../../common/Alert';
import ProviderRow from './ProviderRow';
import { useAuth } from '../../../auth/AuthContext';
import { initiateOAuthLink, unlinkOAuthProvider } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { useState } from 'react';
import type { IdPsSectionProps } from './types';

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
        Other ways to log in
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
