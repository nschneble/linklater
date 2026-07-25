import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Marker attribute the consumer spreads onto the button that should receive
 * initial focus (the safe / Cancel action). Selecting by marker rather than
 * DOM order keeps focus off the destructive button even when it renders first,
 * and rather than by button *text* so callers whose safe button is not labelled
 * "Cancel" (e.g. `EmailConfirmDeleteFlow`'s "No, don't delete") still work.
 * Mirrors `Modal`'s `[data-modal-initial-focus]` convention.
 */
export const ACTION_GUARD_INITIAL_FOCUS_ATTRIBUTE =
  'data-action-guard-initial-focus';

/**
 * Spread onto the safe (Cancel-equivalent) button so it receives initial focus.
 * Exposed as a pre-built props object because `data-*` attributes are not part
 * of the React `ButtonHTMLAttributes` surface, so spreading side-steps the
 * missing index signature while still forwarding through `IconButton`'s
 * `{...props}` onto the intrinsic `<button>`.
 */
export const actionGuardInitialFocusProps = {
  [ACTION_GUARD_INITIAL_FOCUS_ATTRIBUTE]: '',
} as const;

/**
 * Focuses the `[data-action-guard-initial-focus]`-marked button inside
 * `reference` when `isActive` becomes `true`. Uses `requestAnimationFrame` to
 * defer focus until after paint so the button is guaranteed to be in the DOM
 * and visible.
 *
 * Consumers MUST mark the safe (Cancel-equivalent) button with the attribute.
 * In dev, a missing marker logs a warning (mirroring `ActionGuard`'s
 * `confirmReference` sanity check) rather than silently focusing nothing.
 */
export function useFocusFirstButton(
  reference: RefObject<HTMLElement | null>,
  isActive: boolean,
): void {
  useEffect(() => {
    if (!isActive) return;
    const button = reference.current?.querySelector<HTMLButtonElement>(
      `[${ACTION_GUARD_INITIAL_FOCUS_ATTRIBUTE}]`,
    );
    if (!button && import.meta.env.DEV) {
      console.warn(
        '[useFocusFirstButton] isActive is true but no ' +
          `[${ACTION_GUARD_INITIAL_FOCUS_ATTRIBUTE}] button was found inside the ` +
          'reference. Mark the safe (Cancel) button with the attribute so ' +
          'initial focus lands there instead of on the destructive action.',
      );
    }
    const handle = requestAnimationFrame(() => button?.focus());
    return () => cancelAnimationFrame(handle);
  }, [reference, isActive]);
}
