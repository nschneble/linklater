import { THEMES, type BaseTheme } from '../../theme/ThemeContext';

interface InlineThemeListProps {
  baseTheme: BaseTheme;
  onSelect: (theme: BaseTheme) => void;
}

export default function InlineThemeList({
  baseTheme,
  onSelect,
}: InlineThemeListProps) {
  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-tight font-semibold">
        Theme
      </p>
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          role="menuitem"
          className="flex items-center gap-3 w-full px-4 py-3 text-[var(--text)] text-sm text-left cursor-pointer active:bg-[var(--bg-surface)]"
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
    </div>
  );
}
