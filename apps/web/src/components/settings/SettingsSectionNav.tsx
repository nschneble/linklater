import { FOCUS_RING_FLUSH } from '../../lib/styles';
import type { SettingsSection } from './settingsSections';

interface SettingsSectionNavProps {
  sections: SettingsSection[];
  activeSection: string;
  onSelectSection: (hash: string) => void;
}

/**
 * Mobile horizontal chip row for navigating Settings sections. Used in
 * place of the desktop sidebar below `md`. Clicking a chip scrolls to its
 * section and marks it active; the matching chip gets `aria-current="page"`
 * plus a filled treatment (driven by the shared `activeSection` state). The
 * active state is intent-driven, not scroll-driven – it does not follow the
 * viewport and clears when the user interacts outside the active section.
 *
 * Landmark label is "Settings sections (compact)" so it differs from the
 * desktop sidebar's "Settings sections" landmark when both happen to be
 * present in the AT tree (they share the same component tree but are
 * media-query-hidden alternately).
 */
export default function SettingsSectionNav({
  sections,
  activeSection,
  onSelectSection,
}: SettingsSectionNavProps) {
  return (
    <nav
      aria-label="Settings sections (compact)"
      className="sticky md:hidden top-2 z-10 -mx-4 px-4 py-2 bg-[var(--base-bg)]"
    >
      <ul className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => (
          <li key={section.hash} className="shrink-0 snap-start">
            <button
              type="button"
              aria-current={activeSection === section.hash ? 'page' : undefined}
              onClick={() => onSelectSection(section.hash)}
              className={`group inline-flex items-center gap-1.5 min-h-10 px-3.5 py-2 bg-transparent text-[var(--base-alt-text)] hover:text-[var(--base-text)] ring-1 ring-[var(--base-border)]/60 font-medium aria-[current]:bg-[var(--orbit-bg)] aria-[current]:text-[var(--orbit-text)] aria-[current]:ring-[var(--orbit-border)] aria-[current]:font-semibold text-xs ${FOCUS_RING_FLUSH} rounded-full cursor-pointer motion-safe:active:scale-[0.96] motion-safe:[transition:background-color_150ms,color_150ms,scale_150ms] whitespace-nowrap`}
            >
              <i
                className={`fa-solid ${section.icon} text-[var(--base-subtle-text)] group-aria-[current]:text-[var(--orbit-highlight)] text-[0.65rem]`}
                aria-hidden="true"
              />
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
