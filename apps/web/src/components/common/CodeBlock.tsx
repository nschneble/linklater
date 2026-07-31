import { FOCUS_RING } from '../../lib/styles';

/**
 * Static, labelled JSON code block: a visible `<p>` label paired with a
 * scrollable `<pre><code>` on the mount-bundle input chrome.
 *
 * The `<pre>` is the scroll container, so it carries `tabIndex={0}` plus the
 * shared focus ring: a keyboard user must be able to focus and scroll a
 * clipped block (SC 2.1.1). It takes `role="group"` (NOT `role="region"` – a
 * region would add a landmark and clutter landmark nav) so the focus stop has
 * a nameable role, and `aria-labelledby` points at the visible label's id so
 * the accessible name is sourced from on-screen text (SC 2.5.3), never a
 * hidden `aria-label`. The label is a plain `<p>`, NOT a heading, so it stays
 * out of H-key navigation and never competes with the surrounding endpoint
 * `<h3>`.
 *
 * Generic by design – the caller supplies both the wording (`label`) and the
 * label's id (`labelId`), so the same block serves an example request body,
 * an example response body, or any other read-only JSON without carrying
 * request-specific copy inside.
 */

interface CodeBlockProps {
  /** Visible, human-readable label shown above the block (e.g. "Example request body"). */
  label: string;
  /** The code/JSON string rendered verbatim inside the `<pre><code>`. */
  code: string;
  /**
   * DOM id assigned to the visible label and referenced by the `<pre>`'s
   * `aria-labelledby`. Must be unique on the page; the caller derives it from
   * a stable root so it stays disjoint from tab/panel id namespaces.
   */
  labelId: string;
}

export default function CodeBlock({ label, code, labelId }: CodeBlockProps) {
  return (
    <>
      <p
        id={labelId}
        className="mb-2 text-[var(--mount-text)] text-sm font-semibold"
      >
        {label}
      </p>
      <pre
        role="group"
        aria-labelledby={labelId}
        // SC 2.1.1: focusable scroll stop; role="group" = non-landmark nameable
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={`overflow-x-auto px-3 py-2.5 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] text-[var(--mount-text)] text-xs leading-relaxed select-text ${FOCUS_RING} rounded-lg`}
      >
        <code>{code}</code>
      </pre>
    </>
  );
}
