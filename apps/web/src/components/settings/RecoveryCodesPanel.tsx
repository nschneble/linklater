import IconButton from '../common/IconButton';
import PrimaryButton from '../common/PrimaryButton';
import { useTransientState } from '../../lib/hooks/useTransientState';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Inline reveal panel shown immediately after MFA enrollment or recovery-code
 * regeneration. Mirrors the visual + accessibility pattern of the API-token
 * reveal in `ApiTokensSection`: codes are displayed once, copyable in one
 * click, and dismissable only through an explicit "I've saved these codes"
 * confirmation.
 *
 * Not a dialog — the panel renders inline within the Security section so the
 * user can still scroll, read surrounding context, and copy individual codes.
 * Focus moves to the panel container on mount so an announcement of the
 * heading happens, then Tab moves naturally to copy → confirm.
 */
interface RecoveryCodesPanelProps {
  /** The list of plaintext recovery codes to display and offer for copy. */
  codes: string[];
  /**
   * Called when the user confirms they have saved their codes. The parent is
   * responsible for unmounting this panel on invocation and routing focus to
   * a sensible next target.
   */
  onConfirm: () => void;
}

export default function RecoveryCodesPanel({
  codes,
  onConfirm,
}: RecoveryCodesPanelProps) {
  const [copied, setCopied] = useState(false);
  const panelReference = useRef<HTMLDivElement>(null);

  useTransientState(copied, false, setCopied, 3000);

  // Move focus to the panel container so the heading announces on mount.
  // tabIndex={-1} makes the container programmatically focusable without
  // adding it to the tab order; aria-labelledby ties the focus event to
  // the heading text so AT reads "Your recovery codes have been generated…".
  useEffect(() => {
    panelReference.current?.focus();
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
    } catch {
      // clipboard access denied — user can select/copy manually
    }
  }, [codes]);

  return (
    <div
      ref={panelReference}
      tabIndex={-1}
      aria-labelledby="recovery-codes-heading"
      className="space-y-4 -mx-6 my-6 p-6 pb-2 border-y border-[var(--border)] border-dotted focus:outline-none"
    >
      {/*
       * `role="status"` is scoped to the heading paragraph only so the raw
       * codes below are not blurted out as soon as the panel mounts. The
       * codes themselves are reachable via browse-mode navigation; the
       * `aria-label` on each <li> further protects them from incidental
       * reading aloud (shoulder-surfing in shared spaces).
       */}
      <p
        id="recovery-codes-heading"
        className="mb-3 text-[var(--text-muted)] text-xs"
        role="status"
      >
        <span className="text-[var(--text)] font-semibold">
          Your recovery codes have been generated.
        </span>{' '}
        Each can be used once to access your account if you lose your MFA
        device. They'll only be shown here once, so make sure you copy them down
        before navigating away from this page!
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {codes.map((code) => (
          <li
            key={code}
            aria-label="Recovery code — navigate here to read it character by character"
            className="px-3 py-1.5 bg-[var(--bg-elevated)] border-shadow text-[var(--text)] text-xs font-mono rounded break-all"
          >
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-start gap-4">
        <IconButton
          className="group"
          type="button"
          variant="default"
          data-copied={copied ? 'true' : undefined}
          aria-label="Copy all recovery codes to clipboard"
          onClick={() => void handleCopy()}
        >
          {/*
           * Both icons share a single grid cell so they stack without layout
           * shift and each can scale/blur independently. `aria-hidden` on the
           * wrapper keeps AT off the visual stack — the button's `aria-label`
           * is the single source of truth for the name.
           */}
          <span aria-hidden="true" className="inline-grid place-items-center">
            <span className="col-start-1 row-start-1 opacity-0 blur-xs scale-[0.25] group-data-[copied]:opacity-100 group-data-[copied]:blur-none group-data-[copied]:scale-100 transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
              <i className="fa-solid fa-check text-[0.7rem]" />
            </span>
            <span className="col-start-1 row-start-1 opacity-100 blur-none scale-100 group-data-[copied]:opacity-0 group-data-[copied]:blur-xs group-data-[copied]:scale-[0.25] transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
              <i className="fa-solid fa-copy text-[0.7rem]" />
            </span>
          </span>
          Copy to Clipboard
        </IconButton>
        <PrimaryButton className="py-2.5" onClick={onConfirm}>
          <i className="fa-solid fa-check text-[0.7rem]" aria-hidden="true" />
          I've saved these codes
        </PrimaryButton>
      </div>
      {/*
       * Dedicated polite live region for the copy state change. Adding it
       * as a sibling lets AT announce "Recovery codes copied to clipboard"
       * even though the copy button keeps focus (a focused button's own
       * accessible-name change is not reliably re-announced).
       */}
      <span className="sr-only" role="status">
        {copied ? 'Recovery codes copied to clipboard' : ''}
      </span>
    </div>
  );
}
