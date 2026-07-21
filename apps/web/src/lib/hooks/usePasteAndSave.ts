import { looksLikeUrl } from '../looksLikeUrl';
import { useCallback, useRef, useState } from 'react';
import type { ToastVariant } from '../../components/common/Toast';

interface UsePasteAndSaveOptions {
  /** Saves a URL string via the existing direct-save path (`createLink`). */
  onDirectSave: (url: string) => Promise<void>;
  /** Shows a toast with the given variant (defaults to success upstream). */
  showToast: (message: string, variant?: ToastVariant) => void;
}

export interface UsePasteAndSaveResult {
  /**
   * Reads the clipboard and, if it holds a URL, saves it. Non-URL or empty
   * clipboard shows a warning toast; a rejected read shows an error toast.
   * Never throws.
   */
  handlePasteAndSave: () => Promise<void>;
  /** `true` while a paste-triggered save is in flight. */
  pasting: boolean;
}

/**
 * Backs the visible "Paste & save" button. Reads the clipboard on a user
 * gesture, pre-checks the text with `looksLikeUrl`, and reuses the existing
 * `handleDirectSave` path so a pasted URL lands in the unread list exactly
 * like a Cmd+V paste.
 *
 * @param options.onDirectSave - The direct-save handler from `useCreateLink`.
 * @param options.showToast - The toast opener, used for the warning/error cases.
 */
export function usePasteAndSave({
  onDirectSave,
  showToast,
}: UsePasteAndSaveOptions): UsePasteAndSaveResult {
  const [pasting, setPasting] = useState(false);
  // A ref backs the guard because two clicks in the same tick would both read
  // the same (stale) `pasting` state value; the ref updates synchronously.
  const pastingReference = useRef(false);

  const handlePasteAndSave = useCallback(async () => {
    // aria-disabled does not block clicks, so this guard enforces single-submit.
    if (pastingReference.current) return;
    pastingReference.current = true;
    setPasting(true);

    try {
      // readText() must be the very first async step. WebKit spends the
      // button's transient activation on the first await, so awaiting
      // anything before this would make the read reject.
      let text: string;
      try {
        text = await navigator.clipboard.readText();
      } catch {
        showToast("Couldn't read clipboard", 'error');
        return;
      }

      const url = text.trim();
      if (!looksLikeUrl(url)) {
        showToast('No link in clipboard', 'warning');
        return;
      }

      await onDirectSave(url);
    } finally {
      pastingReference.current = false;
      setPasting(false);
    }
  }, [onDirectSave, showToast]);

  return { handlePasteAndSave, pasting };
}
