import { useEffect, type RefObject } from 'react';

interface UseMenuNavigationOptions {
  /** CSS selector for focusable menu items. */
  itemSelector?: string;
  /** When provided, called on ArrowLeft (used by submenus to return focus to their trigger). */
  onArrowLeft?: () => void;
  /**
   * Tab key behavior.
   * - `'close'` (default): Tab calls `onClose` so focus moves naturally to
   *   the next page-level element. Correct for non-modal `role="menu"`
   *   dropdowns (e.g. the desktop UserMenu).
   * - `'trap'`: Tab cycles focus between menu items inside the container
   *   and never leaves. Correct for `role="dialog" aria-modal="true"`
   *   surfaces (e.g. the mobile bottom sheet) where letting focus escape
   *   to an inert subtree would land on `<body>`.
   */
  tabBehavior?: 'close' | 'trap';
  /**
   * Called instead of `onClose` when Tab closes the menu (`'close'` mode).
   * Defaults to `onClose` when omitted. Lets a caller close the menu on Tab
   * WITHOUT the focus-management side effects it wants on Escape: Escape
   * should return focus to the trigger, but Tab must let the browser's native
   * focus-advance land on the next page element rather than snapping back to
   * the trigger (SC 2.4.3).
   */
  onTabClose?: () => void;
}

/**
 * Adds ARIA-compliant keyboard navigation to a `role="menu"` (or
 * modal-dialog) container.
 *
 * Behavior:
 * - **Arrow Down / Arrow Up**: moves focus between all `[role="menuitem"]`
 *   elements within the container, wrapping at the ends.
 * - **Escape**: calls `onClose` to close the menu.
 * - **Tab**: see `tabBehavior` option.
 * - **Arrow Left** (when `onArrowLeft` is provided): calls `onArrowLeft`.
 * - **Arrow Right** (when `onArrowLeft` is provided): swallowed so it
 *   cannot leak to page-level navigation handlers.
 *
 * The handler is attached directly to the container element (not `document`)
 * so it only fires when focus is inside the menu.
 *
 * @param containerReference - Ref to the container element.
 * @param onClose - Called when Escape is pressed, or on Tab in `'close'` mode
 *   when `onTabClose` is not provided.
 * @param options - See `UseMenuNavigationOptions`.
 *
 * @sideEffects
 * Attaches a `keydown` listener to the container element. Cleaned up on
 * unmount or when `containerReference`/`onClose` change.
 */
export function useMenuNavigation(
  containerReference: RefObject<HTMLElement | null>,
  onClose: () => void,
  options: UseMenuNavigationOptions = {},
) {
  const {
    itemSelector = '[role="menuitem"],[role="menuitemradio"]',
    onArrowLeft,
    tabBehavior = 'close',
    onTabClose,
  } = options;

  useEffect(() => {
    const container = containerReference.current;
    if (!container) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft' && onArrowLeft) {
        event.preventDefault();
        event.stopPropagation();
        onArrowLeft();
        return;
      }

      if (event.key === 'ArrowRight' && onArrowLeft !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Escape' &&
        event.key !== 'Tab'
      ) {
        return;
      }

      if (event.key === 'Escape') {
        // stopPropagation so an outer menu doesn't also close on this Escape
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        if (tabBehavior === 'close') {
          // onTabClose omits refocus-the-trigger so native Tab target is preserved
          (onTabClose ?? onClose)();
          return;
        }

        // trap: cycle focus inside so Tab doesn't escape to the inert body
        const items = Array.from(
          container!.querySelectorAll<HTMLElement>(itemSelector),
        ).filter((item) => !item.closest('[inert]'));
        if (items.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const currentIndex = items.indexOf(
          document.activeElement as HTMLElement,
        );
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex =
          currentIndex === -1
            ? direction === 1
              ? 0
              : items.length - 1
            : (currentIndex + direction + items.length) % items.length;
        items[nextIndex]?.focus();
        return;
      }

      const items = Array.from(
        container!.querySelectorAll<HTMLElement>(itemSelector),
      ).filter((item) => !item.closest('[inert]'));
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      event.preventDefault();
      event.stopPropagation();
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
  }, [
    containerReference,
    onClose,
    itemSelector,
    onArrowLeft,
    tabBehavior,
    onTabClose,
  ]);
}
