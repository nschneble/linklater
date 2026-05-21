import { menuRevealStyle } from '../../lib/styles';
import { THEMES } from '../../theme/ThemeContext';
import { useState } from 'react';
import type { BaseTheme } from '../../theme/ThemeContext';
import type { RefObject } from 'react';

/**
 * Props for `ThemeSubmenu`. All hover/mouse coordination state is owned by
 * `UserMenu` and passed down. `ThemeSubmenu` only owns local hover highlight
 * state (`hoveredThemeId`) for the flyout buttons.
 */
interface ThemeSubmenuProps {
  /** The currently active base theme. */
  baseTheme: BaseTheme;
  /**
   * The theme currently being hovered for preview, or `null` when no preview
   * is active. Drives the label in the trigger row.
   */
  previewTheme: string | null;
  /** Whether the flyout submenu panel is visible. */
  showSubmenu: boolean;
  /**
   * When `true`, the flyout opens to the left of the trigger row instead of
   * the right. Computed by `UserMenu` by checking remaining viewport width.
   */
  submenuOnLeft: boolean;
  /**
   * When `true`, the trigger row is highlighted. Driven by whether the mouse
   * is anywhere within the theme row + flyout area.
   */
  isPointerOver: boolean;
  /** Called when the trigger row is clicked (on mobile / keyboard). */
  onTriggerClick: () => void;
  /**
   * Called when the trigger button loses focus to an element outside the
   * flyout panel. Lets `UserMenu` close the submenu when keyboard navigation
   * moves past the Theme row.
   */
  onTriggerBlur?: () => void;
  /**
   * Called when focus leaves the flyout panel. `relatedTarget` is the element
   * that received focus, so `UserMenu` can decide whether to close the submenu.
   */
  onFlyoutBlur?: (relatedTarget: Element | null) => void;
  /**
   * Called when the trigger is activated via keyboard. Lets `UserMenu` set
   * a flag so the submenu auto-focuses its first item on open.
   */
  onKeyboardOpen: () => void;
  /**
   * Forwarded ref attached to the flyout panel, used by `UserMenu` for
   * keyboard navigation.
   */
  flyoutReference?: RefObject<HTMLDivElement | null>;
  /**
   * Called when hovering or focusing a theme option to apply a live preview.
   * Handles setting `data-theme` on the document root and temporarily clearing
   * `data-cvd` when previewing a non-accessible theme while cvd
   * mode is active. Pass the hook's `applyPreview` here.
   */
  onApplyPreview: (theme: BaseTheme) => void;
  /** Called when the user clicks a theme option. Closes the menu. */
  onSelect: (theme: BaseTheme) => void;
}

/**
 * The theme picker row and its flyout submenu panel within the `UserMenu`.
 *
 * The trigger row shows the current theme name (or "Previewing X" while
 * hovering an option). The flyout lists all themes with color dot indicators.
 *
 * Live preview on hover: hovering a theme option immediately sets the
 * `data-theme` attribute on `document.documentElement` with a 150ms CSS
 * transition so the user can see the theme before committing. Mousing away
 * from the theme area resets the preview back to the active theme with a
 * 600ms ease-out transition.
 */
export default function ThemeSubmenu({
  baseTheme,
  previewTheme,
  showSubmenu,
  submenuOnLeft,
  isPointerOver,
  onTriggerClick,
  onKeyboardOpen,
  onApplyPreview,
  onSelect,
  onTriggerBlur,
  onFlyoutBlur,
  flyoutReference,
}: ThemeSubmenuProps) {
  const [hoveredThemeId, setHoveredThemeId] = useState<string | null>(null);

  function handleOpenOrFocusFlyout() {
    if (showSubmenu) {
      flyoutReference?.current
        ?.querySelector<HTMLElement>('[data-submenu-item]')
        ?.focus();
    } else {
      onTriggerClick();
      onKeyboardOpen();
    }
  }

  const currentLabel =
    previewTheme && previewTheme !== baseTheme
      ? `Previewing ${THEMES.find((theme) => theme.id === previewTheme)?.label}`
      : THEMES.find((theme) => theme.id === baseTheme)?.label;

  return (
    <>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={showSubmenu}
        className={`flex items-center gap-2 w-full pl-2.5 pr-3 py-2 focus-visible:bg-[var(--bg-surface)] focus:outline-none text-[var(--text)] text-left cursor-default ${
          isPointerOver ? 'bg-[var(--bg-surface)]' : ''
        }`}
        onMouseEnter={(event) => {
          event.currentTarget.focus();
        }}
        onBlur={(event) => {
          if (
            !flyoutReference?.current?.contains(event.relatedTarget as Node)
          ) {
            onTriggerBlur?.();
          }
        }}
        onClick={onTriggerClick}
        onKeyDown={(event) => {
          if (
            event.key === 'ArrowRight' ||
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            event.preventDefault();
            event.stopPropagation();
            handleOpenOrFocusFlyout();
          }
        }}
      >
        <i
          className="fa-solid fa-palette text-[var(--text-muted)] text-[0.75rem]"
          aria-hidden="true"
        />
        <div className="flex-1">
          <div>Theme</div>
          <div className="mt-0.5 text-[var(--text-muted)] line-clamp-1">
            {currentLabel}
          </div>
        </div>
        <i
          className="fa-solid fa-chevron-right text-[var(--text-subtle)] text-[0.6rem]"
          aria-hidden="true"
        />
      </button>

      <div
        ref={flyoutReference}
        role="menu"
        aria-label="Theme"
        className={`absolute top-0 z-50 w-56 py-2 bg-[var(--bg-elevated)] border-shadow rounded-lg ${submenuOnLeft ? 'right-[calc(100%-1px)] origin-right' : 'left-[calc(100%-1px)] origin-left'}`}
        inert={!showSubmenu ? true : undefined}
        style={menuRevealStyle(showSubmenu)}
        onBlur={(event) => {
          onFlyoutBlur?.(event.relatedTarget as Element | null);
        }}
      >
        {THEMES.map((theme) => (
          <button
            className={`flex items-center gap-2 w-full px-3 py-2 ${hoveredThemeId === theme.id ? 'bg-[var(--bg-surface)]' : ''} focus:outline-none text-[var(--text)] text-left cursor-pointer`}
            data-submenu-item
            role="menuitemradio"
            aria-checked={baseTheme === theme.id}
            style={{
              transitionDuration:
                '150ms, var(--theme-transition-duration), var(--theme-transition-duration)',
            }}
            key={theme.id}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(theme.id)}
            onMouseEnter={(event) => {
              setHoveredThemeId(theme.id);
              onApplyPreview(theme.id);
              event.currentTarget.focus();
            }}
            onMouseLeave={() => setHoveredThemeId(null)}
            onBlur={() => setHoveredThemeId(null)}
            onFocus={() => {
              setHoveredThemeId(theme.id);
              onApplyPreview(theme.id);
            }}
          >
            <span
              className="relative shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full theme-color-dot"
              style={{ backgroundColor: theme.accent }}
            >
              <i
                className={`absolute fa-solid ${theme.swatchIcon} text-white text-[0.6rem]`}
                aria-hidden="true"
              />
            </span>
            <span className="flex-1">{theme.label}</span>
            {baseTheme === theme.id && (
              <i
                className="fa-solid fa-check text-[var(--accent)]"
                aria-hidden="true"
              />
            )}
            {theme.isAccessible && (
              <i className="fa-solid fa-universal-access" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
    </>
  );
}
