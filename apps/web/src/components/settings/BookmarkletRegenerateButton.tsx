import { getErrorMessage } from '../../lib/errors';
import { useFocusFirstButton } from '../../lib/hooks/useFocusFirstButton';
import { useTransientState } from '../../lib/hooks/useTransientState';
import Alert from '../common/Alert';
import IconButton from '../common/IconButton';
import { useEffect, useRef, useState } from 'react';

interface BookmarkletRegenerateButtonProps {
  /**
   * Called with the new raw token when the user confirms a regenerate. The
   * parent uses it to swap the `javascript:` URL embedded in the anchor.
   */
  onRegenerated: (rawToken: string) => void;
  /** Issues the actual API call. Injected so the section owns the fetch. */
  regenerate: () => Promise<{ rawToken: string }>;
}

const TRIGGER_ID = 'bookmarklet-regenerate-trigger';
const CONFIRM_ID = 'bookmarklet-regenerate-confirm';
const ERROR_ID = 'bookmarklet-regenerate-error';

/**
 * Two-step confirm for regenerating the bookmarklet PAT.
 *
 * Trigger toggles a "Sure? / Yes, regenerate / Cancel" row. Focus lands on
 * "Yes, regenerate" when the row opens and returns to the trigger when the
 * row closes (cancel, escape, or success) — `ApiTokenRow` does not return
 * focus today, this fixes that gap.
 *
 * The error alert receives focus on failure so the announcement is not
 * missed (the focused trigger button's own re-render is not reliably
 * re-announced by AT).
 */
export default function BookmarkletRegenerateButton({
  onRegenerated,
  regenerate,
}: BookmarkletRegenerateButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const confirmRowReference = useRef<HTMLDivElement>(null);

  useFocusFirstButton(confirmRowReference, confirming);

  // Return focus to the trigger whenever the confirm row closes (cancel or
  // post-success). Skip the initial false→false transition so we don't
  // steal focus on mount.
  const previouslyConfirming = useRef(confirming);
  useEffect(() => {
    if (previouslyConfirming.current && !confirming) {
      document.getElementById(TRIGGER_ID)?.focus();
    }
    previouslyConfirming.current = confirming;
  }, [confirming]);

  // Surface the alert by moving focus into it (the alert role alone is not
  // enough when an interactive element keeps focus).
  useEffect(() => {
    if (error) {
      document.getElementById(ERROR_ID)?.focus();
    }
  }, [error]);

  // Clear the announcement after 3s so a repeat regenerate re-announces.
  useTransientState(announcement, '', setAnnouncement, 3000);

  // Escape cancels the confirm row.
  useEffect(() => {
    if (!confirming) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirming(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirming]);

  const handleOpenConfirm = () => {
    setError(null);
    setConfirming(true);
  };

  const handleConfirm = async () => {
    setError(null);
    setRegenerating(true);
    try {
      const fresh = await regenerate();
      onRegenerated(fresh.rawToken);
      setConfirming(false);
      setAnnouncement(
        'Bookmarklet regenerated. The new token is now embedded in the Save to Linklater button above.',
      );
    } catch (caughtError: unknown) {
      setError(
        getErrorMessage(caughtError, 'Failed to regenerate bookmarklet'),
      );
      setConfirming(false);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <IconButton
          type="button"
          variant="danger"
          id={TRIGGER_ID}
          aria-label="Regenerate bookmarklet token"
          aria-controls={CONFIRM_ID}
          aria-expanded={confirming}
          hidden={confirming}
          onClick={handleOpenConfirm}
        >
          <i aria-hidden="true" className="fa-solid fa-rotate text-[0.7rem]" />
          Regenerate
        </IconButton>
        {confirming && (
          <div
            className="flex items-center gap-4 shrink-0"
            id={CONFIRM_ID}
            ref={confirmRowReference}
          >
            <span className="text-rose-700 [[data-mode='dark']_&]:text-rose-300 text-xs">
              Sure?
            </span>
            <div className="space-x-2">
              <IconButton
                type="button"
                variant="danger-filled"
                disabled={regenerating}
                onClick={() => void handleConfirm()}
              >
                {regenerating ? 'Regenerating…' : 'Yes, regenerate'}
              </IconButton>
              <IconButton
                type="button"
                variant="ghost"
                disabled={regenerating}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </IconButton>
            </div>
          </div>
        )}
      </div>
      {error && (
        <Alert id={ERROR_ID} tabIndex={-1} variant="error">
          {error}
        </Alert>
      )}
      {announcement && (
        <span className="sr-only" role="status">
          {announcement}
        </span>
      )}
    </div>
  );
}
