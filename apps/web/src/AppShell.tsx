import { lazy, Suspense } from 'react';
import { updateMe } from './lib/api';
import { useAuth } from './auth/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme, type BaseTheme } from './theme/ThemeContext';

import Header from './components/Header';
import LinksView from './components/LinksView';
import SettingsView from './components/SettingsView';

const ThemeEditor = lazy(() => import('./components/ThemeEditor'));

type AppView = 'links' | 'settings' | 'theme-editor';

function viewFromPath(pathname: string): AppView {
  if (pathname === '/settings') return 'settings';
  if (pathname === '/editor') return 'theme-editor';
  return 'links';
}

export default function AppShell() {
  const { logout, user } = useAuth();
  const { setBaseTheme, toggleMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const view = viewFromPath(location.pathname);

  const handleThemeSelect = (theme: BaseTheme) => {
    setBaseTheme(theme);
    updateMe({ theme }).catch((error) =>
      console.error('Failed to save theme', error),
    );
  };

  const handleModeToggle = () => {
    const nextMode = user?.mode === 'light' ? 'dark' : 'light';
    toggleMode();
    updateMe({ mode: nextMode }).catch((error) =>
      console.error('Failed to save mode', error),
    );
  };

  if (!user) return null;

  const isEmailUnverified = !user.emailVerifiedAt;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] select-none">
      {isEmailUnverified && (
        <div className="px-4 py-2 bg-amber-100 [[data-mode='dark']_&]:bg-amber-950/25 border-b border-amber-300 [[data-mode='dark']_&]:border-amber-800/50 text-center">
          <p className="text-amber-800 [[data-mode='dark']_&]:text-amber-300 text-xs font-medium">
            <i
              className="fa-solid fa-triangle-exclamation mr-1.5"
              aria-hidden="true"
            />
            Please verify your email address. Check your inbox!
          </p>
        </div>
      )}
      <Header
        onLogout={logout}
        onModeToggle={handleModeToggle}
        onThemeSelect={handleThemeSelect}
        onViewChange={(newView) => {
          if (newView === 'links') navigate('/unread');
          else if (newView === 'settings') navigate('/settings');
          else navigate('/editor');
        }}
        user={user}
        view={view}
      />

      <main
        className={
          view === 'theme-editor'
            ? 'px-4 py-8'
            : 'max-w-3xl mx-auto px-4 py-12 space-y-6'
        }
      >
        {view === 'links' ? (
          <LinksView />
        ) : view === 'theme-editor' ? (
          <Suspense>
            <ThemeEditor />
          </Suspense>
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
