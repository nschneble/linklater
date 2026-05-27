import { useFocusReturn } from '../../lib/hooks/useFocusReturn';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';
import { useTransientState } from '../../lib/hooks/useTransientState';
import { FOCUS_RING } from '../../lib/styles';
import PrimaryButton from '../common/PrimaryButton';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Full-screen modal that displays one-time recovery codes immediately
 * after 2FA is enabled. The only dismiss path is the "I've saved these
 * codes" button — there is deliberately no close/cancel action, because
 * the codes must be recorded before the user leaves this screen.
 *
 * Focus is trapped inside the dialog while it is open and restored to
 * the triggering element on close.
 */
interface RecoveryCodesModalProps {
  /** The list of plaintext recovery codes to display and offer for copy. */
  codes: string[];
  /**
   * Called when the user confirms they have saved their codes. The
   * parent is responsible for unmounting this modal on invocation.
   * Also handles Escape key presses, treating them as confirmation
   * since the codes are shown — not cancelled.
   */
  onConfirm: () => void;
}

export default function RecoveryCodesModal({
  codes,
  onConfirm,
}: RecoveryCodesModalProps) {
  const [copied, setCopied] = useState(false);
  const dialogReference = useRef<HTMLDivElement>(null);

  useFocusReturn(true);
  useTransientState(copied, false, setCopied, 2000);

  // Focus the dialog panel on mount.
  useEffect(() => {
    dialogReference.current?.focus();
  }, []);

  useFocusTrap(dialogReference, { onEscape: onConfirm });

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
  }, [codes]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-md mx-4 p-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-codes-title"
        ref={dialogReference}
        tabIndex={-1}
      >
        <h3
          id="recovery-codes-title"
          className="text-[var(--text)] text-lg font-semibold"
        >
          Save your recovery codes
        </h3>
        <p className="text-[var(--text-muted)] text-sm">
          Store these codes somewhere safe. Each can be used once to access your
          account if you lose your 2FA device.
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {codes.map((code) => (
            <li
              key={code}
              className="px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded"
            >
              {code}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={`flex items-center gap-1.5 text-[var(--text-muted)] text-xs hover:text-[var(--text)] transition rounded ${FOCUS_RING}`}
        >
          <i
            className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-[0.65rem]`}
            aria-hidden="true"
          />
          {copied ? 'Copied!' : 'Copy all codes'}
        </button>
        <PrimaryButton className="w-full py-2.5" onClick={onConfirm}>
          I&apos;ve saved these codes
        </PrimaryButton>
      </div>
    </div>
  );
}
