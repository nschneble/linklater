import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import {
  isCustomThemeConfigured,
  type CustomTheme,
} from '../../../theme/customTheme';
import type { BaseTheme } from '../../../theme/constants';
import AutoSaveStatus from './AutoSaveStatus';
import ColorEditor from './ColorEditor';
import ComponentShowcase from './ComponentShowcase';
import ContrastChecker from './ContrastChecker';
import CopyFromTheme from './CopyFromTheme';
import CustomThemePickerToggle from './CustomThemePickerToggle';
import ModeToggle from './ModeToggle';
import Toast from '../../common/Toast';
import { readThemeTokens } from './themeProbe';
import { tokenContrastFailures, useContrastResults } from './contrastResults';
import { updateMe } from '../../../lib/api';
import { useThemeCopy } from './useThemeCopy';
import { useThemeOverrides } from './useThemeOverrides';
import { useThemeSave } from './useThemeSave';
import { useToast } from '../../../lib/hooks/useToast';

/**
 * Full-page custom-theme editor reached from the user menu ("Create a custom
 * theme" / "Edit your custom theme").
 *
 * The editor NEVER changes the global site theme. The custom palette is
 * previewed by scoping it (as inline custom properties via `contentThemeStyle`)
 * to the content columns below the header — so leaving the editor can't strand
 * the whole app on custom.
 *
 * The master-enable switch ("Use your own custom theme") gates everything:
 * while OFF the editor mirrors the current global theme (color pickers LOCKED,
 * read-only) so it looks like any other page. Flipping it ON for the FIRST time
 * snapshots the current theme's colors as the initial custom palette and
 * persists it; the content then renders that custom palette, editable, with
 * AUTOMATIC debounced saves (localStorage + `PATCH /users/me`). Toggling OFF
 * again reverts the content to the global theme without overwriting the saved
 * custom palette.
 *
 * There is no on-page theme switcher. Hovering or arrow-navigating a row in the
 * copy menu previews that film theme within the content scope (transient,
 * non-persisting); activating a row applies its current-mode palette + saves,
 * with an Undo to revert.
 *
 * The mode toggle's active pill and the copy menu's trigger paint from
 * FIXED-color escape hatches (not bundle tokens), and the settings card with
 * the OFF switch sits OUTSIDE the custom scope — so a hostile custom palette can
 * degrade the preview but never the controls needed to escape it.
 */
export default function ThemeEditor() {
  const {
    baseTheme,
    customTheme,
    customThemeEnabled,
    mode,
    setCustomTheme,
    setCustomThemeEnabled,
    setMode,
  } = useTheme();
  const {
    colorValues,
    contentThemeStyle,
    setOverride,
    loadOverrides,
    resetBundle,
  } = useThemeOverrides();

  const editingEnabled = customThemeEnabled;
  const isCustomConfigured = isCustomThemeConfigured(customTheme);

  // Hovering/arrow-navigating a copy-menu row previews that film theme — scoped
  // to the editor's content (the same wrapper that scopes the custom palette),
  // so the preview shows where the showcase is and never touches the global
  // theme or the app nav. Reverts to `null` when the menu closes.
  const [previewThemeId, setPreviewThemeId] = useState<BaseTheme | null>(null);
  const previewStyle = useMemo<CSSProperties | null>(
    () =>
      previewThemeId
        ? (readThemeTokens(previewThemeId, mode) as CSSProperties)
        : null,
    [previewThemeId, mode],
  );

  const { isSaving, save } = useThemeSave();
  const toast = useToast();

  const contrastResults = useContrastResults(colorValues);

  const contrastFailures = useMemo(
    () => tokenContrastFailures(contrastResults),
    [contrastResults],
  );

  const onSaveFailed = useCallback(() => toast.show('save-failed'), [toast]);

  const {
    scheduleSave,
    savedCount,
    savedMessage,
    undoThemeLabel,
    clearUndo,
    handleApply,
    handleUndo,
  } = useThemeCopy({
    editingEnabled,
    baseTheme,
    mode,
    colorValues,
    save,
    loadOverrides,
    onSaveFailed,
  });

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

  // Master enable. Turning ON for the FIRST time snapshots the current theme's
  // colors (both modes) as the initial custom palette and persists it; turning
  // OFF just hides it (the saved palette is untouched). The editor NEVER
  // changes the global site theme — the custom palette is previewed via a
  // scoped wrapper (see `contentThemeStyle`), so leaving the editor can't
  // strand the whole app on custom. Optimistic — on PATCH failure it reverts
  // the enabled flag + the seeded palette.
  const handleToggleCustomTheme = useCallback(
    async (next: boolean) => {
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
      try {
        await updateMe({
          customThemeEnabled: next,
          ...(seeded ? { customTheme: seeded } : {}),
        });
      } catch {
        setCustomThemeEnabled(!next);
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
      setCustomTheme,
      setCustomThemeEnabled,
      toast,
    ],
  );

  const toastView = useMemo(() => resolveToast(toast.message), [toast.message]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header: title + intro fill the LEFT half; the mode toggle (and the
          save affordance) sit top-right, aligned against the title. */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0 sm:max-w-[50%]">
          <h1 className="text-[var(--base-text)] text-lg font-semibold">
            Custom theme editor
          </h1>
          <p className="mt-1 text-[var(--base-alt-text)] text-xs">
            Pick your colors and components. Changes save as you go. Preview a
            film theme to copy its palette as a starting point.
          </p>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <AutoSaveStatus
            enabled={editingEnabled}
            isSaving={isSaving}
            savedCount={savedCount}
            savedMessage={savedMessage}
            failingCount={contrastResults.totalFailures}
          />
          <ModeToggle mode={mode} onModeChange={setMode} />
        </div>
      </div>

      {/* Settings card. Split mirrors the content columns below (switch at
          lg:w-80, gap-6, copy area flex-1) so the two rows line up. */}
      <div className="flex flex-col lg:flex-row gap-6 mb-4 p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
        <div className="w-full lg:w-80 shrink-0">
          <CustomThemePickerToggle
            enabled={customThemeEnabled}
            onChange={handleToggleCustomTheme}
          />
        </div>
        <CopyFromTheme
          editingEnabled={editingEnabled}
          onApply={handleApply}
          onPreviewTheme={setPreviewThemeId}
          undoThemeLabel={undoThemeLabel}
          onUndo={handleUndo}
        />
      </div>

      {/* Custom-theme PREVIEW scope. While enabled, `contentThemeStyle` carries
          the full custom palette as inline custom properties, so this subtree
          (the editor's main content) renders the custom theme WITHOUT touching
          the global `:root` theme; while disabled it is empty and the subtree
          inherits the current global theme. A copy-menu hover preview overrides
          it with the hovered film theme's tokens. The header + settings card
          sit OUTSIDE this scope, so the switch used to escape an unreadable
          palette stays painted in the always-readable global theme. */}
      <div
        className="flex flex-col lg:flex-row gap-6"
        style={previewStyle ?? contentThemeStyle}
      >
        <div className="shrink-0 w-full lg:w-80 space-y-4">
          {/* Colors card. ColorEditor owns its header (heading + the corner
              lock indicator). While editing is locked only the disabled
              controls dim — live text stays above its contrast floor. */}
          <div className="p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl">
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
          <ComponentShowcase />
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
