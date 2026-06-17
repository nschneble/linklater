import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';

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
   * Focus-return hook (CONSTRAINT K2/§7): called after the panel collapses so
   * the caller can return focus to the toggle when focus was inside the panel
   * as it hides. Wave 5 (`RequestForm`) is the first consumer.
   */
  onAfterCollapse?: () => void;
  /** Forwarded to the toggle <button> so a caller can return focus to it. */
  toggleRef?: Ref<HTMLButtonElement>;
  /** Forwarded to the panel <div> so a caller can check focus containment. */
  panelRef?: Ref<HTMLDivElement>;
}

export default function Disclosure({
  header,
  children,
  defaultExpanded = false,
  onAfterCollapse,
  toggleRef,
  panelRef,
}: DisclosureProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const onAfterCollapseRef = useRef(onAfterCollapse);
  onAfterCollapseRef.current = onAfterCollapse;
  const wasExpandedRef = useRef(isExpanded);

  // Fire onAfterCollapse exactly once per expanded -> collapsed transition.
  // Running it from an effect (not inside the setState updater) keeps the
  // updater pure, so React StrictMode's double-invoke can't double-fire the
  // focus-return hook a later wave wires through here (CONSTRAINT K2).
  useEffect(() => {
    if (wasExpandedRef.current && !isExpanded) {
      onAfterCollapseRef.current?.();
    }
    wasExpandedRef.current = isExpanded;
  }, [isExpanded]);

  function handleToggle() {
    setIsExpanded((wasExpanded) => !wasExpanded);
  }

  return (
    <div>
      <button
        ref={toggleRef}
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
      <div
        ref={panelRef}
        id={panelId}
        hidden={!isExpanded}
        className="px-4 pb-4"
      >
        {children}
      </div>
    </div>
  );
}
