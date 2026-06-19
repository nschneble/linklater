import { buildCurlCommand } from '../../lib/apiDocs/buildCurlCommand';
import { useEffect, useRef, useState } from 'react';

/**
 * Static "Example request" block: a copy-ready `curl` command for the selected
 * endpoint. Rendered in BOTH auth states – it's reference material, not a live
 * test, so a logged-out (public) visitor sees it too. The command always shows
 * the `ltk_…` token placeholder, never a real token (see `buildCurlCommand`).
 *
 * The page section sets `select-none`, so the `<pre>` opts back into selection
 * with `select-text` for manual copying; the Copy button is the primary path.
 * The button's accessible name stays constant ("Copy cURL command") – the icon
 * swap (copy → check) is the sighted confirmation and a scoped polite
 * `role="status"` announces success to assistive tech. The status text clears
 * after a beat so a repeat copy is a genuine '' → message transition and
 * re-announces; both timers are cleared on unmount (this component unmounts on
 * every endpoint swap).
 */

interface CurlExampleProps {
  /** HTTP method, any case. */
  method: string;
  /** Full request URL including any `{param}` path template. */
  url: string;
  /** Pretty-printed JSON request body, or `null` for no body. */
  body: string | null;
}

/** How long the "copied" icon + the status announcement linger. */
const COPIED_RESET_MS = 1500;

export default function CurlExample({ method, url, body }: CurlExampleProps) {
  const command = buildCurlCommand({ method, url, body });
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');
  const iconTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(iconTimer.current);
      clearTimeout(statusTimer.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setStatus('Copied to clipboard.');
      clearTimeout(iconTimer.current);
      clearTimeout(statusTimer.current);
      iconTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
      // Clear the status so the NEXT copy re-announces ('' → message); a polite
      // region is silent when the text node doesn't change.
      statusTimer.current = setTimeout(() => setStatus(''), COPIED_RESET_MS);
    } catch {
      setStatus('Couldn’t copy. Select the command and copy it manually.');
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[var(--mount-text)] text-sm font-semibold">
          Example request
        </p>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy cURL command"
          className="group inline-flex items-center gap-1.5 px-2.5 py-1 text-[var(--mount-alt-text)] hover:text-[var(--mount-text)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] rounded-md cursor-pointer"
        >
          <i
            className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-xs`}
            aria-hidden="true"
          />
          Copy
        </button>
      </div>
      <pre className="max-h-80 overflow-auto px-3 py-2.5 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] text-[var(--mount-text)] text-xs leading-relaxed select-text rounded-lg">
        {command}
      </pre>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
