import { useEffect, type RefObject } from 'react';

/**
 * Implements ARIA-compliant keyboard navigation for a tab list.
 * Listens for `ArrowLeft` and `ArrowRight` within the container and moves
 * focus to the previous or next `[role="tab"]` element, wrapping around.
 *
 * This is required by WCAG 2.1 Success Criterion 4.1.2 for tab patterns:
 * the arrow keys must move focus within the tab list rather than using Tab,
 * which should move focus outside the group entirely.
 *
 * Side effects: adds and removes a `keydown` event listener on the container.
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
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      const tabs = Array.from(
        container!.querySelectorAll<HTMLElement>('[role="tab"]'),
      );
      const currentIndex = tabs.indexOf(document.activeElement as HTMLElement);
      if (currentIndex === -1) return;

      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerReference]);
}
