import IconButton from '../common/IconButton';
import { useEffect, useState } from 'react';

interface BookmarkletCopyButtonProps {
  /** The `javascript:` URL to write to the clipboard. */
  code: string | null;
  /** Disables the button while the parent is still fetching the token. */
  disabled?: boolean;
}

/**
 * "Copy bookmarklet code" button — required alternative to drag-and-drop for
 * keyboard users (WCAG 2.5.7). Uses the same `data-copied` swap-icon pattern
 * as `ApiTokensSection`: check + copy icons share one grid cell, opacity +
 * blur + scale tween between them.
 */
export default function BookmarkletCopyButton({
  code,
  disabled,
}: BookmarkletCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeoutId = window.setTimeout(() => setCopied(false), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // clipboard access denied — user can drag the bookmarklet instead
    }
  };

  return (
    <>
      <IconButton
        aria-label="Copy bookmarklet code"
        className="group"
        data-copied={copied ? 'true' : undefined}
        disabled={disabled || !code}
        type="button"
        variant="default"
        onClick={() => void handleCopy()}
      >
        <span aria-hidden="true" className="inline-grid place-items-center">
          <span className="col-start-1 row-start-1 opacity-0 blur-xs scale-[0.25] group-data-[copied]:opacity-100 group-data-[copied]:blur-none group-data-[copied]:scale-100 transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
            <i className="fa-solid fa-check text-[0.7rem]" />
          </span>
          <span className="col-start-1 row-start-1 opacity-100 blur-none scale-100 group-data-[copied]:opacity-0 group-data-[copied]:blur-xs group-data-[copied]:scale-[0.25] transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
            <i className="fa-solid fa-copy text-[0.7rem]" />
          </span>
        </span>
        <span className="hidden sm:inline">Copy</span>
      </IconButton>
      <span className="sr-only" role="status">
        {copied ? 'Bookmarklet code copied to clipboard' : ''}
      </span>
    </>
  );
}
