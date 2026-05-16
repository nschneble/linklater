import { unlinkOAuthProvider } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../../auth/AuthContext';
import { useState } from 'react';
import Alert from '../common/Alert';
import IconButton from '../common/IconButton';

interface SocialLoginsSectionProps {
  appleEnabled?: boolean;
  googleEnabled?: boolean;
  linkError?: string | null;
  linkedMessage?: string | null;
}

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
    if (!confirmDisconnect) return;

    setDisconnecting(true);
    setDisconnectError(null);

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

interface ProviderRowProps {
  confirmDisconnect: string | null;
  connected: boolean;
  disconnecting: boolean;
  hasPassword: boolean;
  label: string;
  provider: string;
  showConnect: boolean;
  onCancelDisconnect: () => void;
  onConfirmDisconnect: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

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

  return (
    <div className="flex items-center gap-3">
      <span className="text-[var(--text)] text-sm w-16">{label}</span>

      {connected ? (
        <>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 [[data-mode='dark']_&]:bg-emerald-950/20 border border-emerald-300 [[data-mode='dark']_&]:border-emerald-800/40 text-emerald-700 [[data-mode='dark']_&]:text-emerald-400 text-xs rounded-full">
            <i
              className="fa-solid fa-circle-check text-[0.6rem]"
              aria-hidden="true"
            />
            Connected
          </span>

          {isConfirming ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)]">
                Disconnect {label}?
              </span>
              <IconButton
                variant="danger-filled"
                disabled={disconnecting}
                onClick={onConfirmDisconnect}
              >
                {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
              </IconButton>
              <IconButton variant="ghost" onClick={onCancelDisconnect}>
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
