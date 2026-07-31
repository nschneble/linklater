import { useCallback, useEffect, useRef } from 'react';

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
 * The returned `skipRestore` lets the consumer suppress restoration for the
 * upcoming unmount; useful when the consumer is about to navigate away or
 * intentionally move focus elsewhere, where restoring focus to the trigger
 * would either fail (trigger unmounted) or be disorienting.
 *
 * @param isOpen - When `true`, captures the active element and arms restoration.
 */
export function useFocusReturn(isOpen: boolean): { skipRestore: () => void } {
  const triggerReference = useRef<Element | null>(null);
  const skipReference = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    triggerReference.current = document.activeElement;
    skipReference.current = false;
    return () => {
      if (skipReference.current) return;
      (triggerReference.current as HTMLElement | null)?.focus();
    };
  }, [isOpen]);

  const skipRestore = useCallback(() => {
    skipReference.current = true;
  }, []);

  return { skipRestore };
}
