import { FOCUS_RING } from '../../lib/styles';
import type { SettingsSection } from './settingsSections';

interface SettingsSidebarProps {
  sections: SettingsSection[];
  activeHash: string;
  onNavigate?: (hash: string) => void;
}

/**
 * Desktop sticky table of contents for the Settings page. Renders one
 * anchor per group. Native anchors (not buttons) so middle-click,
 * copy-link, browser history, and Tab order all behave naturally. The
 * active link gets `aria-current="location"` so screen readers expose the
 * user's position within the page.
 */
export default function SettingsSidebar({
  sections,
  activeHash,
  onNavigate,
}: SettingsSidebarProps) {
  return (
    <nav
      aria-label="Settings sections"
      className="hidden md:block md:sticky md:top-4 md:self-start"
    >
      <ul className="space-y-1">
        {sections.map((section) => {
          const isActive = activeHash === section.hash;
          return (
            <li key={section.hash}>
              <a
                href={`#${section.hash}`}
                aria-current={isActive ? 'location' : undefined}
                onClick={() => onNavigate?.(section.hash)}
                className={`group flex items-center gap-2.5 w-full min-h-10 px-3 py-2 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text)] font-medium aria-[current]:bg-[var(--bg-elevated)] aria-[current]:text-[var(--text)] aria-[current]:font-semibold text-sm ${FOCUS_RING} rounded-lg motion-safe:active:scale-[0.96] motion-safe:[transition:background-color_150ms,color_150ms,scale_150ms]`}
              >
                <i
                  className={`fa-solid ${section.icon} text-[var(--text-subtle)] group-aria-[current]:text-[var(--accent)] text-xs`}
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
