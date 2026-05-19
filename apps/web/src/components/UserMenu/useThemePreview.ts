import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { BaseTheme } from '../../theme/ThemeContext';

interface UseThemePreviewResult {
  /** ref attached to the flyout `div` — pass to `ThemeSubmenu`
   * and `useMenuNavigation` so both can read its DOM node. */
  flyoutReference: RefObject<HTMLDivElement | null>;
  /** call with a `BaseTheme` value to show a live preview, or
   * `null` to clear without animating back (use `resetPreview`
   * instead when the submenu closes). */
  handlePreviewChange: (theme: BaseTheme | null) => void;
  /** call when the pointer enters (or focus moves into) the Theme
   * row — opens the submenu and recalculates which side it
   * should open on. */
  handleThemeRowEnter: () => void;
  /** true while the pointer is anywhere inside the Theme row or
   * flyout area; used by the caller to suppress premature
   * submenu close on mouse-leave. */
  isThemeAreaPointerOver: boolean;
  /** the theme id currently being previewed, or `null` when no
   * preview is active. */
  previewTheme: string | null;
  setIsThemeAreaPointerOver: (value: boolean) => void;
  setShowThemeSubmenu: (value: boolean) => void;
  showThemeSubmenu: boolean;
  /** set to `true` before opening the submenu via a keyboard
   * action; the hook's internal effect will auto-focus the
   * first flyout item and then reset this flag. */
  submenuOpenedByKeyboard: MutableRefObject<boolean>;
  /** ref attached to the Theme row `div` — used to measure the
   * row's position so the submenu can decide whether to open
   * left or right of the trigger. */
  themeRowReference: RefObject<HTMLDivElement | null>;
  /** true when the submenu should open to the left because there
   * is insufficient room on the right side of the viewport. */
  themeSubmenuOnLeft: boolean;
  /** animates the active theme back into place after the submenu
   * closes: clears the preview immediately, then applies a
   * 600ms ease-out CSS transition before restoring the original
   * theme data-attribute. */
  resetPreview: (currentBaseTheme: string) => void;
}

/**
 * Manages theme submenu visibility, live-preview state, and the RAF/timeout
 * pair that animates the preview reset. Extracted from `UserMenu` to keep
 * the component focused on rendering.
 *
 * The caller owns `flyoutReference` and passes it to both `ThemeSubmenu` and
 * `useMenuNavigation`. `submenuOpenedByKeyboard` lets the caller auto-focus
 * the first flyout item when the submenu opens via keyboard.
 * @returns `UseThemePreviewResult` — refs, state values, state
 *   setters, and the two event handlers (`handlePreviewChange`,
 *   `handleThemeRowEnter`) that drive the submenu and live-preview
 *   lifecycle. See the interface for per-member descriptions.
 */
export function useThemePreview(): UseThemePreviewResult {
  const [isThemeAreaPointerOver, setIsThemeAreaPointerOver] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [themeSubmenuOnLeft, setThemeSubmenuOnLeft] = useState(true);

  const flyoutReference = useRef<HTMLDivElement | null>(null);
  const resetRafHandle = useRef<number | null>(null);
  const resetTransitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const submenuOpenedByKeyboard = useRef(false);
  const themeRowReference = useRef<HTMLDivElement | null>(null);

  // auto-focuses first flyout item when submenu opens via keyboard
  useEffect(() => {
    if (!showThemeSubmenu || !submenuOpenedByKeyboard.current) return;
    submenuOpenedByKeyboard.current = false;
    const firstItem = flyoutReference.current?.querySelector<HTMLElement>(
      '[data-submenu-item]',
    );
    firstItem?.focus();
  }, [showThemeSubmenu]);

  function clearResetHandles() {
    if (resetTransitionTimeout.current) {
      clearTimeout(resetTransitionTimeout.current);
      resetTransitionTimeout.current = null;
    }
    if (resetRafHandle.current) {
      cancelAnimationFrame(resetRafHandle.current);
      resetRafHandle.current = null;
    }
  }

  const resetPreview = (currentBaseTheme: string) => {
    clearResetHandles();
    setPreviewTheme(null);
    const root = document.documentElement;
    // Defer CSS var mutations to rAF so React re-renders first (removing the
    // Theme row highlight instantly) before the 600ms transition is applied.
    resetRafHandle.current = requestAnimationFrame(() => {
      resetRafHandle.current = null;
      root.style.setProperty('--theme-transition-duration', '600ms');
      root.style.setProperty('--theme-transition-easing', 'ease-out');
      root.dataset.theme = currentBaseTheme;
      resetTransitionTimeout.current = setTimeout(() => {
        root.style.removeProperty('--theme-transition-duration');
        root.style.removeProperty('--theme-transition-easing');
        resetTransitionTimeout.current = null;
      }, 650);
    });
  };

  const handlePreviewChange = (theme: BaseTheme | null) => {
    clearResetHandles();
    setPreviewTheme(theme);
  };

  const handleThemeRowEnter = () => {
    clearResetHandles();
    if (themeRowReference.current) {
      const rect = themeRowReference.current.getBoundingClientRect();
      // submenu is w-56 (224px) + an 8px safety margin
      setThemeSubmenuOnLeft(rect.right + 224 + 8 > window.innerWidth);
    }
    setShowThemeSubmenu(true);
  };

  useEffect(() => {
    return () => {
      if (resetRafHandle.current) {
        cancelAnimationFrame(resetRafHandle.current);
      }
      if (resetTransitionTimeout.current) {
        clearTimeout(resetTransitionTimeout.current);
      }
    };
  }, []);

  return {
    flyoutReference,
    handlePreviewChange,
    handleThemeRowEnter,
    isThemeAreaPointerOver,
    previewTheme,
    setIsThemeAreaPointerOver,
    setShowThemeSubmenu,
    showThemeSubmenu,
    submenuOpenedByKeyboard,
    themeRowReference,
    themeSubmenuOnLeft,
    resetPreview,
  };
}
