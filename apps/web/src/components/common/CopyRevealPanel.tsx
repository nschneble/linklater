import { useTransientState } from '../../lib/hooks/useTransientState';
import IconButton from './IconButton';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface CopyRevealPanelProps {
  /** Bold lead sentence inside the role="status" paragraph. */
  headingText: string;
  /** Trailing explanation rendered after the bold lead. */
  bodyText: ReactNode;
  /**
   * One or more secret strings. Single item renders as <code>; multiple
   * items render as a <ul>/<li> grid. The renderer is internal.
   */
  secrets: string[];
  /**
   * aria-label applied to each rendered secret. Keeps screen readers from
   * blurting the value on mount; lets browse-mode users opt in.
   */
  secretAriaLabel: string;
  /** aria-label for the copy button. */
  copyButtonLabel: string;
  /** Message announced by the sibling polite live region after copy. */
  copiedAnnouncement: string;
  /**
   * When true, the panel container takes tabIndex={-1} + focus on mount and
   * wires aria-labelledby to the heading paragraph. Use for transient
   * post-action reveals where the panel itself is the new context.
   */
  focusOnMount?: boolean;
  /**
   * Controlled copy state. When omitted, the component owns state + the
   * clipboard write internally and runs its own ~1s reset timer via
   * `useTransientState`. When provided, the parent owns both — including
   * the obligation to flip `copied` back to `false` after the desired TTL
   * (e.g. `useApiTokens` runs its own `useTransientState(copied, false,
   * setCopied, 1000)` so revoking a token also clears the copied flag).
   * Without that parent-side reset, the icon cross-fade will stay in the
   * "copied" state indefinitely.
   */
  copied?: boolean;
  onCopy?: () => void | Promise<void>;
}

/**
 * Shared reveal panel for one-shot secrets (API tokens, MFA recovery codes).
 *
 * Renders a scoped `role="status"` heading (so the secret is not blurted on
 * mount), the secret(s) with a per-item aria-label, a copy button with a
 * `data-copied` icon cross-fade, and a sibling polite live region for the
 * copied announcement (a focused button's own label change is not reliably
 * re-announced — the sibling region is what makes the announcement land).
 */
export default function CopyRevealPanel({
  headingText,
  bodyText,
  secrets,
  secretAriaLabel,
  copyButtonLabel,
  copiedAnnouncement,
  focusOnMount = false,
  copied: controlledCopied,
  onCopy: controlledOnCopy,
}: CopyRevealPanelProps) {
  const headingId = useId();
  const panelReference = useRef<HTMLDivElement>(null);
  const [uncontrolledCopied, setUncontrolledCopied] = useState(false);

  const isControlled = controlledCopied !== undefined;
  const copied = isControlled ? controlledCopied : uncontrolledCopied;

  // 3000ms: long enough for the sibling polite-region announcement to
  // land + a deliberate glance-back after pasting, short enough that the
  // icon never feels stuck. The pill is a confirmation dwell, not a
  // response-latency affordance, so Nielsen's 1.0s "flow uninterrupted"
  // budget does not apply here.
  useTransientState(
    isControlled ? false : uncontrolledCopied,
    false,
    setUncontrolledCopied,
    3000,
  );

  useEffect(() => {
    if (focusOnMount) {
      panelReference.current?.focus();
    }
  }, [focusOnMount]);

  const handleUncontrolledCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(secrets.join('\n'));
      setUncontrolledCopied(true);
    } catch {
      // clipboard access denied — user can select/copy manually
    }
  }, [secrets]);

  const handleCopy = isControlled ? controlledOnCopy : handleUncontrolledCopy;

  const containerProps = focusOnMount
    ? {
        ref: panelReference,
        tabIndex: -1,
        'aria-labelledby': headingId,
        className:
          'space-y-4 -mx-6 my-6 p-6 pb-2 border-y border-[var(--mount-border)] border-dotted focus:outline-none',
      }
    : {
        className:
          'space-y-4 -mx-6 my-6 p-6 pb-2 border-y border-[var(--mount-border)] border-dotted',
      };

  const isSingle = secrets.length === 1;

  return (
    <div {...containerProps}>
      <p
        id={headingId}
        className="mb-3 text-[var(--mount-alt-text)] text-xs"
        role="status"
      >
        <span className="text-[var(--mount-text)] font-semibold">
          {headingText}
        </span>{' '}
        {bodyText}
      </p>
      {isSingle ? (
        <div className="flex flex-col items-start gap-4">
          <code
            aria-label={secretAriaLabel}
            className="w-full block px-3 py-2 bg-[var(--orbit-bg)] border border-[var(--orbit-border)] text-[var(--orbit-text)] text-xs font-mono rounded select-all"
          >
            {secrets[0]}
          </code>
          <CopyButton
            label={copyButtonLabel}
            copied={copied}
            onCopy={handleCopy}
          />
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2">
            {secrets.map((secret) => (
              <li
                key={secret}
                aria-label={secretAriaLabel}
                className="px-3 py-1.5 bg-[var(--orbit-bg)] border-shadow text-[var(--orbit-text)] text-xs font-mono rounded break-all"
              >
                {secret}
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-start gap-4">
            <CopyButton
              label={copyButtonLabel}
              copied={copied}
              onCopy={handleCopy}
            />
          </div>
        </>
      )}
      <span className="sr-only" role="status">
        {copied ? copiedAnnouncement : ''}
      </span>
    </div>
  );
}

interface CopyButtonProps {
  label: string;
  copied: boolean;
  onCopy?: () => void | Promise<void>;
}

function CopyButton({ label, copied, onCopy }: CopyButtonProps) {
  return (
    <IconButton
      className="group"
      surface="mount"
      data-copied={copied ? 'true' : undefined}
      aria-label={label}
      onClick={() => void onCopy?.()}
    >
      {/*
       * Both icons share a single grid cell so they stack without layout
       * shift and can scale/blur independently. `aria-hidden` on the wrapper
       * keeps AT off the visual stack — the button's `aria-label` is the
       * single source of truth for the name.
       */}
      <span aria-hidden="true" className="inline-grid place-items-center">
        <span className="col-start-1 row-start-1 opacity-0 blur-xs scale-[0.25] group-data-[copied]:opacity-100 group-data-[copied]:blur-none group-data-[copied]:scale-100 transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
          <i className="fa-solid fa-check text-[0.7rem]" />
        </span>
        <span className="col-start-1 row-start-1 opacity-100 blur-none scale-100 group-data-[copied]:opacity-0 group-data-[copied]:blur-xs group-data-[copied]:scale-[0.25] transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
          <i className="fa-solid fa-copy text-[0.7rem]" />
        </span>
      </span>
      Copy to clipboard
    </IconButton>
  );
}
