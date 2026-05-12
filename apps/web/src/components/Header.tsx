import UserMenu from './UserMenu';
import type { AppView } from '../lib/navigation';
import type { BaseTheme } from '../theme/ThemeContext';
import type { User } from '../auth/AuthContext';

interface HeaderProps {
  /** The authenticated user — displayed in the `UserMenu` avatar and email label. */
  user: User;
  /** The currently active view — passed to `UserMenu` to highlight the active item. */
  view: AppView;
  /** Called when the user clicks "Log out" in the `UserMenu`. */
  onLogout: () => void;
  /** Called when the user toggles light/dark mode in the `UserMenu`. */
  onModeToggle: () => void;
  /** Called when the user selects a theme from the theme submenu. */
  onThemeSelect: (theme: BaseTheme) => void;
  /** Called when the user navigates to a different view from the `UserMenu`. */
  onViewChange: (view: AppView) => void;
}

/**
 * The top-of-page navigation bar, visible on all authenticated routes.
 *
 * Contains:
 * - A logo/title button that navigates to the links view.
 * - A `UserMenu` with avatar, navigation, theme, and mode controls.
 *
 * All navigation and action handling is delegated upward to `AppShell` via
 * callback props so this component remains stateless.
 */
export default function Header({
  user,
  view,
  onLogout,
  onModeToggle,
  onThemeSelect,
  onViewChange,
}: HeaderProps) {
  return (
    <header className="bg-[var(--bg-elevated)] border-b border-[var(--border)]">
      <div className="flex items-center justify-between max-w-4xl mx-auto px-4 py-3">
        <button
          type="button"
          aria-label="Go to your links"
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => {
            onViewChange('links');
          }}
        >
          <img
            className="w-8 h-8 outline outline-black/10 -outline-offset-1 rounded-4xl"
            src="/assets/img/linklater.jpg"
            alt="Photo of Richard Linklater by Sarah K Joyce"
            aria-hidden="true"
          />
          <div className="text-left">
            <div className="text-[var(--text)] text-sm font-semibold">
              Linklater
            </div>
            <div className="text-[var(--text-muted)] text-xs">
              Save links now, read them later.
            </div>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <UserMenu
            user={user}
            view={view}
            onLogout={onLogout}
            onModeToggle={onModeToggle}
            onThemeSelect={onThemeSelect}
            onViewChange={onViewChange}
          />
        </div>
      </div>
    </header>
  );
}
