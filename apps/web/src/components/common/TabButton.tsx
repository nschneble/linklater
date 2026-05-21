import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { FOCUS_RING } from '../../lib/styles';

/**
 * A single tab within a `role="tablist"` container.
 *
 * Renders as a `<button>` with `role="tab"` and `aria-selected` set from
 * `isActive`. The active indicator (a sliding pill) is rendered separately
 * by the parent using an `aria-hidden` `<div>` so that the text color
 * transitions correctly over the highlight.
 *
 * When active, renders a small `fa-circle-dot` icon to the left of the label
 * as an additional non-color active indicator — particularly useful in the
 * Apollo 10½ CVD-friendly theme.
 *
 * Accepts all native `<button>` attributes (e.g. `aria-controls`) so the
 * parent tablist can wire up proper panel associations.
 *
 * Used in `LinksToolbar` (Unread/Read tabs) and `AuthForm` (Log in/Sign up).
 */
interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
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
  ...props
}: TabButtonProps) {
  return (
    <button
      className={`relative z-10 w-full pl-4 pr-4.5 ${FOCUS_RING} rounded-full transition-colors duration-200 ${
        isActive
          ? 'text-[var(--bg)] font-extrabold'
          : 'text-[var(--text-muted)] font-semibold cursor-pointer'
      } ${className}`}
      type="button"
      role="tab"
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      aria-selected={isActive}
      {...props}
    >
      <span className="grid justify-center">
        <span
          className="col-start-1 row-start-1 invisible flex items-center justify-center gap-1 font-extrabold"
          aria-hidden="true"
        >
          <i
            className="fa-solid fa-circle-dot text-[0.4rem]"
            aria-hidden="true"
          />
          {children}
        </span>
        <span className="col-start-1 row-start-1 flex items-center justify-center gap-1">
          {isActive && (
            <i
              className="fa-solid fa-circle-dot text-[0.4rem]"
              aria-hidden="true"
            />
          )}
          {children}
        </span>
      </span>
    </button>
  );
}
