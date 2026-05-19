import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { BaseTheme } from '../../theme/ThemeContext';

interface UseThemePreviewResult {
  flyoutReference: RefObject<HTMLDivElement | null>;
  handlePreviewChange: (theme: BaseTheme | null) => void;
  handleThemeRowEnter: () => void;
  isThemeAreaPointerOver: boolean;
  previewTheme: string | null;
  setIsThemeAreaPointerOver: (value: boolean) => void;
  setShowThemeSubmenu: (value: boolean) => void;
  showThemeSubmenu: boolean;
  submenuOpenedByKeyboard: MutableRefObject<boolean>;
  themeRowReference: RefObject<HTMLDivElement | null>;
  themeSubmenuOnLeft: boolean;
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

  const resetPreview = (currentBaseTheme: string) => {
    if (resetTransitionTimeout.current) {
      clearTimeout(resetTransitionTimeout.current);
      resetTransitionTimeout.current = null;
    }
    if (resetRafHandle.current) {
      cancelAnimationFrame(resetRafHandle.current);
    }
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
    if (resetTransitionTimeout.current) {
      clearTimeout(resetTransitionTimeout.current);
      resetTransitionTimeout.current = null;
    }
    if (resetRafHandle.current) {
      cancelAnimationFrame(resetRafHandle.current);
      resetRafHandle.current = null;
    }
    setPreviewTheme(theme);
  };

  const handleThemeRowEnter = () => {
    if (resetRafHandle.current) {
      cancelAnimationFrame(resetRafHandle.current);
      resetRafHandle.current = null;
    }
    if (themeRowReference.current) {
      const rect = themeRowReference.current.getBoundingClientRect();
      // submenu is w-56 (224px) + an 8px safety margin
      setThemeSubmenuOnLeft(rect.right + 224 + 8 > window.innerWidth);
    }
    setShowThemeSubmenu(true);
  };

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
