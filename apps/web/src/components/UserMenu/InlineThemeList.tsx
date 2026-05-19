import { THEMES, type BaseTheme } from '../../theme/ThemeContext';

interface InlineThemeListProps {
  baseTheme: BaseTheme;
  onSelect: (theme: BaseTheme) => void;
}

/**
 * Flat list of theme buttons for the mobile menu. Does not implement live
 * preview on hover because mobile devices have no reliable hover state and the
 * mobile menu closes immediately on selection anyway.
 *
 * The "Theme" label and ARIA grouping (`role="group"` + `aria-labelledby`) are
 * provided by the enclosing `MenuSection` in `MobileMenuPanel`.
 */
export default function InlineThemeList({
  baseTheme,
  onSelect,
}: InlineThemeListProps) {
  return (
    <>
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          role="menuitemradio"
          aria-checked={baseTheme === theme.id}
          className="flex items-center gap-3 w-full px-4 py-3 text-[var(--text)] text-sm text-left cursor-pointer focus:bg-[var(--bg-surface)] focus:outline-none"
          onClick={() => onSelect(theme.id)}
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
    </>
  );
}
