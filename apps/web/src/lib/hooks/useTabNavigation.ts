import { useEffect, type RefObject } from 'react';

/**
 * Implements ARIA-compliant keyboard navigation for a tab list. Listens
 * within the container and moves focus to another `[role="tab"]` element,
 * activating it via a synthetic click so selection follows focus:
 *
 *   - `ArrowLeft` / `ArrowRight`: previous / next tab, wrapping around.
 *   - `Home` / `End`: first / last tab.
 *
 * This is required by WCAG 2.1 Success Criterion 4.1.2 for tab patterns.
 * The keys must move focus within the tab list rather than using Tab, which
 * should move focus outside the group entirely. `Home`/`End` are
 * APG-recommended; their `preventDefault` also stops the page from scrolling.
 *
 * @param containerReference - A ref pointing to the `[role="tablist"]` element.
 */
export function useTabNavigation(
  containerReference: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const container = containerReference.current;
    if (!container) return;

    function handleKeyDown(event: KeyboardEvent) {
      const tabs = Array.from(
        container!.querySelectorAll<HTMLElement>('[role="tab"]'),
      );

      const currentIndex = tabs.indexOf(document.activeElement as HTMLElement);
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (event.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerReference]);
}
