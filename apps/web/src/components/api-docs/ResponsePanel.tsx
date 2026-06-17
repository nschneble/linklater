import {
  BORDER,
  ERROR_ACCENT,
  ERROR_TEXT,
  SUCCESS_ACCENT,
  SUCCESS_TEXT,
  TEXT,
} from '../../lib/apiDocs/apiDocsColors';

/**
 * Visible result of a "try it out" request: a status line (icon + text + color,
 * each redundant so it survives grayscale — CONSTRAINT §5/1.4.1) plus the
 * formatted JSON body in a `<pre>`. Wrapped in a `<section aria-label="Response">`.
 *
 * This panel is purely visual: it carries NO live-region role. The single
 * announcer is the persistent sr-only `role="status"` node owned by
 * `RequestForm` (CONSTRAINT §5) — wrapping the `<pre>` in a second live region
 * would double-announce. Focus is never moved here (announce-only).
 *
 * Brand-locked literals (CONSTRAINT §9): 2xx success uses light green text with
 * a mid-green icon; non-2xx / transport failures use light red text with a
 * mid-red icon. Both light text hexes clear SC 1.4.3 on the chrome.
 */

interface ResponsePanelProps {
  /** True for a 2xx HTTP status; drives success vs error coloring + icon. */
  ok: boolean;
  /** Short status line, e.g. `200 OK` or `Could not reach https://…`. */
  statusLine: string;
  /** Formatted response body to show in the `<pre>`. */
  body: string;
}

export default function ResponsePanel({
  ok,
  statusLine,
  body,
}: ResponsePanelProps) {
  const textColor = ok ? SUCCESS_TEXT : ERROR_TEXT;
  const iconColor = ok ? SUCCESS_ACCENT : ERROR_ACCENT;
  const iconClass = ok ? 'fa-circle-check' : 'fa-circle-exclamation';

  return (
    <section aria-label="Response" className="mt-4">
      <p
        className="flex items-center gap-2 text-sm font-semibold"
        style={{ color: textColor }}
      >
        <i
          className={`fa-solid ${iconClass} text-sm`}
          aria-hidden="true"
          style={{ color: iconColor }}
        />
        {statusLine}
      </p>
      <pre
        className="mt-2 max-h-80 overflow-auto px-3 py-2 border text-xs rounded-lg"
        style={{ color: TEXT, borderColor: BORDER }}
      >
        {body}
      </pre>
    </section>
  );
}
