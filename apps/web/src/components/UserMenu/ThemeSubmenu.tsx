import { THEMES, type BaseTheme } from '../../theme/ThemeContext';
import { useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Props for `ThemeSubmenu`. All hover/mouse coordination state is owned by
 * `UserMenu` and passed down so that `ThemeSubmenu` remains stateless.
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
  /** Called when the mouse enters the flyout panel — cancels any pending hide timeout. */
  onFlyoutMouseEnter: () => void;
  /** Called when the mouse leaves the flyout panel — schedules a hide. */
  onFlyoutMouseLeave: () => void;
  /** Called when the mouse enters the trigger row item — cancels any pending hide timeout. */
  onThemeRowItemEnter: () => void;
  /** Called when the trigger row is clicked (on mobile / keyboard). */
  onTriggerClick: () => void;
  /**
   * Called when the trigger is activated via keyboard. Lets `UserMenu` set
   * a flag so the submenu auto-focuses its first item on open.
   */
  onKeyboardOpen: () => void;
  /**
   * Forwarded ref attached to the flyout panel, used by `UserMenu` for
   * keyboard navigation.
   */
  flyoutRef?: RefObject<HTMLDivElement | null>;
  /** Called with the hovered theme id while hovering, or `null` when leaving the flyout. */
  onPreviewChange: (theme: BaseTheme | null) => void;
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
 * transition so the user can see the theme before committing. Moving the mouse
 * away (with an 80ms grace period via a setTimeout in `UserMenu`) resets the
 * preview back to the active theme with a 600ms ease-out transition.
 */
export default function ThemeSubmenu({
  baseTheme,
  previewTheme,
  showSubmenu,
  submenuOnLeft,
  onFlyoutMouseEnter,
  onFlyoutMouseLeave,
  onThemeRowItemEnter,
  onTriggerClick,
  onKeyboardOpen,
  onPreviewChange,
  onSelect,
  flyoutRef,
}: ThemeSubmenuProps) {
  const mouseIsOver = useRef(false);
  const [hoveredThemeId, setHoveredThemeId] = useState<string | null>(null);
  const [triggerIsPointerOver, setTriggerIsPointerOver] = useState(false);

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
        className={`flex items-center gap-2 w-full pl-2.5 pr-3 py-2 focus:bg-[var(--bg-surface)] focus:outline-none text-[var(--text)] text-left cursor-default ${
          showSubmenu || triggerIsPointerOver ? 'bg-[var(--bg-surface)]' : ''
        }`}
        onMouseEnter={(event) => {
          mouseIsOver.current = true;
          setTriggerIsPointerOver(true);
          event.currentTarget.focus();
          onThemeRowItemEnter();
        }}
        onMouseLeave={() => {
          mouseIsOver.current = false;
          setTriggerIsPointerOver(false);
        }}
        onBlur={() => setTriggerIsPointerOver(false)}
        onFocus={() => {
          if (!mouseIsOver.current && !showSubmenu) {
            onTriggerClick();
          }
        }}
        onClick={onTriggerClick}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            if (showSubmenu) {
              flyoutRef?.current
                ?.querySelector<HTMLElement>('[data-submenu-item]')
                ?.focus();
            } else {
              onTriggerClick();
              onKeyboardOpen();
            }
          } else if (event.key === 'Enter' || event.key === ' ') {
            if (showSubmenu) {
              flyoutRef?.current
                ?.querySelector<HTMLElement>('[data-submenu-item]')
                ?.focus();
            } else {
              onKeyboardOpen();
            }
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
        ref={flyoutRef}
        className={`absolute top-0 z-50 w-56 py-2 bg-[var(--bg-elevated)] border-shadow rounded-lg ${submenuOnLeft ? 'right-[calc(100%-1px)] origin-right' : 'left-[calc(100%-1px)] origin-left'}`}
        style={{
          transition: `opacity ${showSubmenu ? '150ms ease-out' : '100ms ease-in'}, transform ${showSubmenu ? '150ms ease-out' : '100ms ease-in'}`,
          opacity: showSubmenu ? 1 : 0,
          transform: showSubmenu ? 'scale(1)' : 'scale(0.95)',
          pointerEvents: showSubmenu ? 'auto' : 'none',
        }}
        onMouseEnter={onFlyoutMouseEnter}
        onMouseLeave={onFlyoutMouseLeave}
      >
        {THEMES.map((theme) => (
          <button
            className={`flex items-center gap-2 w-full px-3 py-2 ${hoveredThemeId === theme.id ? 'bg-[var(--bg-surface)]' : ''} focus:bg-[var(--bg-surface)] focus:outline-none text-[var(--text)] text-left cursor-pointer`}
            data-submenu-item
            style={{
              transitionDuration:
                '150ms, var(--theme-transition-duration), var(--theme-transition-duration)',
            }}
            key={theme.id}
            type="button"
            onClick={() => onSelect(theme.id)}
            onMouseEnter={(event) => {
              setHoveredThemeId(theme.id);
              event.currentTarget.focus();
            }}
            onMouseLeave={() => setHoveredThemeId(null)}
            onBlur={() => setHoveredThemeId(null)}
            onFocus={() => {
              const root = document.documentElement;
              root.style.setProperty('--theme-transition-duration', '150ms');
              root.style.setProperty('--theme-transition-easing', 'ease-out');
              root.dataset.theme = theme.id;
              onPreviewChange(theme.id);
            }}
          >
            <span
              className="shrink-0 inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: theme.accent }}
            />
            <span className="flex-1">{theme.label}</span>
            {baseTheme === theme.id && (
              <i
                className="fa-solid fa-check text-[var(--accent)] text-[0.6rem]"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
    </>
  );
}
