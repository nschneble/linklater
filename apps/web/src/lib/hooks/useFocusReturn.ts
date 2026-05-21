import { useEffect, useRef } from 'react';

/**
 * Restores focus to whatever element was active before a transient UI region
 * opens. Captures `document.activeElement` whenever `isOpen` flips to `true`
 * and re-focuses it when the effect tears down (region closes or unmounts).
 *
 * Components that are conditionally mounted (modals rendered via
 * `{isOpen && <Modal />}`) can pass `true` and the capture-then-restore
 * lifecycle still works correctly. Components where the trigger and the
 * region share a parent (like `LinksView` and its inline form) should pass
 * the open boolean so capture lines up with the user gesture that opened
 * the region.
 *
 * @param isOpen - When `true`, captures the active element and arms restoration.
 */
export function useFocusReturn(isOpen: boolean): void {
  const triggerReference = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    triggerReference.current = document.activeElement;
    return () => {
      (triggerReference.current as HTMLElement | null)?.focus();
    };
  }, [isOpen]);
}
