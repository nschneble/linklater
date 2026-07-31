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
  // inert chrome outside the dialog so it stays modal (WCAG 2.4.3/4.1.2)
  const [isSaveLinkDialogOpen, setIsSaveLinkDialogOpen] = useState(false);
  // welcome modal pitches the bookmarklet; gate to desktop (no drag on touch)
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
  const handleLinkFormOpenChange = useCallback(
    (isOpen: boolean) => setIsSaveLinkDialogOpen(isOpen),
    [],
  );

  // optimistic: switch theme now, save to the server after
  const handleThemeSelect = (theme: BaseTheme) => {
    setBaseTheme(theme);
    updateMe({ theme }).catch((error) =>
      console.error('Failed to save theme', error),
    );
  };

  // derive next mode from user.mode not ThemeContext to stay auth-synced
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

  // focus <main> on route change, not first load (would skip the skip link)
  // and not on a Settings scrollTo intent (SettingsView focuses the section)
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

  // global 'x' toggles the user menu; gated by shortcuts pref (WCAG 2.1.4)
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
    handleLinkFormOpenChange,
    handleModeToggle,
    handleThemeSelect,
    handleUserMenuClose,
    handleUserMenuToggle,
    isDesktop,
    isSaveLinkDialogOpen,
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
