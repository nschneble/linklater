import { useState } from 'react';

/**
 * A single action item within a `role="menu"` container.
 * Renders a full-width `<button>` with `role="menuitem"`, a Font Awesome icon,
 * and a text label. The icon is tinted accent when `active` is true.
 */
interface MenuItemProps {
  /** Font Awesome icon class without the `fa-solid` prefix (e.g. `'fa-bookmark'`). */
  icon: string;
  /** Visible text label for the menu item. */
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
}: MenuItemProps) {
  const [isPointerOver, setIsPointerOver] = useState(false);

  return (
    <button
      className={`flex items-center gap-2 w-full pl-2.5 pr-3 py-2 ${isPointerOver ? 'bg-[var(--bg-surface)]' : ''} focus:bg-[var(--bg-surface)] focus:outline-none text-[var(--text)] text-left cursor-pointer ${className}`}
      type="button"
      role="menuitem"
      onMouseEnter={(event) => {
        setIsPointerOver(true);
        event.currentTarget.focus();
      }}
      onMouseLeave={() => setIsPointerOver(false)}
      onBlur={() => setIsPointerOver(false)}
      onClick={onClick}
    >
      <i
        className={`fa-solid ${icon} text-[0.75rem] ${
          active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
        }`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  );
}
