import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Reusable disclosure (CONSTRAINT R1/E1). A <button aria-expanded aria-controls>
 * toggles a panel; the collapsed panel is TRULY hidden via the `hidden`
 * attribute so its contents leave both the tab order and the AT tree
 * (CONSTRAINT E2). Built on a button rather than <details>/<summary> because
 * later waves embed interactive forms inside the panel (CONSTRAINT E1).
 *
 * The toggle keeps keyboard focus on itself after expand/collapse — this is a
 * non-modal disclosure, so focus is never moved programmatically (CONSTRAINT
 * K2). Enter/Space toggle for free since the toggle is a native <button>.
 *
 * `onAfterCollapse` is the focus-return hook later form waves will use to move
 * focus before the panel hides; it is defined now but NOT exercised this wave.
 */

interface DisclosureProps {
  /**
   * Toggle content (e.g. an <h3> + method badge). Becomes the toggle's
   * accessible name, so it must name the endpoint (CONSTRAINT E2).
   */
  header: ReactNode;
  /** Panel content, revealed when expanded. */
  children: ReactNode;
  /** Whether the panel starts expanded. Defaults to collapsed. */
  defaultExpanded?: boolean;
  /**
   * Focus-return hook (CONSTRAINT K2, off this wave): called after the panel
   * collapses so a later wave can return focus before contents leave the tree.
   * Unused while panels are read-only.
   */
  onAfterCollapse?: () => void;
}

export default function Disclosure({
  header,
  children,
  defaultExpanded = false,
  onAfterCollapse,
}: DisclosureProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const onAfterCollapseRef = useRef(onAfterCollapse);
  onAfterCollapseRef.current = onAfterCollapse;

  function handleToggle() {
    setIsExpanded((wasExpanded) => {
      const nextExpanded = !wasExpanded;
      if (!nextExpanded) onAfterCollapseRef.current?.();
      return nextExpanded;
    });
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={handleToggle}
        className="group flex items-center justify-between gap-3 w-full px-4 py-3 text-left text-dazed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dazed cursor-pointer"
      >
        {header}
        <i
          aria-hidden="true"
          className="fa-solid fa-chevron-down text-sm group-aria-expanded:-rotate-180 transition-transform motion-reduce:transition-none"
        />
      </button>
      <div id={panelId} hidden={!isExpanded} className="px-4 pb-4">
        {children}
      </div>
    </div>
  );
}
