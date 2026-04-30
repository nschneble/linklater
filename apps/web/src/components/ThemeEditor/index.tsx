import {
  THEMES,
  useTheme,
  type BaseTheme,
  type Mode,
} from '../../theme/ThemeContext';
import ColorEditor from './ColorEditor';
import ComponentShowcase from './ComponentShowcase';
import ContrastChecker from './ContrastChecker';
import { useThemeOverrides } from './useThemeOverrides';

export default function ThemeEditor() {
  const { baseTheme, mode, setBaseTheme, setMode } = useTheme();
  const { colorValues, setOverride, resetOverrides } = useThemeOverrides();

  function handleThemeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setBaseTheme(event.target.value as BaseTheme);
  }

  function handleModeToggle(nextMode: Mode) {
    setMode(nextMode);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start gap-3 mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-[var(--text)]">
            Theme editor
          </h1>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">
            Edit color variables and see changes live. Resets when you navigate
            away.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={baseTheme}
            onChange={handleThemeChange}
            className="px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-transparent cursor-pointer"
            aria-label="Select theme"
          >
            {THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>

          <div
            className="relative inline-flex p-0.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-full"
            role="group"
            aria-label="Color mode"
          >
            {(['dark', 'light'] as Mode[]).map((modeOption) => (
              <button
                key={modeOption}
                type="button"
                onClick={() => handleModeToggle(modeOption)}
                className={`relative z-10 px-2.5 py-1 rounded-full text-xs capitalize transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
                  mode === modeOption
                    ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
                    : 'text-[var(--text-muted)] cursor-pointer'
                }`}
                aria-pressed={mode === modeOption}
              >
                {modeOption}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetOverrides}
            className="px-2.5 py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] text-xs rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
            <p className="mb-4 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Colors
            </p>
            <ColorEditor colorValues={colorValues} onOverride={setOverride} />
          </div>

          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
            <p className="mb-3 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Contrast (WCAG 2.1)
            </p>
            <ContrastChecker colorValues={colorValues} />
          </div>
        </div>

        <div className="flex-1 min-w-0 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
          <p className="mb-6 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
            Components
          </p>
          <ComponentShowcase />
        </div>
      </div>
    </div>
  );
}
