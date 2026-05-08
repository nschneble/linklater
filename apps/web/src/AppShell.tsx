import { lazy, Suspense } from 'react';
import { updateMe } from './lib/api';
import { useAuth } from './auth/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme, type BaseTheme } from './theme/ThemeContext';

import Header from './components/Header';
import LinksView from './components/LinksView';
import SettingsView from './components/SettingsView';
import LinkButton from './components/ui/LinkButton';

// ThemeEditor is lazy-loaded because it is rarely visited and its color-math
// utilities add non-trivial weight to the bundle.
const ThemeEditor = lazy(() => import('./components/ThemeEditor'));

/** The three main views of the authenticated application shell. */
type AppView = 'links' | 'settings' | 'theme-editor';

/**
 * Maps the current URL pathname to the active `AppView`. Defaults to
 * `'links'` for any unrecognized path so unknown routes still show content.
 */
function viewFromPath(pathname: string): AppView {
  if (pathname === '/settings') return 'settings';
  if (pathname === '/editor') return 'theme-editor';
  return 'links';
}

/**
 * The main authenticated layout. Renders the `Header`, an optional
 * verification banner for unverified users, and the active view
 * (`LinksView`, `SettingsView`, or `ThemeEditor`) based on the current URL.
 *
 * Theme and mode changes are applied optimistically to `ThemeContext` first,
 * then persisted to the server via `PATCH /users/me` in the background.
 * Failures are logged but do not roll back the UI — preferences are best-effort.
 *
 * NOTE: Returns `null` when `user` is unexpectedly null. This is a safety
 * guard; in practice `AppShell` is only rendered when `user` is non-null.
 */
export default function AppShell() {
  const { logout, user } = useAuth();
  const { setBaseTheme, toggleMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const view = viewFromPath(location.pathname);

  // Optimistic update: the theme switches immediately without waiting for the
  // server response.
  const handleThemeSelect = (theme: BaseTheme) => {
    setBaseTheme(theme);
    updateMe({ theme }).catch((error) =>
      console.error('Failed to save theme', error),
    );
  };

  // The next mode is derived from user.mode (auth state) rather than from
  // ThemeContext so the persisted value stays in sync with auth state.
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
        <div
          role="status"
          className="px-4 py-2 bg-amber-100 [[data-mode='dark']_&]:bg-amber-950/25 border-b border-amber-300 [[data-mode='dark']_&]:border-amber-800/50 text-center"
        >
          <p className="text-amber-800 [[data-mode='dark']_&]:text-amber-300 text-xs font-medium">
            <i
              className="fa-solid fa-triangle-exclamation mr-1.5"
              aria-hidden="true"
            />
            Please verify your email address.{' '}
            <LinkButton onClick={() => navigate('/settings')}>
              Need to resend the verification email?
            </LinkButton>
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
