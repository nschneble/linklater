import { CVD_BASE_THEME, type BaseTheme } from '../../theme/ThemeContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

interface UseThemePreviewResult {
  /** ref attached to the flyout `div` – pass to `ThemeSubmenu`
   * and `useMenuNavigation` so both can read its DOM node. */
  flyoutReference: RefObject<HTMLDivElement | null>;
  /**
   * Previews `themeId` through the theme context, over a fast 150ms
   * transition. With cvd mode on and the previewed theme not the cvd
   * base theme, `data-cvd` is borrowed until `resetPreview` returns it.
   */
  applyPreview: (themeId: BaseTheme) => void;
  /** call when the pointer enters (or focus moves into) the Theme
   * row – opens the submenu and recalculates which side it
   * should open on. */
  handleThemeRowEnter: () => void;
  setShowThemeSubmenu: (value: boolean) => void;
  showThemeSubmenu: boolean;
  /** set to `true` before opening the submenu via a keyboard
   * action; the hook's internal effect will auto-focus the
   * first flyout item and then reset this flag. */
  submenuOpenedByKeyboard: MutableRefObject<boolean>;
  /** ref attached to the Theme row `div` – used to measure the
   * row's position so the submenu can decide whether to open
   * left or right of the trigger. */
  themeRowReference: RefObject<HTMLDivElement | null>;
  themeSubmenuOnLeft: boolean;
  /** animates the active theme back into place: gives back any
   * borrowed `data-cvd`, then clears the preview over a 600ms
   * ease-out transition. */
  resetPreview: () => void;
}

/**
 * Manages theme submenu visibility and the live preview, which is the
 * context's to paint: this hook moves `setPreviewTheme` and never writes
 * `data-theme` or the custom-theme tokens itself. It owns the transition
 * timing and the `data-cvd` it borrows while a non-CVD theme is previewed.
 */
export function useThemePreview(
  setPreviewTheme: (theme: BaseTheme | null) => void,
): UseThemePreviewResult {
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [themeSubmenuOnLeft, setThemeSubmenuOnLeft] = useState(true);

  const flyoutReference = useRef<HTMLDivElement | null>(null);
  const resetTransitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // data-cvd as it stood at preview start, for resetPreview to return
  const borrowedCvdValue = useRef<string | undefined>(undefined);
  const submenuOpenedByKeyboard = useRef(false);
  const themeRowReference = useRef<HTMLDivElement | null>(null);

  // keeps the preview callbacks stable across a context re-render
  const setPreviewThemeReference = useRef(setPreviewTheme);
  setPreviewThemeReference.current = setPreviewTheme;

  // auto-focuses first flyout item when submenu opens via keyboard
  useEffect(() => {
    if (!showThemeSubmenu || !submenuOpenedByKeyboard.current) return;
    submenuOpenedByKeyboard.current = false;
    const firstItem = flyoutReference.current?.querySelector<HTMLElement>(
      '[data-submenu-item]',
    );
    firstItem?.focus();
  }, [showThemeSubmenu]);

  // only ever clears a transition this hook scheduled, never the mode's
  const endResetTransition = useCallback(() => {
    if (!resetTransitionTimeout.current) return;
    clearTimeout(resetTransitionTimeout.current);
    resetTransitionTimeout.current = null;
    const root = document.documentElement;
    root.style.removeProperty('--theme-transition-duration');
    root.style.removeProperty('--theme-transition-easing');
  }, []);

  const returnBorrowedCvd = useCallback(() => {
    const borrowed = borrowedCvdValue.current;
    if (borrowed === undefined) return;
    document.documentElement.dataset.cvd = borrowed;
    borrowedCvdValue.current = undefined;
  }, []);

  const applyPreview = useCallback(
    (themeId: BaseTheme) => {
      endResetTransition();
      const root = document.documentElement;
      root.style.setProperty('--theme-transition-duration', '150ms');
      root.style.setProperty('--theme-transition-easing', 'ease-out');

      if (
        root.dataset.cvd === 'on' &&
        themeId !== CVD_BASE_THEME &&
        borrowedCvdValue.current === undefined
      ) {
        borrowedCvdValue.current = root.dataset.cvd;
        delete root.dataset.cvd;
      }

      setPreviewThemeReference.current(themeId);
    },
    [endResetTransition],
  );

  const resetPreview = useCallback(() => {
    endResetTransition();
    returnBorrowedCvd();
    // set before clearing, or the return runs at the preview's 150ms
    const root = document.documentElement;
    root.style.setProperty('--theme-transition-duration', '600ms');
    root.style.setProperty('--theme-transition-easing', 'ease-out');
    setPreviewThemeReference.current(null);

    resetTransitionTimeout.current = setTimeout(() => {
      root.style.removeProperty('--theme-transition-duration');
      root.style.removeProperty('--theme-transition-easing');
      resetTransitionTimeout.current = null;
    }, 650);
  }, [endResetTransition, returnBorrowedCvd]);

  const handleThemeRowEnter = () => {
    if (themeRowReference.current) {
      const rect = themeRowReference.current.getBoundingClientRect();
      // submenu is w-56 (224px) + an 8px safety margin
      setThemeSubmenuOnLeft(rect.right + 224 + 8 > window.innerWidth);
    }
    setShowThemeSubmenu(true);
  };

  useEffect(() => {
    return () => {
      endResetTransition();
      returnBorrowedCvd();
      setPreviewThemeReference.current(null);
    };
  }, [endResetTransition, returnBorrowedCvd]);

  return {
    applyPreview,
    flyoutReference,
    handleThemeRowEnter,
    setShowThemeSubmenu,
    showThemeSubmenu,
    submenuOpenedByKeyboard,
    themeRowReference,
    themeSubmenuOnLeft,
    resetPreview,
  };
}
