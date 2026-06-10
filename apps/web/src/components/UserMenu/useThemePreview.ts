import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { CVD_BASE_THEME, type BaseTheme } from '../../theme/ThemeContext';

interface UseThemePreviewResult {
  /** ref attached to the flyout `div` — pass to `ThemeSubmenu`
   * and `useMenuNavigation` so both can read its DOM node. */
  flyoutReference: RefObject<HTMLDivElement | null>;
  /**
   * Applies a live preview for `themeId`. Sets `data-theme` on the document
   * root with a fast 150ms transition. If cvd mode is on and the
   * previewed theme is not the cvd base theme, `data-cvd` is
   * temporarily cleared so the preview renders correctly; it is restored by
   * `resetPreview` when the submenu closes.
   */
  applyPreview: (themeId: BaseTheme) => void;
  /** `null` clears without animating back — use `resetPreview`
   * when the submenu closes instead. */
  handlePreviewChange: (theme: BaseTheme | null) => void;
  /** call when the pointer enters (or focus moves into) the Theme
   * row — opens the submenu and recalculates which side it
   * should open on. */
  handleThemeRowEnter: () => void;
  previewTheme: string | null;
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
  themeSubmenuOnLeft: boolean;
  /** animates the active theme back into place after the submenu
   * closes: clears the preview immediately, then applies a
   * 600ms ease-out CSS transition before restoring the original
   * theme data-attribute. */
  resetPreview: (currentBaseTheme: string) => void;
  /** cancels any in-flight preview reset rAF/timeout — call in a
   * `useLayoutEffect([baseTheme])` to prevent a stale reset from
   * overwriting the freshly committed theme. */
  clearResetHandles: () => void;
}

/**
 * Manages theme submenu visibility, live-preview state, and the RAF/timeout
 * pair that animates the preview reset. Extracted from `UserMenu` to keep
 * the component focused on rendering.
 *
 * The caller owns `flyoutReference` and passes it to both `ThemeSubmenu` and
 * `useMenuNavigation`. `submenuOpenedByKeyboard` lets the caller auto-focus
 * the first flyout item when the submenu opens via keyboard.
 */
export function useThemePreview(): UseThemePreviewResult {
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [themeSubmenuOnLeft, setThemeSubmenuOnLeft] = useState(true);

  const flyoutReference = useRef<HTMLDivElement | null>(null);
  const resetRafHandle = useRef<number | null>(null);
  const resetTransitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Stores the data-cvd value that was active when preview started
  // so resetPreview can restore it after the submenu closes.
  const previewCvdValue = useRef<string | undefined>(undefined);
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

  const clearResetHandles = useCallback(() => {
    if (resetTransitionTimeout.current) {
      clearTimeout(resetTransitionTimeout.current);
      resetTransitionTimeout.current = null;
    }
    if (resetRafHandle.current) {
      cancelAnimationFrame(resetRafHandle.current);
      resetRafHandle.current = null;
    }
  }, []);

  const resetPreview = (currentBaseTheme: string) => {
    clearResetHandles();
    setPreviewTheme(null);
    const root = document.documentElement;
    const savedsavedCvd = previewCvdValue.current;
    previewCvdValue.current = undefined;
    // Defer CSS var mutations to rAF so React re-renders first (removing the
    // Theme row highlight instantly) before the 600ms transition is applied.
    resetRafHandle.current = requestAnimationFrame(() => {
      resetRafHandle.current = null;
      root.style.setProperty('--theme-transition-duration', '600ms');
      root.style.setProperty('--theme-transition-easing', 'ease-out');
      root.dataset.theme = currentBaseTheme;
      // Restore data-cvd if it was cleared during preview
      if (savedsavedCvd !== undefined) {
        root.dataset.cvd = savedsavedCvd;
      }
      resetTransitionTimeout.current = setTimeout(() => {
        root.style.removeProperty('--theme-transition-duration');
        root.style.removeProperty('--theme-transition-easing');
        resetTransitionTimeout.current = null;
      }, 650);
    });
  };

  const applyPreview = useCallback(
    (themeId: BaseTheme) => {
      clearResetHandles();
      setPreviewTheme(themeId);
      const root = document.documentElement;
      root.style.setProperty('--theme-transition-duration', '150ms');
      root.style.setProperty('--theme-transition-easing', 'ease-out');
      root.dataset.theme = themeId;

      // If CVD mode is on and the previewed theme isn't the CVD base
      // theme, temporarily clear data-cvd so the preview looks correct.
      // resetPreview will restore it.
      const currentsavedCvd = root.dataset.cvd;

      if (
        currentsavedCvd === 'on' &&
        themeId !== CVD_BASE_THEME &&
        previewCvdValue.current === undefined
      ) {
        previewCvdValue.current = currentsavedCvd;
        delete root.dataset.cvd;
      }
    },
    [clearResetHandles],
  );

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
    applyPreview,
    clearResetHandles,
    flyoutReference,
    handlePreviewChange,
    handleThemeRowEnter,
    previewTheme,
    setShowThemeSubmenu,
    showThemeSubmenu,
    submenuOpenedByKeyboard,
    themeRowReference,
    themeSubmenuOnLeft,
    resetPreview,
  };
}
