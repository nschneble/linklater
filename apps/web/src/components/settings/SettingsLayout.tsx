import SettingsSectionNav from './SettingsSectionNav';
import SettingsSidebar from './SettingsSidebar';
import {
  isPlainAnchorClick,
  navigateToSettingsSection,
} from './settingsScroll';
import { useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import type { SettingsSection } from './settingsSections';

interface SettingsLayoutProps {
  sections: SettingsSection[];
  activeHash: string;
  children: ReactNode;
}

/**
 * Two-column layout for the Settings page. Sidebar on the left at `md+`;
 * stacks below a horizontal chip row on smaller viewports. The grid uses
 * `min-w-0` on the content slot so long PAT strings can't blow it out.
 *
 * Renders an `<h1>Settings</h1>` once at the top of the content column,
 * along with a "Skip settings navigation" link that becomes visible on
 * focus so keyboard users can bypass the sidebar.
 */
export default function SettingsLayout({
  sections,
  activeHash,
  children,
}: SettingsLayoutProps) {
  const firstHash = sections[0]?.hash;
  const navigate = useNavigate();

  // Route the skip link through the same intent-token nav as the sidebar so
  // keyboard users land at the same position as deep-link navigation. The
  // scroll-owner effect in `useSettingsScrollSpy` owns the scroll + focus;
  // the skip link only needs to fire the navigation (no direct scroll call,
  // which would compete with that effect).
  function handleSkipClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!firstHash || !isPlainAnchorClick(event)) return;
    event.preventDefault();
    navigateToSettingsSection(navigate, firstHash);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)] gap-6 md:gap-10">
      <SettingsSidebar sections={sections} activeHash={activeHash} />
      <div className="min-w-0 space-y-6">
        {firstHash && (
          <a
            href={`/settings/${firstHash}`}
            onClick={handleSkipClick}
            className="sr-only focus:not-sr-only focus:inline-flex focus:items-center focus:px-3 focus:py-1.5 focus:bg-[var(--bg-surface)] focus:text-[var(--text)] focus:text-xs focus:font-semibold focus:rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
          >
            Skip settings navigation
          </a>
        )}
        <header className="pb-2">
          <h1 className="text-[var(--text)] text-2xl font-semibold text-balance">
            Settings
          </h1>
        </header>
        <SettingsSectionNav sections={sections} activeHash={activeHash} />
        {children}
      </div>
    </div>
  );
}
