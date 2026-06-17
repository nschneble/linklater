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
 * Status color SOURCE is the state bundles (Wave 6, §4): a 2xx response wraps
 * the region in the `success` bundle surface (`--success-bg` / `--success-text`
 * with a `--success-highlight` icon accent); a non-2xx / transport failure
 * wraps it in the `alert` bundle surface. This reuses the proven "state-text on
 * own-bg" + "state-text on base-bg" contracts already mechanized in
 * `bundles.contrast.test.ts`, so no new contrast test is needed. The
 * icon + text + color redundancy is preserved (1.4.1) — only the color source
 * changed from brand literals to bundle tokens.
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
  // `ok` is plain JS state (not a DOM attribute), so a ternary picking the
  // bundle-surface class set is the correct tool here per the project's
  // state-driven-styling rule.
  const surfaceClass = ok
    ? 'bg-[var(--success-bg)] text-[var(--success-text)]'
    : 'bg-[var(--alert-bg)] text-[var(--alert-text)]';
  const iconClass = ok ? 'fa-circle-check' : 'fa-circle-exclamation';
  const iconColorClass = ok
    ? 'text-[var(--success-highlight)]'
    : 'text-[var(--alert-highlight)]';

  return (
    <section
      aria-label="Response"
      className={`mt-4 p-3 ${surfaceClass} rounded-lg`}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <i
          className={`fa-solid ${iconClass} ${iconColorClass} text-sm`}
          aria-hidden="true"
        />
        {statusLine}
      </p>
      {/*
       * The `<pre>` delimiter border consumes `--mount-border` (a soft
       * decorative edge, not a sole boundary conveying meaning — the tinted
       * state-bundle fill already separates the region). Keeping `--mount-border`
       * preserves the brand output byte-for-byte (today's #7d6ec0).
       */}
      <pre className="mt-2 max-h-80 overflow-auto px-3 py-2 border border-[var(--mount-border)] text-xs rounded-lg">
        {body}
      </pre>
    </section>
  );
}
