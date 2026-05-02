import { THEMES, type BaseTheme } from '../../theme/ThemeContext';

interface ThemeSubmenuProps {
  baseTheme: BaseTheme;
  previewTheme: string | null;
  showSubmenu: boolean;
  submenuOnLeft: boolean;
  onFlyoutMouseEnter: () => void;
  onFlyoutMouseLeave: () => void;
  onPreviewChange: (theme: BaseTheme | null) => void;
  onSelect: (theme: BaseTheme) => void;
}

export default function ThemeSubmenu({
  baseTheme,
  previewTheme,
  showSubmenu,
  submenuOnLeft,
  onFlyoutMouseEnter,
  onFlyoutMouseLeave,
  onPreviewChange,
  onSelect,
}: ThemeSubmenuProps) {
  const currentLabel =
    previewTheme && previewTheme !== baseTheme
      ? `Previewing ${THEMES.find((theme) => theme.id === previewTheme)?.label}`
      : THEMES.find((theme) => theme.id === baseTheme)?.label;

  return (
    <>
      <div
        className={`flex items-center gap-2 w-full pl-2.5 pr-3 py-2 text-[var(--text)] cursor-default ${
          showSubmenu
            ? 'bg-[var(--bg-surface)]'
            : 'hover:bg-[var(--bg-surface)]'
        }`}
      >
        <i
          className="fa-solid fa-palette text-[var(--text-muted)] text-[0.75rem]"
          aria-hidden="true"
        />
        <div className="flex-1 select-none">
          <div>Theme</div>
          <div className="mt-0.5 text-[var(--text-muted)] line-clamp-1">
            {currentLabel}
          </div>
        </div>
        <i
          className="fa-solid fa-chevron-right text-[var(--text-subtle)] text-[0.6rem]"
          aria-hidden="true"
        />
      </div>

      <div
        className={`absolute top-0 w-56 py-2 bg-[var(--bg-elevated)] shadow-black/40 shadow-lg rounded-xl z-50 ${submenuOnLeft ? 'right-[calc(100%-1px)] origin-right' : 'left-[calc(100%-1px)] origin-left'}`}
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
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer"
            key={theme.id}
            type="button"
            onClick={() => onSelect(theme.id)}
            onMouseEnter={() => {
              const root = document.documentElement;
              root.style.setProperty('--theme-transition-duration', '1s');
              root.style.setProperty('--theme-transition-easing', 'ease-in');
              root.dataset.theme = theme.id;
              onPreviewChange(theme.id);
            }}
          >
            <span
              className="shrink-0 inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: theme.accent }}
            />
            <span className="flex-1 select-none">{theme.label}</span>
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
