import { FOCUS_RING } from '../../lib/styles';
import { useRef } from 'react';

/**
 * A single action item within a `role="menu"` container.
 * Renders a full-width `<button>` with `role="menuitem"`, a Font Awesome icon,
 * and a text label. The icon is tinted with the orbit-tier highlight when
 * `active` is true.
 */
interface MenuItemProps {
  /** Font Awesome icon class without the `fa-solid` prefix (e.g. `'fa-bookmark'`). */
  icon: string;
  /** Visible text label for the menu item. May be empty for icon-only items. */
  label: string;
  /** Called when the item is clicked. */
  onClick: () => void;
  /**
   * When `true`, the icon is rendered in the orbit-tier highlight color to
   * indicate the current active view.
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
  // Records the pointer type of the most recent pointerdown so the mousedown
  // handler can gate its focus-retention hack to mouse input only.
  const lastPointerType = useRef<string | undefined>(undefined);

  return (
    <button
      className={`group flex items-center gap-2 w-full pl-2.5 pr-3 py-2 hover:bg-[var(--orbit-highlight)]/80 border-y border-transparent hover:border-[var(--orbit-highlight-hover)]/80 text-[var(--orbit-text)] hover:text-[var(--orbit-highlight-fg)] text-left ${FOCUS_RING} cursor-pointer ${className}`}
      type="button"
      role="menuitem"
      aria-current={active ? 'page' : undefined}
      aria-label={ariaLabel}
      onMouseEnter={(event) => {
        event.currentTarget.focus();
      }}
      onPointerDown={(event) => {
        lastPointerType.current = event.pointerType;
      }}
      onMouseDown={(event) => {
        // Prevent the browser from removing focus on mousedown (macOS behaviour:
        // clicking a button that already has programmatic focus fires blur before
        // click, which loses the hover highlight on items that keep the menu open).
        //
        // Only do this for mouse input. On touch/pen engines, preventDefault on
        // the synthesized mousedown suppresses the follow-on synthesized click,
        // so a tap would never fire onClick. An unknown/undefined pointerType is
        // treated as mouse (older engines fire mousedown without a preceding
        // pointerdown; modern engines set the ref first).
        if (
          lastPointerType.current === undefined ||
          lastPointerType.current === 'mouse'
        ) {
          event.preventDefault();
        }
      }}
      onClick={onClick}
    >
      <i
        className={`fa-solid ${icon} text-[var(--orbit-alt-text)] group-hover:text-[var(--orbit-highlight-fg)]/80 group-aria-[current=page]:text-[var(--orbit-highlight)] group-hover:group-aria-[current=page]:text-[var(--orbit-highlight-fg)] text-[0.75rem]`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  );
}
