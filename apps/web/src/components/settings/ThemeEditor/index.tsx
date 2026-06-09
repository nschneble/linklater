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
 * Full-page theme editor accessible from the user menu under "Theme
 * editor".
 *
 * Live-edits the 49 bundle tokens (7 bundles × 7 slots) that make up the
 * active theme. Changes are applied immediately as inline overrides on
 * `document.documentElement` (via `useThemeOverrides`) and reset when the
 * user navigates away.
 *
 * The editor also supports switching between themes (using the base theme
 * from `ThemeContext`) and toggling light/dark mode — both of which clear
 * any active overrides so the new theme's values are the new baseline.
 *
 * Layout: a left panel with `ColorEditor` and `ContrastChecker`, and a
 * right panel with `ComponentShowcase` for a live preview of the bundle
 * tokens and key UI components.
 *
 * Reset, theme select, and mode toggle use fixed neutral colors instead
 * of bundle tokens so they remain readable as escape hatches when the
 * user edits the bundles to invalid values mid-session.
 *
 * NOTE: Changes made in the editor are not persisted. They only affect the
 * current browser session. Theme selection (via the UserMenu) is the
 * persistent preference.
 */
export default function ThemeEditor() {
  const { baseTheme, mode, setBaseTheme, setMode } = useTheme();
  const { colorValues, setOverride, resetOverrides, resetBundle } =
    useThemeOverrides();

  function handleThemeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setBaseTheme(event.target.value as BaseTheme);
  }

  function handleModeToggle(nextMode: Mode) {
    setMode(nextMode);
  }

  // Fixed neutral palette for the editor's own critical controls. Bundle
  // edits cannot affect these, so the user always has a visible escape.
  const escapeHatchStyle = {
    backgroundColor: '#fafafa',
    color: '#0a0a0a',
    borderColor: '#404040',
  } as const;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-[var(--base-text)] text-lg font-semibold">
            Theme editor
          </h1>
          <p className="mt-0.5 text-[var(--base-alt-text)] text-xs">
            Edit the 49 bundle tokens of the active theme and see changes live.
            Resets when you navigate away.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={baseTheme}
            onChange={handleThemeChange}
            style={escapeHatchStyle}
            className="px-2.5 py-1.5 border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg cursor-pointer"
            aria-label="Select theme"
          >
            {THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>

          <div
            style={escapeHatchStyle}
            className="relative inline-flex p-0.5 border rounded-full"
            role="group"
            aria-label="Color mode"
          >
            {(['dark', 'light'] as Mode[]).map((modeOption) => (
              <button
                key={modeOption}
                type="button"
                onClick={() => handleModeToggle(modeOption)}
                style={
                  mode === modeOption
                    ? { backgroundColor: '#0a0a0a', color: '#fafafa' }
                    : { color: '#0a0a0a' }
                }
                className="relative z-10 px-2.5 py-1 text-xs capitalize aria-pressed:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full transition-colors duration-150 cursor-pointer"
                aria-pressed={mode === modeOption}
              >
                {modeOption}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetOverrides}
            style={escapeHatchStyle}
            className="px-2.5 py-1.5 border text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg active:scale-[0.96] cursor-pointer"
          >
            Reset all
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-shrink-0 w-full lg:w-80 space-y-4">
          <div className="p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
            <h2 className="mb-4 text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Colors
            </h2>
            <ColorEditor
              colorValues={colorValues}
              onOverride={setOverride}
              onResetBundle={resetBundle}
            />
          </div>

          <div className="p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
            <h2 className="mb-3 text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Contrast (WCAG 2.1)
            </h2>
            <ContrastChecker colorValues={colorValues} />
          </div>
        </div>

        <div className="flex-1 min-w-0 p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
          <h2 className="mb-6 text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
            Components
          </h2>
          <ComponentShowcase />
        </div>
      </div>
    </div>
  );
}
