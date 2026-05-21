import type { RefObject } from 'react';
import { useEffect } from 'react';

/**
 * Focuses the first `<button>` inside `reference` when `isActive` becomes
 * `true`. Uses `requestAnimationFrame` to defer focus until after paint so the
 * button is guaranteed to be in the DOM and visible.
 */
export function useFocusFirstButton(
  reference: RefObject<HTMLElement | null>,
  isActive: boolean,
): void {
  useEffect(() => {
    if (!isActive) return;
    const button =
      reference.current?.querySelector<HTMLButtonElement>('button');
    const handle = requestAnimationFrame(() => button?.focus());
    return () => cancelAnimationFrame(handle);
  }, [reference, isActive]);
}
