import IconButton from '../../common/IconButton';
import { useFocusFirstButton } from '../../../lib/hooks/useFocusFirstButton';
import { useRef } from 'react';
import type { ProviderRowProps } from './types';

/**
 * A single row showing connect/disconnect controls for one OAuth provider.
 */
export default function ProviderRow({
  confirmDisconnect,
  connection,
  disconnecting,
  label,
  icon,
  provider,
  onCancelDisconnect,
  onConfirmDisconnect,
  onConnect,
  onDisconnect,
}: ProviderRowProps) {
  const connected = connection !== null;
  const providerEmail = connection?.providerEmail ?? '';
  const isConfirming = confirmDisconnect === provider;
  const confirmRowReference = useRef<HTMLDivElement>(null);

  useFocusFirstButton(confirmRowReference, isConfirming);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className={`fa-brands ${icon} text-[0.7rem]`} aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-[var(--text)] text-sm">{label}</span>
            {connected && (
              <span className="text-[var(--text-muted)] text-xs break-all">
                <span className="sr-only">Connected as </span>
                {providerEmail}
              </span>
            )}
          </div>
        </div>

        {connected ? (
          <div className="flex items-center gap-2">
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
            onClick={onConnect}
            aria-label={`Connect ${label}`}
          >
            Connect {label}
          </IconButton>
        )}
      </div>
    </div>
  );
}
