import UserMenu from './UserMenu';
import type { BaseTheme } from '../theme/ThemeContext';
import type { User } from '../auth/AuthContext';

type AppView = 'links' | 'settings';

interface HeaderProps {
  user: User;
  view: AppView;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}

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
      <div className="flex items-center justify-between max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            className="w-8 h-8 rounded-xl"
            src="/linklater.svg"
            alt="Richard Linklater"
          />
          <div>
            <div className="text-[var(--text)] text-sm font-semibold">
              Linklater
            </div>
            <div className="text-[var(--text-muted)] text-xs">
              Save links now, read them later.
            </div>
          </div>
        </div>

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
