import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  THEMES,
  useTheme,
  type BaseTheme,
  type Mode,
} from '../../../theme/ThemeContext';
import {
  customThemeSrSuffix,
  isCustomThemeConfigured,
  type CustomTheme,
} from '../../../theme/customTheme';
import AutoSaveStatus from './AutoSaveStatus';
import ColorEditor from './ColorEditor';
import ComponentShowcase from './ComponentShowcase';
import ContrastChecker from './ContrastChecker';
import CopyFromTheme from './CopyFromTheme';
import CustomThemePickerToggle from './CustomThemePickerToggle';
import Toast from '../../common/Toast';
import { EDITOR_FOCUS_RING, ESCAPE_HATCH_PILL } from './escapeHatchStyles';
import { readThemeTokens } from './themeProbe';
import { tokenContrastFailures, useContrastResults } from './contrastResults';
import { updateMe } from '../../../lib/api';
import { useThemeAutoSave } from './useThemeAutoSave';
import { useThemeOverrides, type ThemeVariable } from './useThemeOverrides';
import { useThemeSave } from './useThemeSave';
import { useToast } from '../../../lib/hooks/useToast';

const MODE_OPTIONS: Mode[] = ['dark', 'light'];

/** The custom-theme descriptor, used for the editor's static identity label. */
const CUSTOM_THEME = THEMES.find((theme) => theme.id === 'custom')!;

/**
 * Full-page custom-theme editor reached from the user menu ("Create a custom
 * theme" / "Edit your custom theme").
 *
 * Live-edits the bundle tokens that make up the active theme. Overrides live in
 * React state inside `useThemeOverrides` and are applied as inline
 * custom-property styles on a wrapper scoping the showcase column, so the live
 * preview is instant before a save lands.
 *
 * The master-enable switch ("Use your own custom theme") gates everything:
 * while OFF the editor mirrors the user's currently-selected real theme
 * (live-following theme/mode changes) with the color pickers LOCKED and the
 * Colors card grayed, so the page matches the rest of the app. Flipping it ON
 * seeds the custom palette from whatever theme is showing, switches to custom,
 * and unlocks editing. Persistence is then AUTOMATIC: every edit is debounced
 * and saved (localStorage + `PATCH /users/me`) with no Save button.
 *
 * There is no on-page theme switcher. Hovering or arrow-navigating a row in the
 * copy menu previews that film theme full-page (transient, non-persisting);
 * activating a row applies its current-mode palette immediately + autosaves,
 * with an Undo to revert.
 *
 * The mode toggle's active pill and the copy menu's trigger paint from
 * FIXED-color escape hatches (not bundle tokens): a hostile custom palette can
 * degrade everything else, but the mode toggle (needed to reach each mode's
 * palette) and the copy menu (now the only way back to a readable palette,
 * since "Reset all" is gone) must stay legible regardless.
 */
