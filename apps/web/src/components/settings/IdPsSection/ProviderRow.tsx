import IconButton from '../../common/IconButton';
import LinkButton from '../../common/LinkButton';
import StatusBadge from '../../common/StatusBadge';
import { useFocusFirstButton } from '../../../lib/hooks/useFocusFirstButton';
import { useRef } from 'react';
import type { ProviderRowProps } from './types';

/**
 * A single row showing connect/disconnect controls for one OAuth provider.
 */
export default function ProviderRow({
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
