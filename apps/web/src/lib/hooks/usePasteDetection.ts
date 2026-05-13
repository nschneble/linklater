import { useEffect, useRef } from 'react';

interface UsePasteDetectionOptions {
  /** When `false`, the paste listener is not attached. Defaults to `true`. */
  enabled?: boolean;
  /** Called with the pasted text when it looks like a URL. */
  onSave: (url: string) => void;
}

/**
 * Returns `true` when `text` looks like a URL. Used as a quick pre-check
 * before calling `onSave`. We don't fully validate the URL here because
 * `createLink` on the server will reject it if it turns out to be invalid.
 */
function looksLikeUrl(text: string): boolean {
  return text.startsWith('http://') || text.startsWith('https://');
}

/**
 * Listens for `paste` events on the `window` and calls `onSave` whenever
 * the pasted text looks like a URL and the target isn't a form field.
 *
 * This allows users to save links from anywhere on the page without
 * explicitly opening the link form. The listener is skipped when the paste
 * target is an `INPUT` or `TEXTAREA` so normal text editing is unaffected.
 *
 * @param options.enabled - Disable the listener (e.g. on the read tab).
 * @param options.onSave - Callback invoked with the URL string when a valid URL is pasted.
 */
export function usePasteDetection({
  enabled = true,
  onSave,
}: UsePasteDetectionOptions): void {
  // GOTCHA: onSave is stored in a ref so the effect closure always calls the
  // latest version without needing onSave in the dependency array. Including
  // onSave would re-run the effect — and remove/re-add the listener — every
  // time the links array changes, because onSave's identity is not stable.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!enabled) return;

    function handlePaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const text = (event.clipboardData?.getData('text') ?? '').trim();
      if (looksLikeUrl(text)) {
        onSaveRef.current(text);
      }
    }

    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [enabled]);
}
