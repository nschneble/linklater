import type { ReactNode } from 'react';
import { FOCUS_RING } from '../../lib/styles';

/**
 * A single tab within a `role="tablist"` container.
 *
 * Renders as a `<button>` with `role="tab"` and `aria-selected` set from
 * `isActive`. The active indicator (a sliding pill) is rendered separately
 * by the parent using an `aria-hidden` `<div>` so that the text color
 * transitions correctly over the highlight.
 *
 * Used in `LinksToolbar` (Unread/Read tabs) and `AuthForm` (Log in/Sign up).
 */
interface TabButtonProps {
  /** Tab label content. */
  children: ReactNode;
  /** Whether this tab is currently selected. Drives `aria-selected`. */
  isActive: boolean;
  /** Called when the tab is clicked. Parent is responsible for navigation. */
  onClick: () => void;
  /** Additional Tailwind classes for sizing/spacing overrides. */
  className?: string;
}

export default function TabButton({
  children,
  isActive,
  onClick,
  className = '',
}: TabButtonProps) {
  return (
    <button
      className={`relative z-10 w-full font-semibold text-center ${FOCUS_RING} rounded-full transition-colors duration-200 ${
        isActive
          ? 'text-[var(--bg)]'
          : 'text-[var(--text-muted)] cursor-pointer'
      } ${className}`}
      type="button"
      role="tab"
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      aria-selected={isActive}
    >
      {children}
    </button>
  );
}
