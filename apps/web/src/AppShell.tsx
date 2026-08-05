import ErrorBoundary from './components/errors/ErrorBoundary';
import Header from './components/Header';
import { lazy, Suspense } from 'react';
import LinkButton from './components/common/LinkButton';
import LinksView from './components/links/LinksView';
import SettingsView from './components/settings/SettingsView';
import { useAppShell } from './useAppShell';

// lazy-loaded: rarely visited, its color-math is heavy in the bundle
const ThemeEditor = lazy(() => import('./components/settings/ThemeEditor'));

// lazy-loaded: shows once per user, dead weight in the initial bundle
const WelcomeModal = lazy(() => import('./components/welcome/WelcomeModal'));

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
  const shell = useAppShell();

  if (!shell.user) return null;
  const { user } = shell;

  const isEmailUnverified = !user.emailVerifiedAt;

  return (
    <div className="min-h-screen bg-[var(--base-bg)] text-[var(--base-text)] select-none">
      <a
        href="#main-content"
        inert={shell.isSaveLinkDialogOpen}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--mount-bg)] focus:text-[var(--mount-text)] focus:text-sm focus:font-semibold focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none focus:rounded-lg"
      >
        Skip to main content
      </a>
      {isEmailUnverified && (
        <div
          className="px-4 py-2 bg-[var(--warn-bg)] border-b border-[var(--warn-border)] text-center"
          role="status"
          inert={shell.isSaveLinkDialogOpen}
        >
          <p className="text-[var(--warn-text)] text-xs font-medium">
            <i
              className="fa-solid fa-triangle-exclamation mr-1.5"
              aria-hidden="true"
            />
            Please verify your email address.{' '}
            <LinkButton
              className="hidden sm:inline-flex"
              surface="warn"
              onClick={() => shell.navigate('/settings')}
            >
              Need to resend the verification email?
            </LinkButton>
          </p>
        </div>
      )}

      <Header
        inert={shell.isSaveLinkDialogOpen}
        isUserMenuOpen={shell.showUserMenu}
        onUserMenuToggle={shell.handleUserMenuToggle}
        onUserMenuClose={shell.handleUserMenuClose}
        onLogout={shell.logout}
        onModeToggle={shell.handleModeToggle}
        onThemeSelect={shell.handleThemeSelect}
        onViewChange={(newView) => {
          if (newView === 'settings') shell.navigate('/settings');
          else if (newView === 'theme-editor') shell.navigate('/editor');
          else shell.navigate('/unread');
        }}
        user={user}
        view={shell.view}
      />

      <main
        id="main-content"
        ref={shell.mainReference}
        tabIndex={-1}
        aria-label={shell.mainLabel}
        className="max-w-3xl mx-auto px-4 py-6 sm:py-12 space-y-6 focus:outline-none"
      >
        <ErrorBoundary fallback={null} resetKey={shell.view}>
          {shell.view === 'settings' ? (
            <SettingsView />
          ) : shell.view === 'theme-editor' ? (
            <Suspense>
              <ThemeEditor />
            </Suspense>
          ) : (
            <LinksView
              onCloseUserMenu={shell.handleUserMenuClose}
              onLinkFormOpenChange={shell.handleLinkFormOpenChange}
            />
          )}
        </ErrorBoundary>
      </main>

      {user.welcomedAt === null && shell.isDesktop && (
        <Suspense fallback={null}>
          <WelcomeModal onClose={shell.markWelcomed} />
        </Suspense>
      )}
    </div>
  );
}
