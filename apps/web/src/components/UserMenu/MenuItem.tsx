import { FOCUS_RING } from '../../lib/styles';

/**
 * A single action item within a `role="menu"` container.
 * Renders a full-width `<button>` with `role="menuitem"`, a Font Awesome icon,
 * and a text label. The icon is tinted accent when `active` is true.
 */
interface MenuItemProps {
  /** Font Awesome icon class without the `fa-solid` prefix (e.g. `'fa-bookmark'`). */
  icon: string;
  /** Visible text label for the menu item. May be empty for icon-only items. */
  label: string;
  /** Called when the item is clicked. */
  onClick: () => void;
  /**
   * When `true`, the icon is rendered in the accent color to indicate the
   * current active view.
   *
   * @default false
   */
  active?: boolean;
  /** Additional Tailwind classes for spacing overrides (e.g. `"mt-2"` for the logout item). */
  className?: string;
  /**
   * Accessible name override. Required when `label` is empty so the button
   * still has a discernible name for screen readers (WCAG 4.1.2).
   */
  'aria-label'?: string;
}

/**
 * A single action row in the `UserMenu` dropdown. Used for navigation items,
 * mode toggle, and logout.
 */
export default function MenuItem({
  icon,
  label,
  onClick,
  active = false,
  className = '',
  'aria-label': ariaLabel,
}: MenuItemProps) {
  return (
    <button
      className={`group flex items-center gap-2 w-full pl-2.5 pr-3 py-2 text-[var(--orbit-text)] text-left ${FOCUS_RING} cursor-pointer ${className}`}
      type="button"
      role="menuitem"
      aria-current={active ? 'page' : undefined}
      aria-label={ariaLabel}
      onMouseEnter={(event) => {
        event.currentTarget.focus();
      }}
      onMouseDown={(event) => {
        // Prevent the browser from removing focus on mousedown (macOS behaviour:
        // clicking a button that already has programmatic focus fires blur before
        // click, which loses the hover highlight on items that keep the menu open).
        event.preventDefault();
      }}
      onClick={onClick}
    >
      <i
        className={`fa-solid ${icon} text-[var(--orbit-alt-text)] group-aria-[current=page]:text-[var(--orbit-highlight)] text-[0.75rem]`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  );
}
