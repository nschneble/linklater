import { useRef, type ReactNode } from 'react';
import TabButton from './TabButton';
import { useTabNavigation } from '../../lib/hooks/useTabNavigation';

/**
 * Single tab descriptor consumed by `SlidingTabBar`. Mirrors the props
 * `TabButton` already accepts so callers can express each tab declaratively.
 */
export interface SlidingTab {
  /** Stable DOM id — referenced by the matching `<*tabpanel*>` via `aria-labelledby`. */
  id: string;
  /** id of the panel this tab controls — surfaces on `aria-controls`. */
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
   * Which bundle surface hosts this tab bar. Page-level tab bars (e.g. the
   * Unread/Read switcher in `LinksToolbar` rendered inside `<main>`) pass
   * `'mount'` to lift the chip off the base bundle. Tab bars rendered
   * inside a card (e.g. the Log in/Sign up switcher in `LoginRegisterView`
   * inside `AuthCard`) pass `'orbit'` to lift the chip off the mount
   * bundle. Defaults to `'mount'`. The selected surface drives both the
   * container fill AND the per-tab label colors via the matching
   * `TabButton` surface prop, so the pill and labels stay coordinated.
   */
  surface?: 'mount' | 'orbit';
  className?: string;
  tabClassName?: string;
}

/**
 * Shared tablist with an animated "sliding pill" indicator. Used by the
 * Unread/Read switcher in `LinksToolbar` and the Log in/Sign up switcher in
 * `LoginRegisterView`. The pill is decorative (`aria-hidden`) — selection
 * state lives on the individual `TabButton` (`aria-selected` + roving
 * `tabIndex`). Arrow-key navigation is provided by `useTabNavigation`.
 */
export default function SlidingTabBar({
  ariaLabel,
  activeIndex,
  tabs,
  surface = 'mount',
  className = '',
  tabClassName = '',
}: SlidingTabBarProps) {
  const tablistReference = useRef<HTMLDivElement>(null);
  useTabNavigation(tablistReference);

  const widthPercent = 100 / tabs.length;

  // Container fill picks the host bundle bg. Pill (active indicator) uses
  // the bundle's primary text color so the active-tab label, which inverts
  // to bundle bg, satisfies the bundle's own text/bg contrast contract by
  // construction.
  const surfaceClasses =
    surface === 'orbit' ? 'bg-[var(--orbit-bg)]' : 'bg-[var(--mount-bg)]';
  const pillBgClass =
    surface === 'orbit' ? 'bg-[var(--orbit-text)]' : 'bg-[var(--mount-text)]';

  return (
    <div
      ref={tablistReference}
      className={`relative grid p-1 ${surfaceClasses} rounded-full ${className}`}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        aria-hidden="true"
        className={`absolute top-1 bottom-1 left-1 ${pillBgClass} rounded-full motion-safe:[transition:transform_200ms_cubic-bezier(0.34,1.56,0.64,1)]`}
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
          surface={surface}
          onClick={tab.onClick}
        >
          {tab.label}
        </TabButton>
      ))}
    </div>
  );
}
