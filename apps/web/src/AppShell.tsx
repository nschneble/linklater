import Header from './components/Header';
import LinkButton from './components/common/LinkButton';
import LinksView from './components/links/LinksView';
import SettingsView from './components/settings/SettingsView';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { updateMe } from './lib/api';
import { useAuth } from './auth/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme, type BaseTheme } from './theme/ThemeContext';
import { type AppView } from './lib/navigation';

// ThemeEditor is lazy-loaded because it's rarely visited and its
// color-math utilities add non-trivial weight to the bundle.
const ThemeEditor = lazy(() => import('./components/settings/ThemeEditor'));

// ApiDocsView is lazy-loaded because Scalar's bundle is heavy (~300KB
// gzipped) and only visitors to /settings/api should pay that cost.
const ApiDocsView = lazy(() => import('./components/api-docs/ApiDocsView'));

// WelcomeModal is lazy-loaded because it shows once per user and would
// otherwise be dead weight in the initial bundle for every session.
const WelcomeModal = lazy(() => import('./components/welcome/WelcomeModal'));

/** Maps the current URL pathname to the active `AppView`. */
function viewFromPath(pathname: string): AppView {
  switch (pathname) {
    case '/settings':
      return 'settings';
    case '/settings/api':
      return 'api-docs';
    case '/editor':
      return 'theme-editor';
    default:
      return 'links';
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
  const { logout, markWelcomed, user } = useAuth();
  const { setBaseTheme, toggleMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const view = viewFromPath(location.pathname);
  const mainReference = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  // The WelcomeModal pitches the bookmarklet, which can't be dragged to a
  // bookmarks bar on touch devices. Gate it to >=md viewports so mobile
  // users aren't shown irrelevant onboarding. A user who first lands on
  // mobile will see it the next time they visit on desktop, since
  // `markWelcomed` only fires when the modal is dismissed.
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px)').matches
      : true,
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) =>
      setIsDesktop(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleUserMenuToggle = useCallback(
    () => setShowUserMenu((open) => !open),
    [],
  );
  const handleUserMenuClose = useCallback(() => setShowUserMenu(false), []);

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

  useEffect(() => {
    const titles: Record<AppView, string> = {
      'api-docs': 'API documentation – Linklater',
      links: 'Your links – Linklater',
      settings: 'Settings – Linklater',
      'theme-editor': 'Theme editor – Linklater',
    };
    document.title = titles[view];
  }, [view]);

  // Move focus to the main landmark whenever the user navigates between
  // views. The isFirstRender guard prevents stealing focus on the
  // initial page load — on mount the browser has not set focus anywhere
  // meaningful yet, so moving it to <main> would skip the skip link and
  // surprise keyboard users who land tabbed into the page header. Skip
  // the focus shift when the URL carries a hash, because the destination
  // view is about to deep-link focus to a specific section and we'd
  // otherwise steal focus right back to <main>.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (location.hash) return;
    mainReference.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

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
        {view === 'settings' ? (
          <SettingsView />
        ) : view === 'theme-editor' ? (
          <Suspense>
            <ThemeEditor />
          </Suspense>
        ) : view === 'api-docs' ? (
          <Suspense>
            <ApiDocsView />
          </Suspense>
        ) : (
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
