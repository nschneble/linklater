import { useRef, type ReactNode } from 'react';
import TabButton from './TabButton';
import { useTabNavigation } from '../../lib/hooks/useTabNavigation';

/**
 * Single tab descriptor consumed by `SlidingTabBar`. Mirrors the props
 * `TabButton` already accepts so callers can express each tab declaratively.
 */
export interface SlidingTab {
  /** Stable DOM id – referenced by the matching `<*tabpanel*>` via `aria-labelledby`. */
  id: string;
  /** id of the panel this tab controls – surfaces on `aria-controls`. */
  ariaControls?: string;
  label: ReactNode;
  onClick: () => void;
}

interface SlidingTabBarProps {
  /** Accessible name for the `role="tablist"` container. */
  ariaLabel: string;
  // drives `aria-selected` and the pill position
  activeIndex: number;
  tabs: SlidingTab[];
  /**
   * Which bundle surface hosts this tab bar (i.e. the bundle of the parent
   * surface). The component paints itself one lift UP from the host so the
   * chip reads as elevated above its container. Page-level tab bars (e.g.
   * the Unread/Read switcher in `LinksToolbar` rendered against page chrome)
   * pass `'base'`; the bar lifts off base to mount. Tab bars rendered inside
   * a card (e.g. the Log in/Sign up switcher in `LoginRegisterView` inside
   * `AuthCard`) pass `'mount'`; the bar lifts off mount to orbit. Defaults
   * to `'base'`. The selected surface drives the container fill, the pill
   * color, AND the per-tab label colors so they stay coordinated.
   *
   * Mirrors `FormInput.surface` semantics: the prop names the host, the
   * component derives its own paint internally.
   */
  surface?: 'base' | 'mount';
  className?: string;
  tabClassName?: string;
}

/**
 * Shared tablist with an animated "sliding pill" indicator. Used by the
 * Unread/Read switcher in `LinksToolbar` and the Log in/Sign up switcher in
 * `LoginRegisterView`. The pill is decorative (`aria-hidden`) – selection
 * state lives on the individual `TabButton` (`aria-selected` + roving
 * `tabIndex`). Arrow-key navigation is provided by `useTabNavigation`.
 */
export default function SlidingTabBar({
  ariaLabel,
  activeIndex,
  tabs,
  surface = 'base',
  className = '',
  tabClassName = '',
}: SlidingTabBarProps) {
  const tablistReference = useRef<HTMLDivElement>(null);
  useTabNavigation(tablistReference);

  const widthPercent = 100 / tabs.length;

  // Container fill paints one lift UP from the host bundle (base host →
  // mount fill, mount host → orbit fill). Pill (active indicator) uses that
  // same lifted bundle's primary text color so the active-tab label, which
  // inverts to the lifted bundle bg, satisfies the bundle's own text/bg
  // contrast contract by construction.
  //
  // Surface is forwarded via `data-surface` on the tablist (which carries
  // `group` so descendants can read it via `group-data-[surface=...]`),
  // dropping ternaries on the pill bg + per-tab label classes per the
  // CLAUDE.md "no ternaries for state-driven styling when Tailwind has a
  // variant" rule, extended to `data-*` attributes.

  return (
    <div
      ref={tablistReference}
      className={`group relative grid p-1 bg-[var(--mount-bg)] data-[surface=mount]:bg-[var(--orbit-bg)] rounded-full ${className}`}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      role="tablist"
      aria-label={ariaLabel}
      data-surface={surface}
    >
      <div
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 bg-[var(--mount-text)] group-data-[surface=mount]:bg-[var(--orbit-text)] rounded-full motion-safe:[transition:transform_200ms_cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          width: `calc(${widthPercent}% - 4px)`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {tabs.map((tab, index) => (
        <TabButton
          key={tab.id}
          id={tab.id}
          aria-controls={tab.ariaControls}
          className={tabClassName}
          isActive={index === activeIndex}
          onClick={tab.onClick}
        >
          {tab.label}
        </TabButton>
      ))}
    </div>
  );
}
