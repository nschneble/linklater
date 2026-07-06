import { FOCUS_RING } from '../../lib/styles';
import type { ReactNode } from 'react';

/**
 * The tabpanel half of a top-level endpoint section (Request / Response / Try
 * It). A behaviour-neutral extraction of the three formerly-repeated
 * `<div role="tabpanel">` blocks in `EndpointDetail`, giving every section a
 * single place to keep its ARIA + focus semantics consistent.
 *
 * Renders EXACTLY ONE element – the tabpanel `<div>` – with no wrapping node,
 * because the panels must stay direct SIBLINGS of the `SlidingTabBar`: an
 * extra container between the bar and the panels would let the top-level
 * `useTabNavigation` capture the inner Response sub-tablist. Inactive panels
 * stay MOUNTED and merely `hidden` (a real HTML boolean attribute, never a
 * `className` or style), so typed "try it out" state, the response sub-tab
 * selection, and any in-flight request survive a tab round-trip.
 *
 * Focusability is driven off a SINGLE fact – `hasFocusableContent`, computed
 * by the parent per panel, never introspected here – so the `tabIndex` and
 * the focus ring can't drift apart: a panel that owns a focusable descendant
 * drops its own tab stop and ring; a read-only panel becomes the focus stop
 * itself (`tabIndex={0}` + ring) so a keyboard user can still reach and scroll
 * it. Presence (whether the panel exists at all) is the caller's concern and
 * stays SEPARATE from visibility (`active`), so the tab set never shifts under
 * auth (SC 3.2.3).
 */

interface SectionPanelProps {
  /** The panel's DOM id (must match the controlling tab's `aria-controls`). */
  id: string;
  /** Id of the tab that labels this panel (its `aria-labelledby` target). */
  labelledById: string;
  /** Whether this is the currently-selected panel; drives `hidden`. */
  active: boolean;
  /**
   * Whether the panel contains its OWN focusable descendant. When true the
   * panel drops its tab stop + ring; when false (default) the panel itself
   * becomes the keyboard-reachable focus stop.
   */
  hasFocusableContent?: boolean;
  /** Extra classes merged after the (conditional) focus ring. */
  className?: string;
  children: ReactNode;
}

export default function SectionPanel({
  id,
  labelledById,
  active,
  hasFocusableContent = false,
  className,
  children,
}: SectionPanelProps) {
  const classes = [hasFocusableContent ? undefined : FOCUS_RING, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={labelledById}
      hidden={!active}
      tabIndex={hasFocusableContent ? undefined : 0}
      className={classes || undefined}
    >
      {children}
    </div>
  );
}
