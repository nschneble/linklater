import { FOCUS_RING } from '../../lib/styles';
import { navigateToSettingsSection } from './settingsScroll';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SettingsSection } from './settingsSections';

interface SettingsSectionNavProps {
  sections: SettingsSection[];
  activeHash: string;
}

/**
 * Mobile horizontal chip row for navigating Settings sections. Used in
 * place of the desktop sidebar below `md`. These are buttons that drive
 * React Router navigation — the visual treatment is a chip (not the
 * full-width `IconListButton` row used in the desktop sidebar). The
 * active chip gets `aria-current="page"` plus a filled treatment, and is
 * auto-scrolled into the center of the row whenever it changes.
 *
 * Landmark label is "Settings sections (compact)" so it differs from the
 * desktop sidebar's "Settings sections" landmark when both happen to be
 * present in the AT tree (they share the same component tree but are
 * media-query-hidden alternately).
 */
export default function SettingsSectionNav({
  sections,
  activeHash,
}: SettingsSectionNavProps) {
  const activeReference = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  // Auto-scroll the active chip into the center of the row so it stays
  // visible after deep-link or scroll-spy advances. `prefers-reduced-motion`
  // disables the smooth animation.
  useEffect(() => {
    const element = activeReference.current;
    if (!element || typeof element.scrollIntoView !== 'function') return;
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [activeHash]);

  return (
    <nav
      aria-label="Settings sections (compact)"
      className="md:hidden sticky top-2 z-10 -mx-4 px-4 py-2 bg-[var(--bg)]"
    >
      <ul className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => {
          const isActive = activeHash === section.hash;
          return (
            <li key={section.hash} className="shrink-0 snap-start">
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                ref={isActive ? activeReference : undefined}
                onClick={() =>
                  navigateToSettingsSection(navigate, section.hash)
                }
                className={`group inline-flex items-center gap-1.5 min-h-10 px-3.5 py-2 bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] ring-1 ring-[var(--border)]/60 font-medium aria-[current]:bg-[var(--bg-elevated)] aria-[current]:text-[var(--text)] aria-[current]:ring-[var(--border)] aria-[current]:font-semibold text-xs ${FOCUS_RING} rounded-full cursor-pointer motion-safe:active:scale-[0.96] motion-safe:[transition:background-color_150ms,color_150ms,scale_150ms] whitespace-nowrap`}
              >
                <i
                  className={`fa-solid ${section.icon} text-[var(--text-subtle)] group-aria-[current]:text-[var(--accent)] text-[0.65rem]`}
                  aria-hidden="true"
                />
                {section.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
