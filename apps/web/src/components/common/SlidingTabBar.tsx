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
  className = '',
  tabClassName = '',
}: SlidingTabBarProps) {
  const tablistReference = useRef<HTMLDivElement>(null);
  useTabNavigation(tablistReference);

  const widthPercent = 100 / tabs.length;

  return (
    <div
      ref={tablistReference}
      className={`relative grid p-1 rounded-full ${className}`}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 bg-[var(--text)] rounded-full"
        style={{
          width: `calc(${widthPercent}% - 4px)`,
          transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
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
