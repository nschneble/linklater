import IconListButton from '../common/IconListButton';
import type { SettingsSection } from './settingsSections';

interface SettingsSidebarProps {
  sections: SettingsSection[];
  activeSection: string;
  onSelectSection: (hash: string) => void;
  onBackToTop: () => void;
}

/**
 * Desktop sticky table of contents for the Settings page. Renders one
 * `IconListButton` per group, plus a "Back to top" action at the bottom.
 * Buttons (not anchors) — the trade-off is that middle-click-new-tab does
 * not work, which is acceptable because Settings is a single-route,
 * single-user authenticated surface with no section URLs.
 *
 * Clicking an item scrolls to its section and marks that section active. The
 * matching item gets `aria-current="page"` (driven by the shared
 * `activeSection` state) so screen readers expose the user's deliberate
 * position; `IconListButton` styles itself off that ARIA attribute via
 * Tailwind `aria-[current]:` variants. The active state is intent-driven, not
 * scroll-driven: it does not follow the viewport, and clears when the user
 * interacts outside the active section.
 */
export default function SettingsSidebar({
  sections,
  activeSection,
  onSelectSection,
  onBackToTop,
}: SettingsSidebarProps) {
  return (
    <nav
      aria-label="Settings sections"
      className="hidden md:block md:sticky md:top-4 md:self-start"
    >
      <ul className="space-y-1">
        {sections.map((section) => (
          <li key={section.hash}>
            <IconListButton
              icon={section.icon}
              aria-current={activeSection === section.hash ? 'page' : undefined}
              onClick={() => onSelectSection(section.hash)}
            >
              {section.label}
            </IconListButton>
          </li>
        ))}
      </ul>
      <IconListButton icon="fa-arrow-up" className="mt-2" onClick={onBackToTop}>
        Back to top
      </IconListButton>
    </nav>
  );
}
