import {
  THEMES,
  useTheme,
  type BaseTheme,
  type Mode,
} from '../../../theme/ThemeContext';
import ColorEditor from './ColorEditor';
import ComponentShowcase from './ComponentShowcase';
import ContrastChecker from './ContrastChecker';
import { useThemeOverrides } from './useThemeOverrides';

/**
 * Full-page theme editor accessible from the user menu under "Theme editor".
 *
 * Allows the user to live-edit any of the ten CSS color variables that make up
 * a theme. Changes are applied immediately as inline overrides on
 * `document.documentElement` (via `useThemeOverrides`) and reset when the user
 * navigates away.
 *
 * The editor also supports switching between themes (using the base theme from
 * `ThemeContext`) and toggling light/dark mode — both of which clear any active
 * overrides so the new theme's values are the new baseline.
 *
 * Layout: a left panel with `ColorEditor` and `ContrastChecker`, and a right
 * panel with `ComponentShowcase` for a live preview of key UI components.
 *
 * NOTE: Changes made in the editor are not persisted. They only affect the
 * current browser session. Theme selection (via the UserMenu) is the persistent
 * preference.
 */
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
          <h1 className="text-[var(--text)] text-lg font-semibold">
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
            className="px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-transparent rounded-lg cursor-pointer"
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
                className={`relative z-10 px-2.5 py-1 text-xs capitalize focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-full transition-colors duration-150 ${
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
            className="px-2.5 py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-lg transition-colors active:scale-[0.96] cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-shrink-0 w-full lg:w-72 space-y-4">
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
            <h2 className="mb-4 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Colors
            </h2>
            <ColorEditor colorValues={colorValues} onOverride={setOverride} />
          </div>

          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
            <h2 className="mb-3 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Contrast (WCAG 2.1)
            </h2>
            <ContrastChecker colorValues={colorValues} />
          </div>
        </div>

        <div className="flex-1 min-w-0 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
          <h2 className="mb-6 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
            Components
          </h2>
          <ComponentShowcase />
        </div>
      </div>
    </div>
  );
}
