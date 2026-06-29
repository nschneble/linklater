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
import ColorEditor from './ColorEditor';
import ComponentShowcase from './ComponentShowcase';
import CopyFromTheme from './CopyFromTheme';
import RandomizeButton from './RandomizeButton';
import Toast from '../../common/Toast';
import { BUNDLES, type Bundle } from './useThemeOverrides';
import { readThemeTokens } from './themeProbe';
import { generateRandomPalette } from './randomPalette';
import { pairsTouchingToken, useContrastResults } from './contrastResults';
import { updateMe } from '../../../lib/api';
import { useAnnouncer } from './useAnnouncer';
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
 * to the decorative app mock in the live-preview column ALONE — so the Colors
 * card the user edits with stays painted in the always-readable app theme, and
 * leaving the editor can't strand the whole app on custom.
 *
 * There is NO master switch and no off-ramp: touching any color IS the act of
 * going custom. The swatches always render, seeded as a live mirror of the
 * user's current theme; the FIRST edit snapshots that (post-edit) palette as the
 * initial custom palette, enables custom, and persists it (localStorage + `PATCH
 * /users/me`), after which edits AUTOMATIC-debounced-save. There is no path back
 * to the prior theme by design — copying any film theme in the picker overwrites
 * the custom palette, which is the surviving recovery from an unreadable one.
 * Engage + copy/undo are announced through the editor's single polite live
 * region ("Your theme is on and saved." / "{label} palette applied and saved.").
 *
 * The editor's color mode is LOCAL (`editorMode`): the Light/Dark tabs in the
 * Colors card swap which mode's palette the content shows + edits, decoupled
 * from the global site mode — so previewing the dark palette never flips the
 * whole app. There is no on-page theme switcher. Hovering or arrow-navigating a
 * row in the copy menu previews that film theme within the content scope
 * (transient, non-persisting); activating a row applies its `editorMode` palette
 * + saves, with an Undo to revert.
 *
 * The Light/Dark toggle's active pill and the copy menu's trigger both paint
 * from FIXED-color escape hatches (not bundle tokens), and the copy strip sits
 * OUTSIDE the custom scope — so a hostile custom palette can degrade the preview
 * but never the controls needed to escape it.
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

  // The active bundle is OWNED here (not inside the tablist) so BOTH the tablist
  // and the live preview read the same selection: picking a bundle both swaps
  // the editable slots AND swaps the previewed component (PRD point 4).
  const [activeBundle, setActiveBundle] = useState<Bundle>(BUNDLES[0]);

  const { colorValues, contentThemeStyle, setOverride, loadOverrides } =
    useThemeOverrides(editorMode);

  const editingEnabled = customThemeEnabled;
  const isCustomConfigured = isCustomThemeConfigured(customTheme);
  const baseThemeLabel =
    THEMES.find((theme) => theme.id === baseTheme)?.label ?? baseTheme;

  // Guards the engage-on-first-edit path: a native color picker fires a burst
  // of `onChange`s during a single drag, and the enabled flag only commits
  // between events — this stops two of them firing two engage PATCHes.
  const engagingReference = useRef(false);

  // Copying a theme while custom is OFF can clobber an EXISTING saved palette (a
  // returning user who reverted earlier). We snapshot that palette so an Undo
  // can restore it + turn custom back off (a never-configured user has nothing
  // to lose, so no Undo is offered then).
  const [engageUndo, setEngageUndo] = useState<{
    customTheme: CustomTheme;
    label: string;
  } | null>(null);

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

  const { save } = useThemeSave(editorMode);
  const toast = useToast();

  const contrastResults = useContrastResults(colorValues);

  // Each slot row reads the both-endpoints view, so a too-light BACKGROUND
  // flags on whichever slot set it — not only on the far foreground slot (C3).
  // The standalone contrast card is retired; this map is the inline guardrail.
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
    undoThemeLabel,
    clearUndo,
    handleApply,
    handleApplyRandom,
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
      variable: Parameters<typeof setOverride>[0],
      value: string,
      postEditValues: Record<Parameters<typeof setOverride>[0], string>,
    ) => {
      const previousCustomTheme = customTheme;
      setCustomThemeEnabled(true);

      const otherMode: Mode = editorMode === 'dark' ? 'light' : 'dark';
      // The edited mode's slots — either the edited slot merged into the saved
      // palette (re-engage after a revert) or the full post-edit snapshot
      // (fresh).
      const editedModeTokens = isCustomConfigured
        ? {
            ...(customTheme?.[editorMode] ?? {}),
            [variable]: value,
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

  // Copying a theme while custom is OFF is ALSO a way to go custom — equal to
  // editing a color. It seeds the palette from the picked theme for BOTH modes
  // (a copy means "start from this whole theme", not just the shown mode),
  // enables, persists, and announces — all in ONE direct PATCH + ONE announce
  // (mirroring `engageCustomTheme`; routing through the debounced copy save
  // would double-bump the live region and swallow this utterance). When a saved
  // palette already existed it is snapshotted for Undo, since the copy
  // overwrites it (a11y FLAG 1 — copying keeps the COPIED colors, so it is not
  // a path back to the originals).
  const engageFromTheme = useCallback(
    async (themeId: BaseTheme, themeLabel: string) => {
      if (engagingReference.current) return;
      engagingReference.current = true;

      const previousCustomTheme = customTheme;
      const hadSavedPalette = isCustomConfigured;
      const otherMode: Mode = editorMode === 'dark' ? 'light' : 'dark';
      const editedModeTokens = readThemeTokens(themeId, editorMode);
      const otherModeTokens = readThemeTokens(themeId, otherMode);
      const seeded: CustomTheme = {
        dark: editorMode === 'dark' ? editedModeTokens : otherModeTokens,
        light: editorMode === 'light' ? editedModeTokens : otherModeTokens,
      };

      setCustomThemeEnabled(true);
      setCustomTheme(seeded);
      loadOverrides(editedModeTokens);
      clearUndo();
      try {
        await updateMe({ customThemeEnabled: true, customTheme: seeded });
        if (hadSavedPalette && previousCustomTheme) {
          setEngageUndo({
            customTheme: previousCustomTheme,
            label: themeLabel,
          });
        }
        announce(`Your theme is on. ${themeLabel} palette applied and saved.`);
      } catch {
        setCustomThemeEnabled(false);
        setCustomTheme(previousCustomTheme ?? { dark: {}, light: {} });
        toast.show('custom-theme-toggle-failed');
      } finally {
        engagingReference.current = false;
      }
    },
    [
      announce,
      clearUndo,
      customTheme,
      editorMode,
      isCustomConfigured,
      loadOverrides,
      setCustomTheme,
      setCustomThemeEnabled,
      toast,
    ],
  );

  // Randomize while custom is OFF is ALSO a way to go custom (PRD point 11) —
  // equal to editing a color or copying a theme. It generates a WCAG-AA palette
  // for `editorMode` ONLY (HARD scope: cross-bundle pairs are only guaranteed
  // within one generated mode) and, like `engageCustomTheme`, PRESERVES the
  // other mode: a returning user's saved other-mode palette is kept (re-engage),
  // else the other mode is probed fresh off the current theme. It enables +
  // seeds BOTH modes, loads the editor overrides, persists in ONE direct PATCH,
  // and announces ONCE through the polite region. When a saved palette already
  // existed it is snapshotted for Undo (the random palette overwrote it).
  const engageFromRandom = useCallback(
    async (palette: Record<Parameters<typeof setOverride>[0], string>) => {
      if (engagingReference.current) return;
      engagingReference.current = true;

      const previousCustomTheme = customTheme;
      const hadSavedPalette = isCustomConfigured;
      const otherMode: Mode = editorMode === 'dark' ? 'light' : 'dark';
      // Keep the other mode's saved tokens (re-engage) or probe them fresh —
      // the random palette only ever touches `editorMode` (§3).
      const otherModeTokens = isCustomConfigured
        ? { ...(customTheme?.[otherMode] ?? {}) }
        : readThemeTokens(baseTheme, otherMode);
      const seeded: CustomTheme = {
        dark: editorMode === 'dark' ? palette : otherModeTokens,
        light: editorMode === 'light' ? palette : otherModeTokens,
      };

      setCustomThemeEnabled(true);
      setCustomTheme(seeded);
      loadOverrides(palette);
      clearUndo();
      try {
        await updateMe({ customThemeEnabled: true, customTheme: seeded });
        if (hadSavedPalette && previousCustomTheme) {
          setEngageUndo({
            customTheme: previousCustomTheme,
            label: 'random palette',
          });
        }
        announce('Your theme is on. Random palette applied and saved.');
      } catch {
        setCustomThemeEnabled(false);
        setCustomTheme(previousCustomTheme ?? { dark: {}, light: {} });
        toast.show('custom-theme-toggle-failed');
      } finally {
        engagingReference.current = false;
      }
    },
    [
      announce,
      baseTheme,
      clearUndo,
      customTheme,
      editorMode,
      isCustomConfigured,
      loadOverrides,
      setCustomTheme,
      setCustomThemeEnabled,
      toast,
    ],
  );

  // Randomize dispatcher: while custom is already on it is a copy-over with its
  // own Undo (`handleApplyRandom`); while off it goes custom (`engageFromRandom`).
  // Either way the palette is generated ONCE for the current editor mode and the
  // OTHER mode is left untouched (HARD scope: cross-bundle pairs are only
  // guaranteed within one mode's generated palette).
  const handleRandomize = useCallback(() => {
    const palette = generateRandomPalette(editorMode);
    if (customThemeEnabled) {
      setEngageUndo(null);
      handleApplyRandom(palette);
    } else {
      void engageFromRandom(palette);
    }
  }, [customThemeEnabled, editorMode, engageFromRandom, handleApplyRandom]);

  // Undo for a copy that overwrote an existing saved palette: restore the prior
  // palette and turn custom back OFF (the state the user copied from). On PATCH
  // failure, roll back to the just-copied on-state. Focus return to the menu
  // trigger is handled by `CopyFromTheme` (this label going null unmounts the
  // button, so focus must move first — SC 2.4.3).
  const handleEngageUndo = useCallback(async () => {
    if (!engageUndo) return;
    const restored = engageUndo.customTheme;
    const copied = customTheme;
    setEngageUndo(null);
    setCustomThemeEnabled(false);
    setCustomTheme(restored);
    announce('Reverted to previous colors.');
    try {
      await updateMe({ customThemeEnabled: false, customTheme: restored });
    } catch {
      setCustomThemeEnabled(true);
      setCustomTheme(copied ?? restored);
      toast.show('custom-theme-toggle-failed');
    }
  }, [
    announce,
    customTheme,
    engageUndo,
    setCustomTheme,
    setCustomThemeEnabled,
    toast,
  ]);

  // Picking a theme in the copy menu: while custom is already on it is a
  // copy-over with its own Undo (`handleApply`); while off it is a way to GO
  // custom (`engageFromTheme`). A later copy-over supersedes any engage Undo.
  const handleCopyTheme = useCallback(
    (themeId: BaseTheme, themeLabel: string) => {
      if (customThemeEnabled) {
        setEngageUndo(null);
        handleApply(themeId, themeLabel);
      } else {
        void engageFromTheme(themeId, themeLabel);
      }
    },
    [customThemeEnabled, engageFromTheme, handleApply],
  );

  // Apply an edit to a slot: the first edit goes custom (engaging once), later
  // edits debounce-save.
  function editTokens(
    variable: Parameters<typeof setOverride>[0],
    value: string,
  ) {
    const postEditValues = { ...colorValues, [variable]: value };
    setOverride(variable, value);
    clearUndo();
    setEngageUndo(null);
    if (!customThemeEnabled) {
      // First edit — go custom. The guard absorbs a color picker's drag burst.
      if (engagingReference.current) return;
      engagingReference.current = true;
      void engageCustomTheme(variable, value, postEditValues);
    } else {
      scheduleSave();
    }
  }

  function handleOverride(
    variable: Parameters<typeof setOverride>[0],
    value: string,
  ) {
    editTokens(variable, value);
  }

  const toastView = useMemo(() => resolveToast(toast.message), [toast.message]);

  // The single polite live region's rendered text, re-triggered (clear-then-set)
  // on each settled save / engage / undo so even an identical consecutive
  // message re-announces (a11y brief §1).
  const announcement = useAnnouncer(savedCount, savedMessage);

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
      {/* Header: title + intro. (The Light/Dark control lives in the Colors
          region now, since it swaps the editor's palette, not chrome.) */}
      <div className="mb-6">
        <h1 className="text-[var(--base-text)] text-lg font-semibold">
          Theme editor
        </h1>
        <p className="mt-1 text-[var(--base-alt-text)] text-xs">
          All changes are saved automatically.
        </p>
      </div>

      {/* The editor's single polite live region. Mounted UNCONDITIONALLY (not
          gated on custom being on) so a revert still speaks through it, and
          visually hidden — each settled save / engage / undo announces here
          exactly once via the clear-then-set re-trigger (a11y brief §1). */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Global Colors-region actions. The SettingsGroup card wrapper is dropped
          (PRD point 8); the controls live in this bare selector strip. The strip
          is a SIBLING ABOVE the preview-scoped content div, so the Randomize +
          copy-menu triggers — the surviving keyboard-reachable recovery paths
          back to a readable palette — have NO ancestor carrying the injected
          custom palette (`style={previewStyle ?? contentThemeStyle}`) and always
          paint in the fixed escape-hatch colors (a11y brief §4 / §5). Visual
          adjacency to the bundle/mode selectors does NOT require DOM nesting.
          Randomize fills the CURRENT mode's slots with a generated WCAG-AA
          palette (and goes custom if off); it sits OUTSIDE the preview scope so
          it stays legible even on a hostile prior palette (PRD point 11). */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <RandomizeButton onRandomize={handleRandomize} />
        <CopyFromTheme
          editingEnabled={customThemeEnabled}
          onApply={handleCopyTheme}
          onPreviewTheme={setPreviewThemeId}
          undoThemeLabel={engageUndo?.label ?? undoThemeLabel}
          onUndo={engageUndo ? handleEngageUndo : handleUndo}
        />
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
          `previewStyle ?? contentThemeStyle`. The header + copy strip stay outside
          any scope, so the copy-menu trigger used to escape an unreadable palette
          is always painted in the app theme. */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="shrink-0 w-full lg:w-80 space-y-4">
          <div className={cardClassName} style={cardDelayStyle(0)}>
            <ColorEditor
              colorValues={colorValues}
              failures={failures}
              baseThemeLabel={baseThemeLabel}
              customActive={customThemeEnabled}
              onOverride={handleOverride}
              editorMode={editorMode}
              onEditorModeChange={setEditorMode}
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
            previewStyle={previewStyle}
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
