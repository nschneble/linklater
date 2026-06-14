import { CVD_BASE_THEME, THEMES } from '../../theme/ThemeContext';
import { FOCUS_RING, menuRevealStyle } from '../../lib/styles';
import { useTheme } from '../../theme/ThemeContext';
import type { BaseTheme } from '../../theme/ThemeContext';
import type { RefObject } from 'react';

/**
 * Props for `ThemeSubmenu`. Submenu visibility + preview state are owned by
 * `UserMenu` and passed down.
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
  onTriggerClick,
  onKeyboardOpen,
  onApplyPreview,
  onSelect,
  onTriggerBlur,
  onFlyoutBlur,
  flyoutReference,
}: ThemeSubmenuProps) {
  const { isCvdMode } = useTheme();

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
        className={`group flex items-center gap-2 w-full pl-2.5 pr-3 py-2 hover:bg-[var(--orbit-highlight)]/80 border-y border-transparent hover:border-[var(--orbit-highlight-hover)]/80 text-[var(--orbit-text)] hover:text-[var(--orbit-highlight-fg)] text-left ${FOCUS_RING} cursor-default`}
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
          className="fa-solid fa-palette text-[var(--orbit-alt-text)] group-hover:text-[var(--orbit-highlight-fg)]/80 text-[0.75rem] motion-safe:[transition:color_40ms]"
          aria-hidden="true"
        />
        <div className="flex-1">
          <div className="text-[var(--orbit-text)] group-hover:text-[var(--orbit-highlight-fg)] motion-safe:[transition:color_80ms]">
            Theme
          </div>
          <div className="mt-0.5 text-[var(--orbit-alt-text)] group-hover:text-[var(--orbit-highlight-fg)]/80 line-clamp-1 motion-safe:[transition:color_80ms]">
            {currentLabel}
          </div>
        </div>
        <i
          className="fa-solid fa-chevron-right text-[var(--orbit-alt-text)] group-hover:text-[var(--orbit-highlight-fg)]/80 text-[0.6rem] motion-safe:[transition:color_40ms]"
          aria-hidden="true"
        />
      </button>

      <div
        ref={flyoutReference}
        role="menu"
        aria-label="Theme"
        className={`absolute top-0 z-50 w-56 py-2 bg-[var(--orbit-bg)] border-shadow rounded-lg ${submenuOnLeft ? 'right-[calc(100%-1px)] origin-right' : 'left-[calc(100%-1px)] origin-left'}`}
        inert={!showSubmenu ? true : undefined}
        style={menuRevealStyle(showSubmenu)}
        onBlur={(event) => {
          onFlyoutBlur?.(event.relatedTarget as Element | null);
        }}
      >
        {THEMES.map((theme) => {
          const isDisabled = isCvdMode && theme.id !== CVD_BASE_THEME;
          return (
            <button
              className={`group flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--orbit-highlight)]/80 border-y border-transparent hover:border-[var(--orbit-highlight-hover)]/80 text-[var(--orbit-text)] hover:text-[var(--orbit-highlight-fg)] text-left ${FOCUS_RING} cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
              data-submenu-item
              role="menuitemradio"
              aria-checked={baseTheme === theme.id}
              aria-disabled={isDisabled ? 'true' : undefined}
              key={theme.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (isDisabled) return;
                onSelect(theme.id);
              }}
              onMouseEnter={(event) => {
                if (!isDisabled) {
                  onApplyPreview(theme.id);
                  event.currentTarget.focus();
                }
              }}
              onFocus={() => {
                if (!isDisabled) {
                  onApplyPreview(theme.id);
                }
              }}
            >
              <span className="relative shrink-0 inline-flex items-center justify-center w-3.75 h-3.75 bg-[var(--orbit-alt-text)] group-hover:bg-[var(--orbit-highlight-fg)]/80 rounded-full">
                <i
                  className={`absolute fa-solid ${theme.swatchIcon} text-[var(--orbit-bg)] group-hover:text-[var(--orbit-highlight)]/80 text-[0.5rem]`}
                  aria-hidden="true"
                />
              </span>
              <span className="flex-1">{theme.label}</span>
              {baseTheme === theme.id && (
                <i
                  className="fa-solid fa-check text-[var(--orbit-highlight)] group-hover:text-[var(--orbit-highlight-fg)]"
                  aria-hidden="true"
                />
              )}
              {theme.isAccessible && (
                <>
                  <i
                    className="fa-solid fa-universal-access"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Accessible theme</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
