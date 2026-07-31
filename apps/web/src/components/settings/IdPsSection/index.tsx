import { useAuth } from '../../../auth/AuthContext';
import { initiateOAuthLink, unlinkOAuthProvider } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import Alert from '../../common/Alert';
import ProviderRow from './ProviderRow';
import { useState } from 'react';
import type { IdPsSectionProps } from './types';

/**
 * Settings section for linking and disconnecting OAuth social accounts.
 *
 * Renders a row per enabled provider (Google, Apple). When the provider is
 * connected, the row shows the provider's email (announced as "Connected as
 * …" for screen readers) plus a "Disconnect" button with two-step
 * confirmation owned by `ActionGuard` inside the row.
 *
 * Section-level Alerts here are only for state that isn't tied to a single
 * row's guarded action: the `link_error` query param from the OAuth redirect
 * return, and the connect-initiation error (which fires before any
 * row-scoped flow exists). The success counterpart (`?linked=…`) is surfaced
 * as a `<Toast>` owned by `SettingsView`, not an inline Alert here.
 *
 * Returns `null` when neither provider has a renderable row.
 */
export default function IdPsSection({
  appleEnabled = import.meta.env.VITE_APPLE_SSO_ENABLED === 'true',
  googleEnabled = import.meta.env.VITE_GOOGLE_SSO_ENABLED === 'true',
  linkError = null,
}: IdPsSectionProps) {
  const { refreshUser, user } = useAuth();

  const [connectError, setConnectError] = useState<string | null>(null);

  const connectedProviders = user?.connectedProviders ?? [];

  const findConnection = (provider: string) =>
    connectedProviders.find((entry) => entry.provider === provider) ?? null;

  // no /auth/apple/link yet: hide Connect Apple, keep disconnect
  const appleConnection = findConnection('apple');
  const showAppleRow = appleEnabled && appleConnection !== null;

  const handleDisconnect = async (provider: string) => {
    await unlinkOAuthProvider(provider);
    await refreshUser();
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

  if (!googleEnabled && !showAppleRow) {
    return null;
  }

  // single error slot: connectError wins over the URL-derived linkError
  const displayedError = connectError ?? linkError;

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-[var(--mount-text)] text-sm font-semibold text-balance">
        Other ways to log in
      </h3>

      {displayedError && <Alert variant="error">{displayedError}</Alert>}

      <div className="mt-5 space-y-3">
        {showAppleRow && (
          <ProviderRow
            connection={appleConnection}
            label="Apple"
            icon="fa-apple"
            onConnect={() => handleConnect('apple')}
            onDisconnect={() => handleDisconnect('apple')}
          />
        )}

        {googleEnabled && (
          <ProviderRow
            connection={findConnection('google')}
            label="Google"
            icon="fa-google"
            onConnect={() => handleConnect('google')}
            onDisconnect={() => handleDisconnect('google')}
          />
        )}
      </div>
    </div>
  );
}
