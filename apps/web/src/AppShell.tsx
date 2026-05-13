import Header from './components/Header';
import LinkButton from './components/ui/LinkButton';
import LinksView from './components/links/LinksView';
import NotFoundView from './components/NotFoundView';
import SettingsView from './components/settings/SettingsView';
import { Suspense, lazy, useEffect } from 'react';
import { updateMe } from './lib/api';
import { useAuth } from './auth/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme, type BaseTheme } from './theme/ThemeContext';
import { type AppView } from './lib/navigation';

// ThemeEditor is lazy-loaded because it's rarely visited and its
// color-math utilities add non-trivial weight to the bundle.
const ThemeEditor = lazy(() => import('./components/settings/ThemeEditor'));

/** Maps the current URL pathname to the active `AppView`. */
function viewFromPath(pathname: string): AppView {
  switch (pathname) {
    case '/unread':
    case '/read':
      return 'links';
    case '/settings':
      return 'settings';
    case '/editor':
      return 'theme-editor';
    default:
      return 'not-found';
  }
}

/**
 * The main authenticated layout. Renders the `Header`, an optional
 * verification banner for unverified users, and the active view
 * (`LinksView`, `SettingsView`, or `ThemeEditor`) based on the URL.
 *
 * Theme and mode changes are applied optimistically to `ThemeContext`
 * first, then persisted to the server via `PATCH /users/me` in the
 * background. Failures are logged but do not roll back the UI.
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

  // Optimistic update: the theme switches immediately without waiting for
  // the server response.
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

  // Global 'x' shortcut to open/close the user menu from anywhere.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'x') return;
      const target = event.target as HTMLElement;
      const isTypingField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isTypingField) return;
      event.preventDefault();
      document
        .querySelector<HTMLButtonElement>('[data-usermenu-trigger]')
        ?.click();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!user) return null;

  const isEmailUnverified = !user.emailVerifiedAt;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] select-none">
      {isEmailUnverified && (
        <div
          className="px-4 py-2 bg-amber-100 [[data-mode='dark']_&]:bg-amber-950/25 border-b border-amber-300 [[data-mode='dark']_&]:border-amber-800/50 text-center"
          role="status"
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
          if (newView === 'settings') navigate('/settings');
          else if (newView === 'theme-editor') navigate('/editor');
          else navigate('/unread');
        }}
        user={user}
        view={view}
      />

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        {view === 'links' ? (
          <LinksView />
        ) : view === 'settings' ? (
          <SettingsView />
        ) : view === 'theme-editor' ? (
          <Suspense>
            <ThemeEditor />
          </Suspense>
        ) : (
          <NotFoundView />
        )}
      </main>
    </div>
  );
}
