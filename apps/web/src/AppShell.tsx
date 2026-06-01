import ErrorBoundary from './components/errors/ErrorBoundary';
import Header from './components/Header';
import LinkButton from './components/common/LinkButton';
import LinksView from './components/links/LinksView';
import SettingsView from './components/settings/SettingsView';
import { lazy, Suspense } from 'react';
import { useAppShell } from './useAppShell';

// ThemeEditor is lazy-loaded because it's rarely visited and its
// color-math utilities add non-trivial weight to the bundle.
const ThemeEditor = lazy(() => import('./components/settings/ThemeEditor'));

// ApiDocsView is lazy-loaded because Scalar's bundle is heavy (~300KB
// gzipped) and only visitors to /settings/api should pay that cost.
const ApiDocsView = lazy(() => import('./components/api-docs/ApiDocsView'));

// WelcomeModal is lazy-loaded because it shows once per user and would
// otherwise be dead weight in the initial bundle for every session.
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
  const {
    handleModeToggle,
    handleThemeSelect,
    handleUserMenuClose,
    handleUserMenuToggle,
    isDesktop,
    logout,
    mainReference,
    markWelcomed,
    navigate,
    showUserMenu,
    user,
    view,
  } = useAppShell();

  if (!user) return null;

  const isEmailUnverified = !user.emailVerifiedAt;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] select-none">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--bg-surface)] focus:text-[var(--text)] focus:text-sm focus:font-semibold focus:rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
      >
        Skip to main content
      </a>
      {isEmailUnverified && (
        <div
          className="px-4 py-2 bg-amber-100 [[data-mode='dark']_&]:bg-amber-950/25 [[data-theme='nouvelle-vague']_&]:bg-gray-100 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:bg-gray-900/30 border-b border-amber-300 [[data-mode='dark']_&]:border-amber-800/50 [[data-theme='nouvelle-vague']_&]:border-gray-300 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:border-gray-700/50 text-center"
          role="status"
        >
          <p className="text-amber-800 [[data-mode='dark']_&]:text-amber-300 [[data-theme='nouvelle-vague']_&]:text-gray-700 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-gray-400 text-xs font-medium">
            <i
              className="fa-solid fa-triangle-exclamation mr-1.5"
              aria-hidden="true"
            />
            Please verify your email address.{' '}
            <LinkButton
              className="hidden sm:inline-flex"
              onClick={() => navigate('/settings')}
            >
              Need to resend the verification email?
            </LinkButton>
          </p>
        </div>
      )}

      <Header
        isUserMenuOpen={showUserMenu}
        onUserMenuToggle={handleUserMenuToggle}
        onUserMenuClose={handleUserMenuClose}
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

      <main
        id="main-content"
        ref={mainReference}
        tabIndex={-1}
        className="max-w-3xl mx-auto px-4 py-6 sm:py-12 space-y-6 focus:outline-none"
      >
        <ErrorBoundary fallback={null} resetKey={view}>
          {view === 'api-docs' ? (
            <Suspense
              fallback={
                <p
                  aria-live="polite"
                  className="text-[var(--text-muted)] text-sm"
                >
                  Loading API docs…
                </p>
              }
            >
              <ApiDocsView />
            </Suspense>
          ) : null}
        </ErrorBoundary>

        {view === 'settings' ? (
          <SettingsView />
        ) : view === 'theme-editor' ? (
          <Suspense>
            <ThemeEditor />
          </Suspense>
        ) : view === 'api-docs' ? null : (
          <LinksView onCloseUserMenu={handleUserMenuClose} />
        )}
      </main>

      {user.welcomedAt === null && isDesktop && (
        <Suspense fallback={null}>
          <WelcomeModal onClose={markWelcomed} />
        </Suspense>
      )}
    </div>
  );
}
