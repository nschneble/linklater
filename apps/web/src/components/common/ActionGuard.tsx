import { getErrorMessage } from '../../lib/errors';
import { useFocusFirstButton } from '../../lib/hooks/useFocusFirstButton';
import { useTransientState } from '../../lib/hooks/useTransientState';
import Alert from './Alert';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

/**
 * Render-prop helpers passed to ActionGuard's child function.
 */
export interface ActionGuardRenderHelpers {
  /** `true` when the confirmation row should be visible (trigger swapped out). */
  confirming: boolean;
  /** `true` while `onConfirm` is running. Use to disable buttons + flip labels. */
  pending: boolean;
  /**
   * Stable id to spread onto the trigger element so focus can be returned
   * after the confirm row closes (cancel / escape / success).
   */
  triggerId: string;
  /**
   * Attach to the element that contains the confirm-row buttons. **Required**
   * for the "focus the first button on open" behavior to work.
   */
  confirmReference: RefObject<HTMLDivElement | null>;
  /** Wire to the trigger button's `onClick`. */
  openConfirm: () => void;
  /** Wire to the Cancel button's `onClick`. */
  closeConfirm: () => void;
  /** Wire to the Yes button's `onClick`. Kicks off `onConfirm`. */
  runConfirm: () => void;
}

interface ActionGuardProps {
  /** Renders the trigger button or confirm row based on `confirming`. */
  children: (helpers: ActionGuardRenderHelpers) => ReactNode;
  /** The actual destructive action. Errors caught + shown in the Alert. */
  onConfirm: () => Promise<void>;
  /** Fallback message when the caught error has no usable message. */
  errorFallback: string;
  /**
   * When set, announced via a polite sr-only live region on success and
   * cleared after 5s so a repeat action re-announces.
   */
  successAnnouncement?: string;
  /** Outer wrapper class – e.g. `'space-y-2'` or `'space-y-3'`. */
  className?: string;
  /** Where the Alert renders relative to children. Defaults to `'after'`. */
  alertSlot?: 'before' | 'after';
}

/**
 * Two-step confirmation primitive shared by Settings' guarded actions
 * (Delete account, Revoke PAT, Regenerate bookmarklet).
 *
 * Owns: confirming/pending/error/announcement state, focus management,
 * Escape-to-cancel, focus-into-alert on failure, focus-return-to-trigger
 * on close, and an always-mounted polite live region.
 *
 * Callers own: the trigger button JSX, the confirm row JSX (prompt text,
 * button labels, per-instance aria-labels), and the outer layout. They
 * wire the supplied helpers into their own markup via render-prop.
 *
 * Effects intentionally read `error` from state (not a ref) so the
 * return-focus path reliably skips when an error landed in the same commit,
 * letting the focus-the-alert effect win deterministically.
 */
export default function ActionGuard({
  children,
  onConfirm,
  errorFallback,
  successAnnouncement,
  className,
  alertSlot = 'after',
}: ActionGuardProps) {
  const triggerId = useId();
  const errorId = useId();

  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const confirmReference = useRef<HTMLDivElement>(null);

  useFocusFirstButton(confirmReference, confirming);

  // dev-only: rAF-defer so the ref has attached, then warn if it's still null
  useEffect(() => {
    if (!confirming) return;
    if (!import.meta.env.DEV) return;
    const handle = requestAnimationFrame(() => {
      if (!confirmReference.current) {
        console.warn(
          '[ActionGuard] confirming flipped to true but confirmReference is null. ' +
            'Attach helpers.confirmReference to your confirm-row container so focus management works.',
        );
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [confirming]);

  // return focus to the trigger when the row closes without an error
  const previouslyConfirming = useRef(confirming);
  useEffect(() => {
    if (previouslyConfirming.current && !confirming && !error) {
      document.getElementById(triggerId)?.focus();
    }
    previouslyConfirming.current = confirming;
  }, [confirming, error, triggerId]);

  // focus the alert; role=alert alone is unreliable if a sibling has focus
  useEffect(() => {
    if (error) {
      document.getElementById(errorId)?.focus();
    }
  }, [error, errorId]);

  // clear after 5s so repeats re-announce; unmount would drop the first
  useTransientState(announcement, '', setAnnouncement, 5000);

  // document-level Escape backs out regardless of where focus is
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

  const openConfirm = useCallback(() => {
    setError(null);
    setAnnouncement('');
    setConfirming(true);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirming(false);
  }, []);

  const runConfirm = useCallback(() => {
    void (async () => {
      setError(null);
      setPending(true);
      try {
        await onConfirm();
        setConfirming(false);
        if (successAnnouncement) {
          setAnnouncement(successAnnouncement);
        }
      } catch (caughtError: unknown) {
        setError(getErrorMessage(caughtError, errorFallback));
        setConfirming(false);
      } finally {
        setPending(false);
      }
    })();
  }, [errorFallback, onConfirm, successAnnouncement]);

  const alertElement = error ? (
    <Alert id={errorId} tabIndex={-1} variant="error">
      {error}
    </Alert>
  ) : null;

  // absolute sr-only region in one root won't disturb parent space-y-* spacing
  return (
    <div className={className}>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {alertSlot === 'before' && alertElement}
      {children({
        confirming,
        pending,
        triggerId,
        confirmReference,
        openConfirm,
        closeConfirm,
        runConfirm,
      })}
      {alertSlot === 'after' && alertElement}
    </div>
  );
}
