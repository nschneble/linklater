import { useEffect, type RefObject } from 'react';

/**
 * Adds ARIA-compliant keyboard navigation to a `role="menu"` container.
 *
 * Behavior:
 * - **Arrow Down / Arrow Up**: moves focus between all `[role="menuitem"]`
 *   elements within the container, wrapping at the ends.
 * - **Escape**: calls `onClose` to close the menu.
 * - **Tab**: calls `onClose` so focus can move naturally to the next element
 *   in the page's tab order (the menu does not trap Tab).
 *
 * The handler is attached directly to the container element (not `document`)
 * so it only fires when focus is inside the menu.
 *
 * @param containerReference - Ref to the `role="menu"` element.
 * @param onClose - Called when Escape or Tab is pressed.
 *
 * @sideEffects
 * Attaches a `keydown` listener to the container element. Cleaned up on
 * unmount or when `containerReference`/`onClose` change.
 */
export function useMenuNavigation(
  containerReference: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const container = containerReference.current;
    if (!container) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Escape' &&
        event.key !== 'Tab'
      ) {
        return;
      }

      if (event.key === 'Escape') {
        onClose();
        return;
      }

      // Tab closes the menu and lets focus move naturally to the next element
      if (event.key === 'Tab') {
        onClose();
        return;
      }

      const items = Array.from(
        container!.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      );
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : items.length - 1
          : (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerReference, onClose]);
}
