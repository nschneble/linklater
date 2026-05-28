import IconListButton from '../common/IconListButton';
import { navigateToSettingsSection } from './settingsScroll';
import { useNavigate } from 'react-router-dom';
import type { SettingsSection } from './settingsSections';

interface SettingsSidebarProps {
  sections: SettingsSection[];
  activeHash: string;
}

/**
 * Desktop sticky table of contents for the Settings page. Renders one
 * `IconListButton` per group. Buttons (not anchors) — the trade-off is that
 * middle-click-new-tab does not work on the sidebar, which is acceptable
 * because Settings is a single-user authenticated surface and the cost of
 * driving navigation through React Router (no native anchor jump that lands
 * a few pixels off from the shared scroll helper) is worth it.
 *
 * The active item gets `aria-current="page"` so screen readers expose the
 * user's position within the page; the `IconListButton` styles itself off
 * that ARIA attribute via Tailwind `aria-[current]:` variants.
 */
export default function SettingsSidebar({
  sections,
  activeHash,
}: SettingsSidebarProps) {
  const navigate = useNavigate();

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
              <IconListButton
                icon={section.icon}
                aria-current={isActive ? 'page' : undefined}
                onClick={() =>
                  navigateToSettingsSection(navigate, section.hash)
                }
              >
                {section.label}
              </IconListButton>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
