import { actionGuardInitialFocusProps } from '../../lib/hooks/useFocusFirstButton';
import ActionGuard from '../common/ActionGuard';
import IconButton from '../common/IconButton';

interface BookmarkletRegenerateButtonProps {
  /**
   * Called with the new raw token when the user confirms a regenerate. The
   * parent uses it to swap the `javascript:` URL embedded in the anchor.
   */
  onRegenerated: (rawToken: string) => void;
  /** Issues the actual API call. Injected so the section owns the fetch. */
  regenerate: () => Promise<{ rawToken: string }>;
}

/**
 * Two-step confirm for regenerating the bookmarklet PAT. State, focus
 * management, escape behavior, and the failure-focus + announcement plumbing
 * all live in `ActionGuard`. This component only describes the trigger,
 * confirm row, and the API wiring.
 */
export default function BookmarkletRegenerateButton({
  onRegenerated,
  regenerate,
}: BookmarkletRegenerateButtonProps) {
  return (
    <ActionGuard
      className="space-y-2"
      errorFallback="Failed to regenerate bookmarklet"
      onConfirm={async () => {
        const fresh = await regenerate();
        onRegenerated(fresh.rawToken);
      }}
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
        <div className="flex items-center gap-2">
          {!confirming ? (
            <IconButton
              variant="danger"
              id={triggerId}
              aria-label="Regenerate bookmarklet token"
              onClick={openConfirm}
            >
              <i
                aria-hidden="true"
                className="fa-solid fa-rotate text-[0.7rem]"
              />
              Regenerate
            </IconButton>
          ) : (
            <div
              className="flex items-center gap-4 shrink-0"
              ref={confirmReference}
            >
              <span className="text-xs text-[var(--alert-text)]">Sure?</span>
              <div className="space-x-2">
                <IconButton
                  variant="danger-filled"
                  disabled={pending}
                  onClick={runConfirm}
                >
                  {pending ? 'Regenerating…' : 'Yes, regenerate'}
                </IconButton>
                <IconButton
                  {...actionGuardInitialFocusProps}
                  variant="ghost"
                  disabled={pending}
                  onClick={closeConfirm}
                >
                  Cancel
                </IconButton>
              </div>
            </div>
          )}
        </div>
      )}
    </ActionGuard>
  );
}
