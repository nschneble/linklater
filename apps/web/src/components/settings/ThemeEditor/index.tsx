import { BUNDLES, type Bundle } from './useThemeOverrides';
import ColorEditor from './ColorEditor';
import ComponentShowcase from './ComponentShowcase';
import { generateRandomPalette } from './randomPalette';
import IconButton from '../../common/IconButton';
import ModeToggle, { modeTabId } from './ModeToggle';
import { pairsTouchingToken } from './contrastResults.notes';
import RandomizeButton from './RandomizeButton';
import { readThemeTokens } from './themeProbe';
import {
  resolveContrastStatus,
  useContrastResults,
  type ContrastStatus,
} from './contrastResults';
import { THEMES, type Mode } from '../../../theme/constants';
import Toast from '../../common/Toast';
import { useAnnouncer } from './useAnnouncer';
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import { useThemeCopy } from './useThemeCopy';
import { useThemeEngagement } from './useThemeEngagement';
import { useThemeOverrides } from './useThemeOverrides';
import { useThemeSave } from './useThemeSave';
import { useToast } from '../../../lib/hooks/useToast';

const EDITOR_MODE_LABELS: Record<Mode, string> = {
  light: 'Light',
  dark: 'Dark',
};

// single role="tabpanel" the Light/Dark tabs control
/*
 * Three states, not two: "couldn't be checked" is its own answer rather than
 * being folded into either verdict. The glyphs differ in SHAPE as well as
 * color so the distinction survives without color (SC 1.4.1).
 */
const CONTRAST_STATUS_LABEL: Record<ContrastStatus, string> = {
  fail: "Theme colors don't meet minimum contrast",
  uncheckable: "Some theme colors couldn't be checked for contrast",
  pass: 'Theme colors meet minimum contrast',
};

const CONTRAST_STATUS_ICON: Record<ContrastStatus, string> = {
  fail: 'fa-triangle-exclamation text-[var(--warn-text)]',
  uncheckable: 'fa-circle-info text-[var(--base-subtle-text)]',
  pass: 'fa-circle-check text-[var(--base-subtle-text)]',
};

const EDITOR_PANEL_ID = 'theme-editor-panel';

// aria-describedby target naming why copy is disabled, for AT users
const COPY_REDUNDANT_HINT_ID = 'theme-editor-copy-redundant-hint';

/**
 * Full-page custom-theme editor reached from the user menu ("Create your
 * theme" / "Edit your theme").
 *
 * The editor NEVER changes the global site theme. The custom palette is
 * previewed by scoping it (as inline custom properties via `contentThemeStyle`)
 * to the decorative app mock in the live-preview column ALONE — so the Colors
 * card the user edits with stays painted in the always-readable app theme, and
 * leaving the editor can't strand the whole app on custom.
 *
 * There is NO master switch and no off-ramp: touching any color IS the act of
 * going custom. The swatches always render, seeded as a live mirror of the
 * user's current theme; the FIRST edit snapshots that (post-edit) palette as the
 * initial custom palette, enables custom, and persists it (localStorage + `PATCH
 * /users/me`), after which edits AUTOMATIC-debounced-save. There is no path back
 * to the prior theme by design — copying the active film theme overwrites the
 * custom palette, which is the surviving recovery from an unreadable one.
 * Engage + copy are announced through the editor's single polite live
 * region ("Your theme is on and saved." / "{label} palette applied and saved.").
 *
 * The editor's color mode is LOCAL (`editorMode`): the Light/Dark toggle in the
 * header toolbar swaps which mode's palette the content shows + edits, decoupled
 * from the global site mode — so previewing the dark palette never flips the
 * whole app. There is no on-page theme switcher.
 *
 * The toolbar mirrors the "Your links" toolbar: the Light/Dark toggle leads on
 * the left, Randomize + a single "Copy {baseThemeLabel}" action follow on the
 * right. The copy action seeds the custom palette from the currently-active film
 * theme; it stays visible even once custom is on (so it can overwrite a
 * customized palette). The title row carries a NON-interactive status
 * icon (check / triangle) summarizing whether the live palette clears the
 * contrast contract — a roll-up of the per-slot row failures, never an
 * auto-announced one.
 *
 * The Light/Dark toggle (the shared SlidingTabBar), Randomize, and Copy (shared
 * elevated IconButtons) all read as ordinary app chrome painted from bundle
 * tokens — the same controls the "Your links" toolbar uses — so they look and
 * behave identically to the rest of the app and degrade with the active theme
 * like all other chrome. (Recovery from a saved-but-unreadable custom theme is a
 * tracked follow-up: there is currently no guaranteed-legible global escape.)
 */
