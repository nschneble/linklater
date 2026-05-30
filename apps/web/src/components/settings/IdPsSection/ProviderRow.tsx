import ActionGuard from '../../common/ActionGuard';
import IconButton from '../../common/IconButton';
import type { ProviderRowProps } from './types';

/**
 * A single row showing connect/disconnect controls for one OAuth provider.
 *
 * Disconnect is a two-step destructive action, so the connected branch
 * delegates its confirm flow to `ActionGuard` (matching `ApiTokenRow`,
 * `DangerZone`, and `BookmarkletRegenerateButton`). The guard owns focus
 * management, Escape-to-cancel, focus-into-error-alert on failure, and the
 * polite live region used for the success announcement.
 */
export default function ProviderRow({
  connection,
  label,
  icon,
  onConnect,
  onDisconnect,
}: ProviderRowProps) {
  const connected = connection !== null;
  const providerEmail = connection?.providerEmail ?? '';

  if (!connected) {
    return (
      <div className="flex items-center justify-between">
        <ProviderLabel icon={icon} label={label} />
        <IconButton
          className="min-w-32"
          onClick={onConnect}
          aria-label={`Connect ${label}`}
        >
          Connect {label}
        </IconButton>
      </div>
    );
  }

  return (
    <ActionGuard
      className="space-y-1"
      errorFallback={`Failed to disconnect ${label}`}
      successAnnouncement={`Disconnected from ${label}`}
      onConfirm={onDisconnect}
    >
      {({
        confirming,
        pending,
        triggerId,
        confirmReference,
        openConfirm,
        closeConfirm,
        runConfirm,
      }) => (
        <div className="flex items-center justify-between">
          <ProviderLabel
            icon={icon}
            label={label}
            providerEmail={providerEmail}
          />

          {!confirming ? (
            <IconButton
              id={triggerId}
              variant="danger"
              onClick={openConfirm}
              aria-label={`Disconnect ${label} (${providerEmail})`}
            >
              Disconnect
            </IconButton>
          ) : (
            <div
              className="flex items-center gap-2 text-xs"
              ref={confirmReference}
            >
              <span className="text-[var(--text-muted)]">
                Disconnect {label}?
              </span>
              <IconButton
                aria-label={`Confirm disconnect ${label}`}
                variant="danger-filled"
                disabled={pending}
                onClick={runConfirm}
              >
                {pending ? 'Disconnecting…' : 'Yes, disconnect'}
              </IconButton>
              <IconButton
                aria-label={`Cancel disconnect ${label}`}
                variant="ghost"
                disabled={pending}
                onClick={closeConfirm}
              >
                Cancel
              </IconButton>
            </div>
          )}
        </div>
      )}
    </ActionGuard>
  );
}

interface ProviderLabelProps {
  icon: string;
  label: string;
  providerEmail?: string;
}

function ProviderLabel({ icon, label, providerEmail }: ProviderLabelProps) {
  return (
    <div className="flex items-center gap-2">
      <i className={`fa-brands ${icon} text-[0.7rem]`} aria-hidden="true" />
      <div className="flex flex-col">
        <span className="text-[var(--text)] text-sm">{label}</span>
        {providerEmail && (
          <span className="text-[var(--text-muted)] text-xs break-all">
            <span className="sr-only">Connected as </span>
            {providerEmail}
          </span>
        )}
      </div>
    </div>
  );
}
