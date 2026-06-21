import { useCallback, useMemo } from 'react';
import {
  THEMES,
  useTheme,
  type BaseTheme,
  type Mode,
} from '../../../theme/ThemeContext';
import ColorEditor from './ColorEditor';
import ComponentShowcase from './ComponentShowcase';
import ContrastChecker from './ContrastChecker';
import CopyFromTheme, { type CopiedTokens } from './CopyFromTheme';
import ThemeSaveBar from './ThemeSaveBar';
import Toast from '../../common/Toast';
import { ESCAPE_HATCH_LIGHT } from './escapeHatchStyles';
import { tokenContrastFailures, useContrastResults } from './contrastResults';
import { useThemeOverrides } from './useThemeOverrides';
import { useThemeSave } from './useThemeSave';
import { useToast } from '../../../lib/hooks/useToast';

/**
 * Full-page theme editor accessible from the user menu under "Theme
 * editor".
 *
 * Live-edits the 52 bundle tokens (7 bundles × 7 slots + 1 base-only
 * subtle-text slot + 2 base/mount input-bg slots) that make up the
 * active theme. Overrides live in React state inside `useThemeOverrides`
 * and are applied as inline custom-property styles on a wrapper that
 * scopes the showcase column only – the editor chrome inherits from the
 * active theme at `:root`, so the user can never edit themselves into an
 * unrecoverable state.
 *
 * Persistence is custom-only. When the editor's selected theme is `custom`,
 * a Save button persists the current mode's tokens (localStorage +
 * `PATCH /users/me`) and a "Copy from theme" control seeds the editor from
 * any built-in theme's palette. For the 10 built-in themes both controls
 * stay present but `aria-disabled` (a11y brief B6); the editor remains
 * preview-only. Built-in theme edits still reset on navigation.
 *
 * Layout: a left panel with `ColorEditor` and `ContrastChecker`, and a
 * right panel with `ComponentShowcase` for a live preview.
 *
 * Reset, theme select, and mode toggle use fixed neutral colors instead
 * of bundle tokens so they remain readable as escape hatches when the
 * user edits the bundles to invalid values mid-session.
 */
export default function ThemeEditor() {
  const { baseTheme, mode, setBaseTheme, setMode } = useTheme();
  const {
    colorValues,
    overrideStyle,
    setOverride,
    loadOverrides,
    resetOverrides,
    resetBundle,
  } = useThemeOverrides();
  const { isSaving, save } = useThemeSave();
  const toast = useToast();

  const isCustom = baseTheme === 'custom';

  // The focus ring is now an editable, injected token for the custom theme
  // (W1), so it flows through `colorValues` like any bundle slot rather than
  // being read separately from the document root.
  const contrastResults = useContrastResults(colorValues);

  // Per-token failing-pair lookup so each hex input can surface its own
  // contrast failure inline (BL1). Memoized on the results object identity.
  const contrastFailures = useMemo(
    () => tokenContrastFailures(contrastResults),
    [contrastResults],
  );

  function handleThemeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setBaseTheme(event.target.value as BaseTheme);
  }

  function handleModeToggle(nextMode: Mode) {
    setMode(nextMode);
  }

  const handleSave = useCallback(async () => {
    const succeeded = await save(colorValues);
    toast.show(succeeded ? 'saved' : 'save-failed');
  }, [colorValues, save, toast]);

  const handleCopy = useCallback(
    (tokens: CopiedTokens, themeLabel: string) => {
      const modeTokens = tokens[mode];
      loadOverrides(modeTokens);
      const count = Object.keys(modeTokens).length;
      toast.show(`copied:${count}:${themeLabel}`);
    },
    [loadOverrides, mode, toast],
  );

  // The toast holds only a message key; the variant (success vs error) and the
  // visible copy are resolved here at the render site, per the useToast
  // contract (a11y brief B1).
  const toastView = useMemo(() => resolveToast(toast.message), [toast.message]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-[var(--base-text)] text-lg font-semibold">
            Theme editor
          </h1>
          <p className="mt-0.5 text-[var(--base-alt-text)] text-xs">
            Edit the 52 bundle tokens of the active theme and see changes live.
            Save and copy are available for the custom theme.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <select
            value={baseTheme}
            onChange={handleThemeChange}
            style={ESCAPE_HATCH_LIGHT}
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
            style={ESCAPE_HATCH_LIGHT}
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
            style={ESCAPE_HATCH_LIGHT}
            className="px-2.5 py-1.5 border text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg active:scale-[0.96] cursor-pointer"
          >
            Reset all
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <CopyFromTheme isCustom={isCustom} onCopy={handleCopy} />
        <ThemeSaveBar
          isCustom={isCustom}
          isSaving={isSaving}
          failingCount={contrastResults.totalFailures}
          onSave={handleSave}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="shrink-0 w-full lg:w-80 space-y-4">
          <div className="p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
            <h2 className="mb-4 text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Colors
            </h2>
            <ColorEditor
              colorValues={colorValues}
              contrastFailures={contrastFailures}
              onOverride={setOverride}
              onResetBundle={resetBundle}
            />
          </div>

          <div className="p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
            <h2 className="mb-3 text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Contrast (WCAG 2.1)
            </h2>
            <ContrastChecker results={contrastResults} />
          </div>
        </div>

        <div className="flex-1 min-w-0 p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
          <h2 className="mb-6 text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
            Components
          </h2>
          {/* Override scope: bundle edits apply to the showcase subtree only,
              so a hostile bundle value can't lock the user out of the editor
              chrome (panel headings, color rows, contrast pairs). The chrome
              inherits from :root via the active theme, unaffected. */}
          <div style={overrideStyle}>
            <ComponentShowcase />
          </div>
        </div>
      </div>

      {toastView && (
        <Toast
          message={toastView.message}
          variant={toastView.variant}
          onDismiss={toast.dismiss}
        />
      )}
    </div>
  );
}

interface ToastView {
  message: string;
  variant: 'success' | 'error';
}

/**
 * Resolves the editor's toast message key into a `<Toast>` variant and visible
 * copy. The success/error variant is chosen HERE at the render site (the
 * `useToast` hook holds only a message string), per a11y brief B1. Exported for
 * direct unit coverage of the `copied:<n>:<label>` string protocol (W6).
 */
export function resolveToast(message: string | null): ToastView | null {
  if (message === null) return null;
  if (message === 'saved') {
    return { message: 'Custom theme saved.', variant: 'success' };
  }
  if (message === 'save-failed') {
    return { message: 'Could not save custom theme.', variant: 'error' };
  }
  if (message.startsWith('copied:')) {
    const withoutPrefix = message.slice('copied:'.length);
    const separatorIndex = withoutPrefix.indexOf(':');
    const count = withoutPrefix.slice(0, separatorIndex);
    const themeLabel = withoutPrefix.slice(separatorIndex + 1);
    return {
      message: `Copied ${count} tokens from ${themeLabel}`,
      variant: 'success',
    };
  }
  return { message, variant: 'success' };
}
