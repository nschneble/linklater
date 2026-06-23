import { useCallback, useMemo, useState } from 'react';
import {
  BRANDING_DEFAULTS,
  BRANDING_DEFAULTS_LIGHT,
} from '../../../theme/brandingDefaults';
import {
  THEMES,
  useTheme,
  type BaseTheme,
  type Mode,
} from '../../../theme/ThemeContext';
import {
  customThemeSrSuffix,
  isCustomThemeConfigured,
} from '../../../theme/customTheme';
import AutoSaveStatus from './AutoSaveStatus';
import ColorEditor from './ColorEditor';
import ComponentShowcase from './ComponentShowcase';
import ContrastChecker from './ContrastChecker';
import CopyFromTheme, { type CopiedTokens } from './CopyFromTheme';
import CustomThemePickerToggle from './CustomThemePickerToggle';
import ThemeSelectMenu from './ThemeSelectMenu';
import Toast from '../../common/Toast';
import { EDITOR_FOCUS_RING, ESCAPE_HATCH_LIGHT } from './escapeHatchStyles';
import { tokenContrastFailures, useContrastResults } from './contrastResults';
import { updateMe } from '../../../lib/api';
import { useThemeAutoSave } from './useThemeAutoSave';
import { useThemeOverrides, type ThemeVariable } from './useThemeOverrides';
import { useThemeSave } from './useThemeSave';
import { useToast } from '../../../lib/hooks/useToast';

const MODE_OPTIONS: Mode[] = ['dark', 'light'];

/**
 * Full-page custom-theme editor reached from the user menu ("Create a custom
 * theme" / "Edit your custom theme").
 *
 * Live-edits the bundle tokens that make up the active theme. Overrides live in
 * React state inside `useThemeOverrides` and are applied as inline
 * custom-property styles on a wrapper scoping the showcase column, so the live
 * preview is instant before a save lands.
 *
 * Persistence is custom-only and AUTOMATIC: every edit to the custom theme is
 * debounced and saved (localStorage + `PATCH /users/me`) with no Save button.
 * Built-in themes stay preview-only and reset on navigation.
 *
 * The chrome controls (theme picker, copy, mode toggle, show-custom switch)
 * paint from the active theme's bundle tokens. Because auto-save pushes custom
 * edits to `:root`, those controls can degrade if the user picks unreadable
 * colors — so "Reset all" stays a FIXED-color escape hatch: it reverts the
 * custom theme to the readable branding defaults, restoring a way out.
 */
