import { buildCurlCommand } from '../../lib/apiDocs/buildCurlCommand';
import CopyButton from '../common/CopyButton';
import { FOCUS_RING } from '../../lib/styles';
import { useEffect, useRef, useState } from 'react';

/**
 * Static "Example request (cURL)" block: a copy-ready `curl` command for the
 * selected endpoint. Rendered in BOTH auth states – it's reference material,
 * not a live test, so a logged-out (public) visitor sees it too. The command
 * always shows the `ltk_…` token placeholder, never a real token (see
 * `buildCurlCommand`). This is the Request tab's universal, auth-stable
 * reference content: no part of it is ever gated on being signed in.
 *
 * The `<pre>` matches the shared `CodeBlock` scroll contract: it is the scroll
 * container for a clipped command, so it carries `tabIndex={0}` plus the shared
 * focus ring (a keyboard user must be able to focus and scroll it, SC 2.1.1),
 * `role="group"` (a nameable, non-landmark role) and `aria-labelledby` pointing
 * at the visible label's id so its accessible name comes from on-screen text
 * (SC 2.5.3), never a hidden `aria-label`. The label is a plain `<p>`, NOT a
 * heading, so it stays out of H-key navigation. The page section sets
 * `select-none`, so the `<pre>` opts back into selection with `select-text`
 * for manual copying; the Copy button is the primary path.
 *
 * The button's accessible name stays constant ("Copy cURL command") – the
 * visible `children` is the shorter "Copy" and `label` overrides the spoken
 * name with the longer form (which must start with the visible text per WCAG
 * 2.5.3, mechanized in `CopyButton`). The icon
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
  /**
   * DOM id assigned to the visible label and referenced by the `<pre>`'s
   * `aria-labelledby`. The caller derives it from a stable root so it stays
   * disjoint from the tab/panel/response id namespaces.
   */
  labelId: string;
}

/** How long the "copied" icon + the status announcement linger. */
const COPIED_RESET_MS = 1500;

export default function CurlExample({
  method,
  url,
  body,
  labelId,
}: CurlExampleProps) {
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
        <p
          id={labelId}
          className="text-[var(--mount-text)] text-sm font-semibold"
        >
          Example request (cURL)
        </p>
        <CopyButton
          copied={copied}
          onCopy={handleCopy}
          label="Copy cURL command"
        >
          Copy
        </CopyButton>
      </div>
      <pre
        role="group"
        aria-labelledby={labelId}
        // SC 2.1.1: the <pre> is the scroll container for the clipped command,
        // so a keyboard user must be able to focus it to scroll. role="group"
        // is a deliberately non-interactive (non-landmark) nameable role.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={`max-h-80 overflow-auto px-3 py-2.5 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] text-[var(--mount-text)] text-xs leading-relaxed select-text ${FOCUS_RING} rounded-lg`}
      >
        {command}
      </pre>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
