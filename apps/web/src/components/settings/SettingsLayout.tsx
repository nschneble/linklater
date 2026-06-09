import SettingsSectionNav from './SettingsSectionNav';
import SettingsSidebar from './SettingsSidebar';
import {
  isPlainAnchorClick,
  prefersReducedMotion,
  scrollToSettingsSection,
} from './settingsScroll';
import type { MouseEvent, ReactNode } from 'react';
import type { SettingsSection } from './settingsSections';

const HEADING_ID = 'settings-heading';

interface SettingsLayoutProps {
  sections: SettingsSection[];
  activeSection: string;
  onSelectSection: (hash: string) => void;
  children: ReactNode;
}

/**
 * Two-column layout for the Settings page. Sidebar on the left at `md+`;
 * stacks below a horizontal chip row on smaller viewports. The grid uses
 * `min-w-0` on the content slot so long PAT strings can't blow it out.
 *
 * Renders an `<h1>Settings</h1>` once at the top of the content column,
 * along with a "Skip settings navigation" link that becomes visible on
 * focus so keyboard users can bypass the sidebar. Owns `handleBackToTop`
 * (shared by the sidebar and the mobile back-to-top button) so the
 * scroll-to-top + focus-the-heading logic lives in one place.
 */
export default function SettingsLayout({
  sections,
  activeSection,
  onSelectSection,
  children,
}: SettingsLayoutProps) {
  const firstHash = sections[0]?.hash;

  // The skip link is a bypass, not a section selection: scroll + focus the
  // first section, but do NOT light its active accent (that is reserved for
  // deliberate nav clicks). `#${firstHash}` keeps a native fallback if JS
  // fails — it points at the real DOM id of the first section.
  function handleSkipClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!firstHash || !isPlainAnchorClick(event)) return;
    event.preventDefault();
    scrollToSettingsSection(firstHash);
  }

  // Scroll to the top, then move focus to the heading so keyboard users
  // continue tabbing from the top of the page (not the bottom of the sidebar)
  // and screen-reader users hear "Settings, heading level 1" as confirmation.
  // Focusing the heading is outside any section, so it also clears the active
  // accent — the desired "leave the section" outcome.
  function handleBackToTop() {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    document
      .getElementById(HEADING_ID)
      ?.focus({ preventScroll: true } as FocusOptions);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)] gap-6 md:gap-10">
      <SettingsSidebar
        sections={sections}
        activeSection={activeSection}
        onSelectSection={onSelectSection}
        onBackToTop={handleBackToTop}
      />
      <div className="min-w-0 space-y-6">
        {firstHash && (
          <a
            href={`#${firstHash}`}
            onClick={handleSkipClick}
            className="sr-only focus:not-sr-only focus:inline-flex focus:items-center focus:px-3 focus:py-1.5 focus:bg-[var(--mount-bg)] focus:text-[var(--mount-text)] focus:text-xs focus:font-semibold focus:rounded-lg focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none"
          >
            Skip settings navigation
          </a>
        )}
        <header className="pb-2">
          <h1
            id={HEADING_ID}
            tabIndex={-1}
            className="text-[var(--base-text)] text-2xl font-semibold text-balance focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg"
          >
            Settings
          </h1>
        </header>
        <SettingsSectionNav
          sections={sections}
          activeSection={activeSection}
          onSelectSection={onSelectSection}
        />
        {children}
        <div className="md:hidden flex justify-center">
          <button
            type="button"
            onClick={handleBackToTop}
            className="group flex items-center gap-2 min-h-10 px-3 py-2 hover:bg-[var(--mount-bg)] text-[var(--base-alt-text)] hover:text-[var(--base-text)] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg motion-safe:active:scale-[0.96] motion-safe:[transition:background-color_150ms,color_150ms,scale_150ms] cursor-pointer"
          >
            <i
              className="fa-solid fa-arrow-up text-[var(--base-subtle-text)] text-xs"
              aria-hidden="true"
            />
            Back to top
          </button>
        </div>
      </div>
    </div>
  );
}
