import { FOCUS_RING } from '../../lib/styles';
import {
  customThemeSrSuffix,
  isCustomThemeConfigured,
} from '../../theme/customTheme';
import {
  pickerThemes,
  useTheme,
  type BaseTheme,
} from '../../theme/ThemeContext';

interface InlineThemeListProps {
  baseTheme: BaseTheme;
  onSelect: (theme: BaseTheme) => void;
}

/**
 * Flat list of theme buttons for the mobile menu. Does not implement live
 * preview on hover because mobile devices have no reliable hover state and the
 * mobile menu closes immediately on selection anyway.
 *
 * The `role="menu"` host and its `aria-label="Theme"` are provided by the
 * enclosing `BottomSheetThemeSubmenu`; the buttons here are its
 * `menuitemradio` children.
 */
export default function InlineThemeList({
  baseTheme,
  onSelect,
}: InlineThemeListProps) {
  const { customTheme, customThemeEnabled } = useTheme();
  const isCustomConfigured = isCustomThemeConfigured(customTheme);
  const visibleThemes = pickerThemes(baseTheme, customThemeEnabled);

  return (
    <>
      {visibleThemes.map((theme) => (
        <button
          key={theme.id}
          type="button"
          role="menuitemradio"
          aria-checked={baseTheme === theme.id}
          className={`flex items-center gap-3 w-full px-4 py-3 text-[var(--orbit-text)] text-left ${FOCUS_RING} cursor-pointer`}
          onClick={() => onSelect(theme.id)}
        >
          <span
            className="relative shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full"
            style={{ backgroundColor: theme.accent }}
          >
            <i
              className={`absolute fa-solid ${theme.swatchIcon} text-white text-[0.6rem]`}
              aria-hidden="true"
            />
          </span>
          <span className="flex-1">
            {theme.label}
            {theme.id === 'custom' && (
              <span className="sr-only">
                {customThemeSrSuffix(isCustomConfigured)}
              </span>
            )}
          </span>
          {baseTheme === theme.id && (
            <i
              className="fa-solid fa-check text-[var(--orbit-highlight)]"
              aria-hidden="true"
            />
          )}
          {theme.isAccessible && (
            <>
              <i className="fa-solid fa-universal-access" aria-hidden="true" />
              <span className="sr-only">Accessible theme</span>
            </>
          )}
        </button>
      ))}
    </>
  );
}
