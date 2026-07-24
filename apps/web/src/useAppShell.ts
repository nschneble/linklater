import { updateMe } from './lib/api';
import { useAuth } from './auth/AuthContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useShortcutsEnabled } from './lib/hooks/useShortcutsEnabled';
import { useTheme, type BaseTheme } from './theme/ThemeContext';
import { type AppView } from './lib/navigation';

/**
 * Maps the current URL pathname to the active `AppView`.
 *
 * `/settings` renders the settings view; sections within it are reached by
 * scrolling or the in-page sidebar nav, not by URL. The API docs are a
 * standalone public route (`/docs`) handled outside `AppShell` entirely, so
 * they do not appear here.
 */
function viewFromPath(pathname: string): AppView {
  if (pathname === '/settings') return 'settings';
  if (pathname === '/editor') return 'theme-editor';
  return 'links';
}

/**
 * The per-view label shared by the document title and the `<main>` landmark's
 * `aria-label`. The single `<main>` hosts every view, so the skip link that
 * lands focus on it must announce the active view (WCAG 2.4.6) rather than a
 * hard-coded "Links". The `links` value matches the `LinksView` heading text.
 */
const VIEW_LABELS: Record<AppView, string> = {
  links: 'Your links',
  settings: 'Settings',
  'theme-editor': 'Theme editor',
};

/**
 * Controller hook for `AppShell`. Owns the URL-derived view, user-menu open
 * state, desktop-viewport gate, optimistic theme/mode persistence, and the
 * document-title, route-change focus, and global `x`-shortcut effects. The
 * view consumes the returned values + `mainReference` and renders pure JSX.
 */
export function useAppShell() {
  const { logout, markWelcomed, user } = useAuth();
  const { setBaseTheme, toggleMode } = useTheme();
  const shortcutsEnabled = useShortcutsEnabled();
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

  const mainLabel = VIEW_LABELS[view];

  useEffect(() => {
    document.title = `Linklater – ${VIEW_LABELS[view]}`;
  }, [view]);

  // Move focus to the main landmark whenever the user navigates between
  // views. The isFirstRender guard prevents stealing focus on the
  // initial page load – on mount the browser has not set focus anywhere
  // meaningful yet, so moving it to <main> would skip the skip link and
  // surprise keyboard users who land tabbed into the page header. Skip
  // the focus shift when a navigation into Settings carries a `scrollTo`
  // intent (e.g. the welcome modal jumping to the bookmarks section),
  // because `SettingsView` is about to move focus to that section and we'd
  // otherwise steal it right back to <main>. Plain `/settings` still
  // focuses <main>.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const hasSettingsScrollIntent =
      view === 'settings' &&
      Boolean((location.state as { scrollTo?: string } | null)?.scrollTo);
    if (hasSettingsScrollIntent) return;
    mainReference.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Global 'x' shortcut to open/close the user menu from anywhere. Respects
  // the same keyboard-shortcuts preference as the links-view handlers, so
  // disabling shortcuts in Settings turns this off too (WCAG 2.1.4); without
  // it, 'x' would stay live while the rest were off.
  useEffect(() => {
    if (!shortcutsEnabled) return;

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
  }, [shortcutsEnabled]);

  return {
    handleModeToggle,
    handleThemeSelect,
    handleUserMenuClose,
    handleUserMenuToggle,
    isDesktop,
    logout,
    mainLabel,
    mainReference,
    markWelcomed,
    navigate,
    showUserMenu,
    user,
    view,
  };
}
