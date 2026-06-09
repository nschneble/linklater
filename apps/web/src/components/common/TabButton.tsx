import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { FOCUS_RING } from '../../lib/styles';

/**
 * A single tab within a `role="tablist"` container.
 *
 * The active indicator (a sliding pill) is rendered separately by the parent
 * using an `aria-hidden` `<div>` so the text color transitions correctly over
 * the highlight. When active, the tab also renders a small `fa-circle-dot`
 * icon as a non-color active indicator — useful in the Apollo 10½ CVD theme.
 *
 * The `surface` prop selects which bundle's text tokens drive the tab's
 * idle and active labels. Tabs rendered on a card / settings panel pass
 * `surface="mount"`; tabs rendered on a lifted menu (e.g. inside another
 * card) pass `surface="orbit"`. Matches the host bundle used by the parent
 * `SlidingTabBar`, so the foreground colors stay coherent with the pill bg.
 */
interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  // drives `aria-selected`
  isActive: boolean;
  // parent handles navigation
  onClick: () => void;
  /** Which bundle surface hosts this tab. Defaults to `'mount'`. */
  surface?: 'mount' | 'orbit';
  className?: string;
}

export default function TabButton({
  children,
  isActive,
  onClick,
  surface = 'mount',
  className = '',
  ...props
}: TabButtonProps) {
  // Idle label sits on the bundle bg (--{surface}-alt-text). Active label
  // sits on the pill (--{surface}-text bg) so it inverts to --{surface}-bg.
  const surfaceClasses =
    surface === 'orbit'
      ? 'text-[var(--orbit-alt-text)] aria-selected:text-[var(--orbit-bg)]'
      : 'text-[var(--mount-alt-text)] aria-selected:text-[var(--mount-bg)]';
  return (
    <button
      className={`relative z-10 w-full pl-4 pr-4.5 ${surfaceClasses} font-semibold aria-selected:font-extrabold ${FOCUS_RING} rounded-full transition-colors duration-200 cursor-pointer ${className}`}
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