export default function ThemeEditor() {
  const {
    baseTheme,
    customTheme,
    customThemeEnabled,
    mode,
    setCustomTheme,
    setCustomThemeEnabled,
  } = useTheme();

  // local editor mode; seeded once from site mode so it opens as expected
  const [editorMode, setEditorMode] = useState<Mode>(mode);

  // owned here (not in the tablist) so tablist + preview share one selection
  const [activeBundle, setActiveBundle] = useState<Bundle>(BUNDLES[0]);

  // bumped on Randomize to re-stagger the preview; only remounts the mock
  const [randomizeNonce, setRandomizeNonce] = useState(0);

  const { colorValues, contentThemeStyle, setOverride, loadOverrides } =
    useThemeOverrides(editorMode);

  const editingEnabled = customThemeEnabled;
  const baseThemeLabel =
    THEMES.find((theme) => theme.id === baseTheme)?.label ?? baseTheme;

  // no-op (aria-disabled) when nothing to copy: custom off, or custom active
  const copyDisabled = !customThemeEnabled || baseTheme === 'custom';
  const copyDisabledReason = !customThemeEnabled
    ? `Already using ${baseThemeLabel}'s colors. Edit a color or Randomize to start a custom theme.`
    : `${baseThemeLabel} is already active, so there's nothing to copy. Edit a color or Randomize to change it.`;

  const { save } = useThemeSave(editorMode);
  const toast = useToast();

  const onEngageError = useCallback(
    () => toast.show('custom-theme-toggle-failed'),
    [toast],
  );
  // go-custom orchestration lives in useThemeEngagement; here just wiring
  const { engageFromEdit, engageFromRandom } = useThemeEngagement({
    baseTheme,
    customTheme,
    customThemeEnabled,
    editorMode,
    setCustomTheme,
    setCustomThemeEnabled,
    onError: onEngageError,
  });

  const contrastResults = useContrastResults(colorValues);

  // both-endpoints view: a too-light bg flags on whichever slot set it
  const failures = useMemo(
    () => pairsTouchingToken(contrastResults),
    [contrastResults],
  );

  const onSaveFailed = useCallback(() => toast.show('save-failed'), [toast]);

  const {
    scheduleSave,
    announce,
    savedCount,
    savedMessage,
    applyPalette,
    handleApplyRandom,
  } = useThemeCopy({
    editingEnabled,
    colorValues,
    save,
    loadOverrides,
    onSaveFailed,
  });

  // on: copy-over; off: go custom. only the current mode is regenerated
  const handleRandomize = useCallback(() => {
    const palette = generateRandomPalette(editorMode);
    setRandomizeNonce((current) => current + 1);
    if (customThemeEnabled) {
      handleApplyRandom(palette);
    } else {
      engageFromRandom({
        palette,
        applyPaletteToPreview: () => loadOverrides(palette),
        onSuccess: () =>
          announce('Your theme is on. Random palette applied and saved.'),
      });
    }
  }, [
    announce,
    customThemeEnabled,
    editorMode,
    engageFromRandom,
    handleApplyRandom,
    loadOverrides,
  ]);

  // overwrite live palette with the active film theme's current-mode colors
  const handleCopyFromBaseTheme = useCallback(() => {
    if (!customThemeEnabled || baseTheme === 'custom') return;
    applyPalette(
      readThemeTokens(baseTheme, editorMode),
      `${baseThemeLabel} palette applied and saved.`,
    );
  }, [applyPalette, baseTheme, baseThemeLabel, customThemeEnabled, editorMode]);

  // first edit goes custom, later edits debounce-save; mutex collapses burst
  function handleOverride(
    variable: Parameters<typeof setOverride>[0],
    value: string,
  ) {
    const postEditValues = { ...colorValues, [variable]: value };
    setOverride(variable, value);
    if (!customThemeEnabled) {
      engageFromEdit({
        variable,
        value,
        postEditValues,
        onSuccess: () => announce('Your theme is on and saved.'),
      });
    } else {
      scheduleSave();
    }
  }

  const toastView = useMemo(() => resolveToast(toast.message), [toast.message]);

  // clear-then-set re-trigger so an identical repeat message re-announces
  const announcement = useAnnouncer(savedCount, savedMessage);

  // supplementary roll-up for title-row status icon; rows stay authoritative
  const contrastStatus = resolveContrastStatus(contrastResults);

  // mount surface + card-enter fade; per-card delay staggers; always mounted
  const cardClassName =
    'p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl animate-card-enter';
  function cardDelayStyle(index: number): CSSProperties {
    return { animationDelay: `${index * 60}ms` };
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header: title + intro. The title row mirrors the "Your links" page
          (LinksView) — a single h1 on the left, a right-aligned glyph in the
          slot LinksView uses for its keyboard-shortcuts button. Here that glyph
          is a NON-interactive contrast-status icon (a11y brief R-A7). */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[var(--base-text)] text-lg font-semibold">
            Theme editor
          </h1>
          {/* Contrast roll-up: a check when the live palette clears the contract,
              a triangle when a pair fails. role="img" + a silently-updating
              aria-label, NOT a button and NOT in the tab order (R-A1). NO
              aria-live: save state is already spoken by the polite region and a
              picker drag must not spam announcements (R-A3). Distinct glyphs
              carry the meaning without color (R-A5). It paints --success-text /
              --warn-text on the page --base-bg, both ≥4.5:1 across every theme
              (R-A6) — no fixed escape hatch, it degrades with the palette like
              the inline failure text (accepted, it is supplementary). */}
          <i
            role="img"
            aria-label={CONTRAST_STATUS_LABEL[contrastStatus]}
            title={CONTRAST_STATUS_LABEL[contrastStatus]}
            className={`fa-solid text-sm ${CONTRAST_STATUS_ICON[contrastStatus]}`}
          />
        </div>
        <p className="mt-1 text-[var(--base-alt-text)] text-xs">
          All changes are saved automatically.
        </p>
      </div>

      {/* The editor's single polite live region. Mounted UNCONDITIONALLY (not
          gated on custom being on) and visually hidden — each settled save /
          engage announces here exactly once via the clear-then-set re-trigger
          (a11y brief §1). */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Header toolbar, modeled on the "Your links" toolbar (LinksToolbar):
          the Light/Dark palette toggle leads on the left (like the links tabs)
          and the Randomize + copy actions follow on the right. The SettingsGroup
          card wrapper is dropped (PRD point 8); these controls live in this bare
          strip.

          The strip is a SIBLING ABOVE the preview-scoped content div, so the
          mode toggle, Randomize, and copy have NO ancestor carrying the
          injected custom palette (`style={contentThemeStyle}`) — the preview can
          go custom without dragging the toolbar with it. The mode toggle (shared
          SlidingTabBar) + Randomize/copy (shared elevated IconButtons) paint
          from bundle tokens like the rest of the chrome. Randomize fills the
          CURRENT mode's slots with a generated WCAG-AA palette (and goes custom
          if off) (PRD point 11). */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <ModeToggle
          mode={editorMode}
          onModeChange={setEditorMode}
          ariaLabel="Palette to edit"
          labels={EDITOR_MODE_LABELS}
          panelId={EDITOR_PANEL_ID}
        />
        <div className="flex items-center gap-3 sm:ml-auto">
          <RandomizeButton onRandomize={handleRandomize} />
          {/* Overwrite the live custom palette with the active film theme's
              colors. It is the shared elevated IconButton (peer to Randomize,
              same control the "Your links" toolbar uses for Stumble), so it reads
              as ordinary chrome and paints from bundle tokens.

              When the copy would change nothing — custom is OFF (the editor
              already previews this exact theme) or the custom theme is ITSELF
              active — the button is INERT via `aria-disabled` (NOT the native
              `disabled` attribute, which would drop it from the tab order and
              announce no reason). aria-disabled keeps it focusable, so
              `aria-describedby` can tell an AT user WHY it's unavailable, and the
              click is a no-op guard in the handler. Styling is driven off the
              attribute (`aria-disabled:` variants), never a JS ternary. The
              source theme is named in the label; the clone glyph is decorative
              (R-E1/R-E2). */}
          <IconButton
            variant="elevated"
            surface="base"
            onClick={handleCopyFromBaseTheme}
            aria-disabled={copyDisabled || undefined}
            aria-describedby={copyDisabled ? COPY_REDUNDANT_HINT_ID : undefined}
            className="aria-disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:active:scale-100"
          >
            <i className="fa-solid fa-clone" aria-hidden="true" />
            Copy {baseThemeLabel}
          </IconButton>
          {copyDisabled && (
            <span id={COPY_REDUNDANT_HINT_ID} className="sr-only">
              {copyDisabledReason}
            </span>
          )}
        </div>
      </div>

      {/* Editing content. The swatches ALWAYS render now (seeded as a live
          mirror of the current theme); the first edit is what goes custom, and
          turning custom off only swaps the previewed palette — it never unmounts
          these controls, so keyboard focus is never stranded.

          PREVIEW-SCOPE INVERSION (PRD point 9): the custom palette is NO LONGER
          scoped to this whole two-column row. The LEFT Colors card renders in the
          APP THEME (a contrast win — its chrome + focus ring now resolve from the
          always-readable global theme, never a hostile custom palette), while
          ONLY the decorative mock inside ComponentShowcase carries
          `contentThemeStyle`. The header + toolbar stay outside any scope, so the
          Randomize recovery is always painted in the app theme. */}
      <div
        id={EDITOR_PANEL_ID}
        role="tabpanel"
        aria-labelledby={modeTabId(editorMode)}
        className="flex flex-col lg:flex-row gap-6"
      >
        <div className="shrink-0 w-full lg:w-72 space-y-4">
          <div className={cardClassName} style={cardDelayStyle(0)}>
            <ColorEditor
              colorValues={colorValues}
              failures={failures}
              baseThemeLabel={baseThemeLabel}
              customActive={customThemeEnabled}
              onOverride={handleOverride}
              activeBundle={activeBundle}
              onActiveBundleChange={setActiveBundle}
            />
          </div>
        </div>

        {/* The right column is layout-only: no card chrome and no visible
            heading. The mock already looks like the app, so a card-in-a-card
            "Components" frame would be redundant. It animates in as the second
            card (the retired contrast card freed index 1), so the enter-stagger
            has no gap; ComponentShowcase owns its own sr-only "Live preview"
            heading + the visible per-bundle explanation, and carries the custom
            palette on its decorative mock alone. */}
        <div
          className="flex-1 min-w-0 animate-card-enter"
          style={cardDelayStyle(1)}
        >
          <ComponentShowcase
            activeBundle={activeBundle}
            editorMode={editorMode}
            randomizeNonce={randomizeNonce}
            contentThemeStyle={contentThemeStyle}
          />
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
 * Auto-save SUCCESS (incl. copy/undo) is announced by the editor's polite live
 * region — only the assertive FAILURE paths route here.
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
