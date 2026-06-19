import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { FOCUS_RING } from '../../lib/styles';

/**
 * A single tab within a `role="tablist"` container.
 *
 * The active indicator (a sliding pill) is rendered separately by the parent
 * using an `aria-hidden` `<div>` so the text color transitions correctly over
 * the highlight. When active, the tab also renders a small `fa-circle-dot`
 * icon as a non-color active indicator – useful in the Apollo 10½ CVD theme.
 *
 * Text colors are driven by the parent `SlidingTabBar`'s `data-surface`
 * attribute via Tailwind `group-data-*` variants – no `surface` prop needed
 * here, the tab reads its host bundle from DOM ancestry. The mapping mirrors
 * the parent: `data-surface=base` paints mount-tier (idle label
 * `--mount-alt-text`, active inverts to `--mount-bg`); `data-surface=mount`
 * paints orbit-tier. Keeps pill bg + label fg in lock-step structurally.
 */
interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  // drives `aria-selected`
  isActive: boolean;
  // parent handles navigation
  onClick: () => void;
  className?: string;
}

export default function TabButton({
  children,
  isActive,
  onClick,
  className = '',
  ...props
}: TabButtonProps) {
  // Idle label sits on the lifted bundle bg (--{lift}-alt-text). Active
  // label sits on the pill (--{lift}-text bg) so it inverts to --{lift}-bg.
  // Default (no parent data-surface, or data-surface=base) paints mount.
  // group-data-[surface=mount] paints orbit.
  return (
    <button
      className={`relative z-10 w-full pl-4 pr-4.5 text-[var(--mount-alt-text)] group-data-[surface=mount]:text-[var(--orbit-alt-text)] aria-selected:text-[var(--mount-bg)] group-data-[surface=mount]:aria-selected:text-[var(--orbit-bg)] font-semibold aria-selected:font-extrabold ${FOCUS_RING} rounded-full transition-colors duration-200 cursor-pointer ${className}`}
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
