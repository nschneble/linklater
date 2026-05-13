/**
 * Shared Tailwind CSS class strings for interactive element focus rings.
 * Consuming components spread this into their `className` prop so that
 * the focus style is consistent across the whole application.
 *
 * Uses `focus-visible` (not `focus`) so that the ring only appears during
 * keyboard navigation, not on mouse clicks.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

/**
 * Shared Tailwind CSS class string for disabled button states.
 * Applied to `PrimaryButton` and `IconButton` so that any disabled button
 * consistently reduces opacity and shows a wait cursor.
 */
export const DISABLED = 'disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * Variant of `FOCUS_RING` for destructive actions. Uses a rose ring instead
 * of the accent color to stay visually consistent with danger-tinted buttons.
 */
export const FOCUS_RING_DANGER =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';