export default function ThemeEditor() {
  const {
    baseTheme,
    customTheme,
    customThemeEnabled,
    mode,
    setBaseTheme,
    setCustomThemeEnabled,
    setMode,
  } = useTheme();
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
  const [savedCount, setSavedCount] = useState(0);

  const isCustom = baseTheme === 'custom';
  const isCustomConfigured = isCustomThemeConfigured(customTheme);

  const contrastResults = useContrastResults(colorValues);

  const contrastFailures = useMemo(
    () => tokenContrastFailures(contrastResults),
    [contrastResults],
  );

  // Auto-save fires the polite "saved" affordance on success and an assertive
  // error Toast on failure; both are routed through a single outcome handler.
  const handleAutoSaveOutcome = useCallback(
    (outcome: 'saved' | 'failed') => {
      if (outcome === 'saved') {
        setSavedCount((previous) => previous + 1);
      } else {
        toast.show('save-failed');
      }
    },
    [toast],
  );

  const { scheduleSave, saveNow } = useThemeAutoSave({
    isCustom,
    colorValues,
    save,
    onOutcome: handleAutoSaveOutcome,
  });

  function handleOverride(variable: ThemeVariable, value: string) {
    setOverride(variable, value);
    scheduleSave();
  }

  function handleResetBundle(bundle: Parameters<typeof resetBundle>[0]) {
    resetBundle(bundle);
    scheduleSave();
  }

  const handleCopy = useCallback(
    (tokens: CopiedTokens, themeLabel: string) => {
      const modeTokens = tokens[mode];
      loadOverrides(modeTokens);
      scheduleSave();
      const count = Object.keys(modeTokens).length;
      toast.show(`copied:${count}:${themeLabel}`);
    },
    [loadOverrides, mode, scheduleSave, toast],
  );

  // The single guaranteed escape hatch. For the custom theme it reverts the
  // current mode to the branding defaults and persists immediately, so an
  // unreadable palette repaints to a readable one without waiting on the
  // debounce. For built-in themes it just drops the preview-only edits.
  const handleResetAll = useCallback(() => {
    if (isCustom) {
      const defaults =
        mode === 'dark' ? BRANDING_DEFAULTS : BRANDING_DEFAULTS_LIGHT;
      loadOverrides(defaults);
      saveNow(defaults as Record<ThemeVariable, string>);
    } else {
      resetOverrides();
    }
  }, [isCustom, mode, loadOverrides, saveNow, resetOverrides]);

  // Optimistically flips the picker opt-in, then persists it. On failure the
  // switch reverts and an assertive Toast announces the error (a11y brief c2).
  const handleTogglePickerVisibility = useCallback(
    async (next: boolean) => {
      setCustomThemeEnabled(next);
      try {
        await updateMe({ customThemeEnabled: next });
      } catch {
        setCustomThemeEnabled(!next);
        toast.show('picker-visibility-failed');
      }
    },
    [setCustomThemeEnabled, toast],
  );

  const toastView = useMemo(() => resolveToast(toast.message), [toast.message]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-[var(--base-text)] text-lg font-semibold">
            Custom theme editor
          </h1>
          <p className="mt-0.5 text-[var(--base-alt-text)] text-xs">
            Pick your colors and components. Changes save as you go. Preview a
            film theme to copy its palette as a starting point.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeSelectMenu
            options={THEMES.map((theme) => ({
              id: theme.id,
              label: theme.label,
              swatchIcon: theme.swatchIcon,
              accent: theme.accent,
              isAccessible: theme.isAccessible,
              suffixSrText:
                theme.id === 'custom'
                  ? customThemeSrSuffix(isCustomConfigured)
                  : undefined,
            }))}
            value={baseTheme}
            onSelect={(id) => setBaseTheme(id as BaseTheme)}
            ariaLabel="Theme"
          />

          <div
            className="relative inline-flex p-0.5 bg-[var(--base-bg)] border border-[var(--base-border)] rounded-full"
            role="group"
            aria-label="Color mode"
          >
            {MODE_OPTIONS.map((modeOption) => (
              <button
                key={modeOption}
                type="button"
                onClick={() => setMode(modeOption)}
                aria-pressed={mode === modeOption}
                className={`relative z-10 min-h-[24px] px-2.5 py-1.5 text-[var(--base-subtle-text)] text-xs capitalize aria-pressed:bg-[var(--base-highlight)] aria-pressed:text-[var(--base-highlight-fg)] aria-pressed:font-semibold ${EDITOR_FOCUS_RING} rounded-full transition-colors`}
              >
                {modeOption}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleResetAll}
            style={ESCAPE_HATCH_LIGHT}
            className={`min-h-[24px] px-2.5 py-1.5 border text-xs ${EDITOR_FOCUS_RING} rounded-lg active:scale-[0.96] cursor-pointer`}
          >
            Reset all
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <CopyFromTheme isCustom={isCustom} onCopy={handleCopy} />
        <AutoSaveStatus
          isCustom={isCustom}
          isSaving={isSaving}
          savedCount={savedCount}
          failingCount={contrastResults.totalFailures}
        />
      </div>

      <div className="mb-4">
        <CustomThemePickerToggle
          enabled={customThemeEnabled}
          onChange={handleTogglePickerVisibility}
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
              onOverride={handleOverride}
              onResetBundle={handleResetBundle}
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
              so the instant preview is visible before the debounced save lands
              and (for built-in themes) without ever touching :root. */}
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
 *
 * Auto-save SUCCESS no longer routes here — it is announced by the polite
 * `AutoSaveStatus` region — but the `save-failed` assertive path still does.
 */
export function resolveToast(message: string | null): ToastView | null {
  if (message === null) return null;
  if (message === 'save-failed') {
    return { message: 'Could not save custom theme.', variant: 'error' };
  }
  if (message === 'picker-visibility-failed') {
    return {
      message: 'Could not update theme picker setting.',
      variant: 'error',
    };
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