export default function ThemeEditor() {
  const {
    baseTheme,
    customTheme,
    customThemeEnabled,
    mode,
    setBaseTheme,
    setCustomTheme,
    setCustomThemeEnabled,
    setMode,
    setPreviewTheme,
  } = useTheme();
  const {
    colorValues,
    overrideStyle,
    setOverride,
    loadOverrides,
    resetBundle,
  } = useThemeOverrides();

  const editingEnabled = customThemeEnabled;
  const isCustomConfigured = isCustomThemeConfigured(customTheme);

  // While the custom theme is enabled the editor edits it, so keep the page on
  // custom. While disabled, DON'T force it — the editor mirrors the user's real
  // theme (and live-follows theme/mode changes via `useThemeOverrides`).
  useEffect(() => {
    if (editingEnabled && baseTheme !== 'custom') setBaseTheme('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingEnabled]);

  const { isSaving, save } = useThemeSave();
  const toast = useToast();
  const [savedCount, setSavedCount] = useState(0);
  const [savedMessage, setSavedMessage] = useState('Custom theme saved.');
  const [undoThemeLabel, setUndoThemeLabel] = useState<string | null>(null);

  // Always-current values (snapshot source for Undo) + a consume-once reason
  // that the next settled save announces, so a copy/undo says WHAT happened
  // through the single polite region without double-speaking.
  const colorValuesReference = useRef(colorValues);
  colorValuesReference.current = colorValues;
  const undoSnapshotReference = useRef<Record<ThemeVariable, string> | null>(
    null,
  );
  const pendingSaveReasonReference = useRef<string | null>(null);

  const contrastResults = useContrastResults(colorValues);

  const contrastFailures = useMemo(
    () => tokenContrastFailures(contrastResults),
    [contrastResults],
  );

  // Auto-save fires the polite "saved" affordance on success and an assertive
  // error Toast on failure. A success consumes the pending reason (or the
  // generic message) so each settled save announces exactly one thing.
  const handleAutoSaveOutcome = useCallback(
    (outcome: 'saved' | 'failed') => {
      if (outcome === 'saved') {
        const reason =
          pendingSaveReasonReference.current ?? 'Custom theme saved.';
        pendingSaveReasonReference.current = null;
        setSavedMessage(reason);
        setSavedCount((previous) => previous + 1);
      } else {
        toast.show('save-failed');
      }
    },
    [toast],
  );

  const { scheduleSave, saveNow } = useThemeAutoSave({
    isCustom: editingEnabled,
    colorValues,
    save,
    onOutcome: handleAutoSaveOutcome,
  });

  // A manual edit, or a theme/mode change, makes the "undo the last copy"
  // snapshot stale — drop it so Undo never reverts to a mismatched palette.
  const clearUndo = useCallback(() => {
    undoSnapshotReference.current = null;
    setUndoThemeLabel(null);
  }, []);

  useEffect(() => {
    clearUndo();
  }, [mode, baseTheme, clearUndo]);

  function handleOverride(
    variable: Parameters<typeof setOverride>[0],
    value: string,
  ) {
    setOverride(variable, value);
    clearUndo();
    scheduleSave();
  }

  function handleResetBundle(bundle: Parameters<typeof resetBundle>[0]) {
    resetBundle(bundle);
    clearUndo();
    scheduleSave();
  }

  // Apply a film theme's CURRENT-mode palette immediately, snapshot the prior
  // values for Undo, and persist at once. Applying a whole palette is a
  // deliberate, high-intent action, so it uses `saveNow` (not the debounce) —
  // navigating away in the debounce window must not silently drop it.
  const handleApply = useCallback(
    (themeId: BaseTheme, themeLabel: string) => {
      undoSnapshotReference.current = { ...colorValuesReference.current };
      const applied = loadOverrides(readThemeTokens(themeId, mode));
      pendingSaveReasonReference.current = `${themeLabel} palette applied and saved.`;
      setUndoThemeLabel(themeLabel);
      saveNow(applied);
    },
    [loadOverrides, mode, saveNow],
  );

  const handleUndo = useCallback(() => {
    const snapshot = undoSnapshotReference.current;
    if (!snapshot) return;
    loadOverrides(snapshot);
    pendingSaveReasonReference.current = 'Reverted to previous colors.';
    undoSnapshotReference.current = null;
    setUndoThemeLabel(null);
    saveNow(snapshot);
  }, [loadOverrides, saveNow]);

  // Master enable. Turning ON seeds the custom palette from the currently-shown
  // real theme (both modes) the FIRST time, persists it, and switches to
  // custom; turning OFF just hides it. Optimistic — on PATCH failure it reverts
  // EVERY local mutation (enabled flag, the base-theme switch, and the seeded
  // palette, which `setCustomTheme`/`setBaseTheme` already wrote to
  // localStorage), so a failed enable can't leave an orphaned `custom`
  // selection behind.
  const handleToggleCustomTheme = useCallback(
    async (next: boolean) => {
      const previousBaseTheme = baseTheme;
      const previousCustomTheme = customTheme;
      setCustomThemeEnabled(next);
      const seeded: CustomTheme | null =
        next && !isCustomConfigured
          ? {
              dark: readThemeTokens(baseTheme, 'dark'),
              light: readThemeTokens(baseTheme, 'light'),
            }
          : null;
      if (seeded) setCustomTheme(seeded);
      if (next) setBaseTheme('custom');
      try {
        await updateMe({
          customThemeEnabled: next,
          ...(seeded ? { customTheme: seeded } : {}),
        });
      } catch {
        setCustomThemeEnabled(!next);
        if (next) setBaseTheme(previousBaseTheme);
        // Restore the prior palette; an empty map reads as "not configured"
        // so a never-seeded user lands back where they started.
        if (seeded) {
          setCustomTheme(previousCustomTheme ?? { dark: {}, light: {} });
        }
        toast.show('custom-theme-toggle-failed');
      }
    },
    [
      baseTheme,
      customTheme,
      isCustomConfigured,
      setBaseTheme,
      setCustomTheme,
      setCustomThemeEnabled,
      toast,
    ],
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
          <AutoSaveStatus
            enabled={editingEnabled}
            isSaving={isSaving}
            savedCount={savedCount}
            savedMessage={savedMessage}
            failingCount={contrastResults.totalFailures}
          />

          {/* Static identity label: the editor is always on the custom theme,
              so the old theme switcher is just a name + swatch now. Plain inert
              text — no role/tabindex/combobox ARIA, so AT announces no phantom
              control. */}
          <span className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-[var(--base-bg)] border border-[var(--base-border)] text-[var(--base-text)] text-xs rounded-lg">
            <span
              aria-hidden="true"
              className="relative shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: CUSTOM_THEME.accent }}
            >
              <i
                className={`fa-solid ${CUSTOM_THEME.swatchIcon} text-[0.5rem]`}
                style={{ color: '#ffffff' }}
                aria-hidden="true"
              />
            </span>
            <span>
              {CUSTOM_THEME.label}
              <span className="sr-only">
                {customThemeSrSuffix(isCustomConfigured)}
              </span>
            </span>
          </span>

          {/* Dark/light toggle. Borrows the read/unread sliding-pill look
              (ComponentShowcase) but pins the active pill fill + label to fixed
              escape-hatch colors and keeps the fixed focus ring, so an
              unreadable custom palette can never hide this control's state —
              it's the very control needed to reach each mode's palette. */}
          <div
            role="group"
            aria-label="Color mode"
            className="relative grid grid-cols-2 p-1 bg-[var(--base-bg)] border border-[var(--base-border)] rounded-full"
          >
            <div
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full motion-safe:[transition:transform_200ms_cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                backgroundColor: ESCAPE_HATCH_PILL[mode].fill,
                transform:
                  mode === 'light' ? 'translateX(100%)' : 'translateX(0)',
              }}
            />
            {MODE_OPTIONS.map((modeOption) => (
              <button
                key={modeOption}
                type="button"
                onClick={() => setMode(modeOption)}
                aria-pressed={mode === modeOption}
                style={
                  mode === modeOption
                    ? { color: ESCAPE_HATCH_PILL[modeOption].label }
                    : undefined
                }
                className={`group relative z-10 min-h-[24px] px-3 py-1.5 text-[var(--base-subtle-text)] text-xs capitalize aria-pressed:font-semibold ${EDITOR_FOCUS_RING} rounded-full transition-colors`}
              >
                <span className="grid justify-center">
                  <span
                    aria-hidden="true"
                    className="col-start-1 row-start-1 flex invisible items-center justify-center gap-1 font-semibold"
                  >
                    <i
                      className="fa-solid fa-circle-dot text-[0.4rem]"
                      aria-hidden="true"
                    />
                    {modeOption}
                  </span>
                  <span className="col-start-1 row-start-1 flex items-center justify-center gap-1">
                    <i
                      className="hidden group-aria-pressed:inline fa-solid fa-circle-dot text-[0.4rem]"
                      aria-hidden="true"
                    />
                    {modeOption}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two-up settings card: copy-palette menu on the left, the master
          enable switch on the right. */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4 p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
        <div className="flex-1 min-w-0">
          <CopyFromTheme
            editingEnabled={editingEnabled}
            onApply={handleApply}
            onPreviewTheme={setPreviewTheme}
            undoThemeLabel={undoThemeLabel}
            onUndo={handleUndo}
          />
        </div>
        <CustomThemePickerToggle
          enabled={customThemeEnabled}
          onChange={handleToggleCustomTheme}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="shrink-0 w-full lg:w-80 space-y-4">
          {/* Colors card. While editing is locked the heading + lock hint stay
              full-opacity; only the (disabled) controls below dim, so the
              "grayed" cue never drops live text below its contrast floor. */}
          <div className="p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
            <h2 className="mb-4 text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Colors
            </h2>
            <ColorEditor
              colorValues={colorValues}
              contrastFailures={contrastFailures}
              onOverride={handleOverride}
              onResetBundle={handleResetBundle}
              editingDisabled={!editingEnabled}
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
 * `useToast` hook holds only a message string), per a11y brief B1.
 *
 * Auto-save SUCCESS (incl. copy/undo) is announced by the polite
 * `AutoSaveStatus` region — only the assertive FAILURE paths route here.
 */
export function resolveToast(message: string | null): ToastView | null {
  if (message === null) return null;
  if (message === 'save-failed') {
    return { message: 'Could not save custom theme.', variant: 'error' };
  }
  if (message === 'custom-theme-toggle-failed') {
    return {
      message: 'Could not update the custom theme setting.',
      variant: 'error',
    };
  }
  return { message, variant: 'success' };
}
