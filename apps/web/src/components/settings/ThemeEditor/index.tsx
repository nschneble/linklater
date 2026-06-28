import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useTheme } from '../../../theme/ThemeContext';
import {
  collectTokens,
  CUSTOM_TOKEN_KEYS,
  isCustomThemeConfigured,
  type CustomTheme,
} from '../../../theme/customTheme';
import { THEMES, type BaseTheme, type Mode } from '../../../theme/constants';
import AutoSaveStatus from './AutoSaveStatus';
import ColorEditor from './ColorEditor';
import ComponentShowcase from './ComponentShowcase';
import ContrastChecker from './ContrastChecker';
import CustomThemePanel from './CustomThemePanel';
import Toast from '../../common/Toast';
import { readThemeTokens } from './themeProbe';
import {
  pairsTouchingToken,
  tokenContrastFailures,
  useContrastResults,
} from './contrastResults';
import { updateMe } from '../../../lib/api';
import { useThemeCopy } from './useThemeCopy';
import { useThemeOverrides } from './useThemeOverrides';
import { useThemeSave } from './useThemeSave';
import { useToast } from '../../../lib/hooks/useToast';

/**
 * Full-page custom-theme editor reached from the user menu ("Create your
 * theme" / "Edit your theme").
 *
 * The editor NEVER changes the global site theme. The custom palette is
 * previewed by scoping it (as inline custom properties via `contentThemeStyle`)
 * to the content columns below the header — so leaving the editor can't strand
 * the whole app on custom.
 *
 * There is NO master switch: touching any color IS the act of going custom. The
 * swatches always render, seeded as a live mirror of the user's current theme;
 * the FIRST edit snapshots that (post-edit) palette as the initial custom
 * palette, enables custom, and persists it (localStorage + `PATCH /users/me`),
 * after which edits AUTOMATIC-debounced-save. An explicit fixed-color "Back to
 * {theme}" off-ramp reverts the preview to the named theme WITHOUT overwriting
 * the saved custom palette. Engage/revert are announced through the editor's
 * single polite live region ("Your theme is on and saved." / "Your theme is
 * off.").
 *
 * The editor's color mode is LOCAL (`editorMode`): the Light/Dark tabs in the
 * Colors card swap which mode's palette the content shows + edits, decoupled
 * from the global site mode — so previewing the dark palette never flips the
 * whole app. There is no on-page theme switcher. Hovering or arrow-navigating a
 * row in the copy menu previews that film theme within the content scope
 * (transient, non-persisting); activating a row applies its `editorMode` palette
 * + saves, with an Undo to revert.
 *
 * The Light/Dark toggle's active pill, the copy menu's trigger, and the "Back
 * to {theme}" off-ramp all paint from FIXED-color escape hatches (not bundle
 * tokens), and the settings card sits OUTSIDE the custom scope — so a hostile
 * custom palette can degrade the preview but never the controls needed to
 * escape it.
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

  // The editor's color mode is LOCAL — the Light/Dark tabs in the Colors card
  // swap which mode's palette the content shows + edits, WITHOUT flipping the
  // global site mode (navigating away leaves the app on whatever mode it was).
  // Seeded once from the site mode so the editor opens on the expected palette.
  const [editorMode, setEditorMode] = useState<Mode>(mode);

  const { colorValues, contentThemeStyle, setOverride, loadOverrides } =
    useThemeOverrides(editorMode);

  const editingEnabled = customThemeEnabled;
  const isCustomConfigured = isCustomThemeConfigured(customTheme);
  const baseThemeLabel =
    THEMES.find((theme) => theme.id === baseTheme)?.label ?? baseTheme;

  // Focus target for the revert off-ramp: the off-ramp button unmounts the
  // instant custom turns off, so focus must move somewhere stable first or it
  // falls to <body> (SC 2.4.3). The page <h1> is always mounted and names the
  // editor, so it reads sensibly when focus lands on it.
  const headingReference = useRef<HTMLHeadingElement>(null);

  // Guards the engage-on-first-edit path: a native color picker fires a burst
  // of `onChange`s during a single drag, and the enabled flag only commits
  // between events — this stops two of them firing two engage PATCHes.
  const engagingReference = useRef(false);

  // Hovering/arrow-navigating a copy-menu row previews that film theme — scoped
  // to the editor's content (the same wrapper that scopes the custom palette),
  // so the preview shows where the showcase is and never touches the global
  // theme or the app nav. Reverts to `null` when the menu closes.
  const [previewThemeId, setPreviewThemeId] = useState<BaseTheme | null>(null);
  const previewStyle = useMemo<CSSProperties | null>(
    () =>
      previewThemeId
        ? (readThemeTokens(previewThemeId, editorMode) as CSSProperties)
        : null,
    [previewThemeId, editorMode],
  );

  const { isSaving, save } = useThemeSave(editorMode);
  const toast = useToast();

  const contrastResults = useContrastResults(colorValues);

  const contrastFailures = useMemo(
    () => tokenContrastFailures(contrastResults),
    [contrastResults],
  );

  // The knobs read the both-endpoints view so a too-light Page/Cards/Alerts
  // BACKGROUND flags on its knob; the drawer's rows keep the foreground-keyed
  // view above.
  const knobFailures = useMemo(
    () => pairsTouchingToken(contrastResults),
    [contrastResults],
  );

  const onSaveFailed = useCallback(() => toast.show('save-failed'), [toast]);

  const {
    scheduleSave,
    announce,
    savedCount,
    savedMessage,
    undoThemeLabel,
    clearUndo,
    handleApply,
    handleUndo,
  } = useThemeCopy({
    editingEnabled,
    baseTheme,
    editorMode,
    colorValues,
    save,
    loadOverrides,
    onSaveFailed,
  });

  // The first edit IS going custom: seed the palette from the POST-EDIT values,
  // enable, persist, and announce once. The edited mode is seeded from the
  // explicit post-edit map { ...colorValues, [variable]: value } (NOT a fresh
  // `readThemeTokens` probe — that would drop the just-made edit and snap the
  // open color picker back mid-drag); the other mode is probed off the current
  // theme. When a saved palette already exists (the user reverted earlier), the
  // edit merges into it so re-engaging restores their colors (a11y brief §4).
  // Optimistic — on PATCH failure it rolls the enabled flag + palette back.
  const engageCustomTheme = useCallback(
    async (
      variables: Array<Parameters<typeof setOverride>[0]>,
      value: string,
      postEditValues: Record<Parameters<typeof setOverride>[0], string>,
    ) => {
      const previousCustomTheme = customTheme;
      setCustomThemeEnabled(true);

      const otherMode: Mode = editorMode === 'dark' ? 'light' : 'dark';
      // The edited mode's slots — either merged into the saved palette
      // (re-engage after a revert, all edited variables snapped to `value`) or
      // the full post-edit snapshot (fresh). A knob edits several variables at
      // once, so merge them all rather than a single slot.
      const editedModeTokens = isCustomConfigured
        ? {
            ...(customTheme?.[editorMode] ?? {}),
            ...Object.fromEntries(
              variables.map((variable) => [variable, value]),
            ),
          }
        : collectTokens(
            CUSTOM_TOKEN_KEYS,
            (key) => postEditValues[key as Parameters<typeof setOverride>[0]],
          );
      // The other mode keeps its saved tokens (re-engage) or is probed fresh.
      const otherModeTokens = isCustomConfigured
        ? { ...(customTheme?.[otherMode] ?? {}) }
        : readThemeTokens(baseTheme, otherMode);

      const seeded: CustomTheme = {
        dark: editorMode === 'dark' ? editedModeTokens : otherModeTokens,
        light: editorMode === 'light' ? editedModeTokens : otherModeTokens,
      };

      setCustomTheme(seeded);
      try {
        // This engage PATCH is fired DIRECTLY, outside `useThemeAutoSave`'s
        // in-flight serialization (`flush`), because it must atomically carry
        // BOTH the enable flag and the freshly-probed seed AND own its own
        // optimistic enable/palette rollback — none of which the serialized
        // current-mode `save` path models. It is not racy in practice: engage
        // is triggered by the FIRST edit, while any scheduled save can only be
        // armed by a LATER edit (custom is now on) and won't flush until 700ms
        // after that, by which point this engage PATCH has long since landed.
        await updateMe({ customThemeEnabled: true, customTheme: seeded });
        announce('Your theme is on and saved.');
      } catch {
        setCustomThemeEnabled(false);
        // Restore the prior palette; an empty map reads as "not configured"
        // so a never-seeded user lands back where they started.
        setCustomTheme(previousCustomTheme ?? { dark: {}, light: {} });
        toast.show('custom-theme-toggle-failed');
      } finally {
        engagingReference.current = false;
      }
    },
    [
      announce,
      baseTheme,
      customTheme,
      editorMode,
      isCustomConfigured,
      setCustomTheme,
      setCustomThemeEnabled,
      toast,
    ],
  );

  // Apply an edit to one or more variables in a single pass: the first edit
  // goes custom (engaging once, even across a knob's multi-token write), later
  // edits debounce-save. A knob passes all its constituent tokens together so
  // the engage snapshot and the saved palette never miss any of them.
  function editTokens(
    variables: Array<Parameters<typeof setOverride>[0]>,
    value: string,
  ) {
    const postEditValues = { ...colorValues };
    for (const variable of variables) {
      postEditValues[variable] = value;
      setOverride(variable, value);
    }
    clearUndo();
    if (!customThemeEnabled) {
      // First edit — go custom. The guard absorbs a color picker's drag burst.
      if (engagingReference.current) return;
      engagingReference.current = true;
      void engageCustomTheme(variables, value, postEditValues);
    } else {
      scheduleSave();
    }
  }

  function handleOverride(
    variable: Parameters<typeof setOverride>[0],
    value: string,
  ) {
    editTokens([variable], value);
  }

  // A knob flattens every constituent token to the new value in one write
  // (destructively overwriting any per-surface value set in the drawer).
  function handleKnobOverride(
    variables: Array<Parameters<typeof setOverride>[0]>,
    value: string,
  ) {
    editTokens(variables, value);
  }

  // Revert off-ramp. Moves focus to the page heading BEFORE the button unmounts
  // (the button only renders while custom is active, so focusing afterwards
  // would chase a gone node and drop to <body> — SC 2.4.3), turns custom off,
  // and announces. The saved palette is untouched, so re-engaging restores it.
  // Optimistic — a failed PATCH re-enables custom and routes the error to the
  // assertive Toast.
  const handleRevert = useCallback(async () => {
    headingReference.current?.focus();
    setCustomThemeEnabled(false);
    announce('Your theme is off.');
    try {
      await updateMe({ customThemeEnabled: false });
    } catch {
      setCustomThemeEnabled(true);
      toast.show('custom-theme-toggle-failed');
    }
  }, [announce, setCustomThemeEnabled, toast]);

  const toastView = useMemo(() => resolveToast(toast.message), [toast.message]);

  // Each content card carries the shared mount surface + the link-card enter
  // fade. The stagger comes from the per-card animation delay; reduced-motion is
  // handled globally (the CSS clamp). The cards always render now (turning custom
  // off only swaps the previewed palette, it never unmounts the controls), so
  // the enter fade plays once on page load.
  const cardClassName =
    'p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-xl animate-card-enter';
  function cardDelayStyle(index: number): CSSProperties {
    return { animationDelay: `${index * 60}ms` };
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header: title + intro fill the LEFT half; the save status sits
          top-right, aligned against the title. (The Light/Dark control lives in
          the Colors card now, since it swaps the editor's palette, not chrome.) */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0 sm:max-w-[50%]">
          <h1
            ref={headingReference}
            tabIndex={-1}
            className="text-[var(--base-text)] text-lg font-semibold focus:outline-none"
          >
            Your theme
          </h1>
          <p className="mt-1 text-[var(--base-alt-text)] text-xs">
            Build your own theme and preview it live. Saves as you go.
          </p>
        </div>

        <AutoSaveStatus
          enabled={editingEnabled}
          isSaving={isSaving}
          savedCount={savedCount}
          savedMessage={savedMessage}
          failingCount={contrastResults.totalFailures}
        />
      </div>

      {/* Master-control card: the "Back to {theme}" off-ramp (shown only while
          custom is active) + the copy-palette shortcut. It sits OUTSIDE the
          custom-theme preview scope (see below) so the controls needed to escape
          an unreadable palette always paint in the always-legible escape-hatch
          colors, never the injected custom palette. */}
      <div className="mb-4">
        <CustomThemePanel
          active={customThemeEnabled}
          baseThemeLabel={baseThemeLabel}
          onRevert={handleRevert}
          onApply={handleApply}
          onPreviewTheme={setPreviewThemeId}
          undoThemeLabel={undoThemeLabel}
          onUndo={handleUndo}
        />
      </div>

      {/* Editing content. The swatches ALWAYS render now (seeded as a live
          mirror of the current theme); the first edit is what goes custom, and
          turning custom off only swaps the previewed palette — it never unmounts
          these controls, so keyboard focus is never stranded.

          Custom-theme PREVIEW scope: `contentThemeStyle` carries the full
          custom palette as inline custom properties, so this subtree renders
          the custom theme WITHOUT touching the global `:root`. A copy-menu hover
          preview overrides it with the hovered film theme's tokens. The header +
          settings card sit OUTSIDE this scope, so the off-ramp used to escape an
          unreadable palette stays painted in its fixed escape-hatch colors. */}
      <div
        className="flex flex-col lg:flex-row gap-6"
        style={previewStyle ?? contentThemeStyle}
      >
        <div className="shrink-0 w-full lg:w-80 space-y-4">
          <div className={cardClassName} style={cardDelayStyle(0)}>
            <ColorEditor
              colorValues={colorValues}
              contrastFailures={contrastFailures}
              knobFailures={knobFailures}
              baseThemeLabel={baseThemeLabel}
              customActive={customThemeEnabled}
              onOverride={handleOverride}
              onKnobOverride={handleKnobOverride}
              editorMode={editorMode}
              onEditorModeChange={setEditorMode}
            />
          </div>

          <div className={cardClassName} style={cardDelayStyle(1)}>
            <h2 className="mb-3 text-[var(--mount-alt-text)] text-[0.65rem] uppercase tracking-wide font-semibold">
              Contrast (WCAG 2.1)
            </h2>
            <ContrastChecker results={contrastResults} />
          </div>
        </div>

        {/* The right column is layout-only: no card chrome and no visible
            heading. The mock already looks like the app, so a card-in-a-card
            "Components" frame would be redundant. It animates in as the third
            card; ComponentShowcase owns its own sr-only "Live preview" heading
            for assistive tech. */}
        <div
          className="flex-1 min-w-0 animate-card-enter"
          style={cardDelayStyle(2)}
        >
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
