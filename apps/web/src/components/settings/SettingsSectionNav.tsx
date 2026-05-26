import { FOCUS_RING } from '../../lib/styles';
import { useEffect, useRef } from 'react';
import type { SettingsSection } from './settingsSections';

interface SettingsSectionNavProps {
  sections: SettingsSection[];
  activeHash: string;
  onNavigate?: (hash: string) => void;
}

/**
 * Mobile horizontal chip row for navigating Settings sections. Used in
 * place of the desktop sidebar below `md`. These are nav links (not tabs)
 * — the panels are not hidden, they scroll — so the markup is a plain
 * anchor list rather than a `tablist`. Active chip gets
 * `aria-current="location"` and a filled treatment, and is auto-scrolled
 * into the center of the row whenever it changes.
 */
export default function SettingsSectionNav({
  sections,
  activeHash,
  onNavigate,
}: SettingsSectionNavProps) {
  const activeReference = useRef<HTMLAnchorElement>(null);

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
      aria-label="Settings sections"
      className="md:hidden sticky top-2 z-10 -mx-4 px-4 py-2 bg-[var(--bg)]"
    >
      <ul className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => {
          const isActive = activeHash === section.hash;
          return (
            <li key={section.hash} className="shrink-0 snap-start">
              <a
                href={`#${section.hash}`}
                aria-current={isActive ? 'location' : undefined}
                ref={isActive ? activeReference : undefined}
                onClick={() => onNavigate?.(section.hash)}
                className={`group inline-flex items-center gap-1.5 min-h-10 px-3.5 py-2 bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] ring-1 ring-[var(--border)]/60 font-medium aria-[current]:bg-[var(--bg-elevated)] aria-[current]:text-[var(--text)] aria-[current]:ring-[var(--border)] aria-[current]:font-semibold text-xs ${FOCUS_RING} rounded-full motion-safe:active:scale-[0.96] motion-safe:[transition:background-color_150ms,color_150ms,scale_150ms] whitespace-nowrap`}
              >
                <i
                  className={`fa-solid ${section.icon} text-[var(--text-subtle)] group-aria-[current]:text-[var(--accent)] text-[0.65rem]`}
                  aria-hidden="true"
                />
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
