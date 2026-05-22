import type { RefObject } from 'react';
import { useEffect } from 'react';

export const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  onEscape?: () => void;
}

/**
 * Traps keyboard focus inside `reference`. Tab wraps forward to the first
 * focusable element; Shift+Tab wraps back to the last. If `onEscape` is
 * provided, pressing Escape calls it (with `preventDefault`).
 */
export function useFocusTrap(
  reference: RefObject<HTMLElement | null>,
  { onEscape }: UseFocusTrapOptions = {},
): void {
  useEffect(() => {
    const element = reference.current;
    if (!element) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable =
        element!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  }, [reference, onEscape]);
}
