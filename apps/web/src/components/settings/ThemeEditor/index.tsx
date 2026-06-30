import {
  useCallback,
  useEffect,
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
import IconButton from '../../common/IconButton';
import ModeToggle from './ModeToggle';
import RandomizeButton from './RandomizeButton';
import Toast from '../../common/Toast';
import { EDITOR_FOCUS_RING } from './escapeHatchStyles';
import { generateRandomPalette } from './randomPalette';
import { readThemeTokens } from './themeProbe';
import { BUNDLES, type Bundle } from './useThemeOverrides';
import { pairsTouchingToken, useContrastResults } from './contrastResults';
import { useAnnouncer } from './useAnnouncer';
import { useCustomThemeEngagement } from './useCustomThemeEngagement';
import { useThemeCopy } from './useThemeCopy';
import { useThemeOverrides } from './useThemeOverrides';
import { useThemeSave } from './useThemeSave';
import { useToast } from '../../../lib/hooks/useToast';

const EDITOR_MODE_LABELS: Record<Mode, string> = {
  light: 'Light colors',
  dark: 'Dark colors',
};

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
 * Engage + copy/undo are announced through the editor's single polite live
 * region ("Your theme is on and saved." / "{label} palette applied and saved.").
 *
 * The editor's color mode is LOCAL (`editorMode`): the Light/Dark toggle in the
 * header toolbar swaps which mode's palette the content shows + edits, decoupled
 * from the global site mode — so previewing the dark palette never flips the
 * whole app. There is no on-page theme switcher.
 *
 * The toolbar mirrors the "Your links" toolbar: the Light/Dark toggle leads on
 * the left, Randomize + a single "Copy {baseThemeLabel} colors" action follow on
 * the right. The copy action seeds the custom palette from the currently-active
 * film theme; it HIDES once custom is on (there is no longer a base film theme to
 * copy from) and is replaced by an Undo when the copy overwrote a returning
 * user's saved palette. The title row carries a NON-interactive status icon
 * (check / triangle) summarizing whether the live palette clears the contrast
 * contract — a roll-up of the per-slot row failures, never an auto-announced one.
 *
 * The Light/Dark toggle's active pill and Randomize both paint from FIXED-color
 * escape hatches (not bundle tokens), and the toolbar sits OUTSIDE the custom
 * scope — so a hostile custom palette can degrade the preview but never the
 * Randomize recovery needed to escape it. The copy button uses NORMAL bundle
 * tokens: it only ever renders on a contrast-guaranteed film theme (it is hidden
 * while custom is on).
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

  // The editor's color mode is LOCAL — the Light/Dark toggle in the header
  // toolbar swaps which mode's palette the content shows + edits, WITHOUT
  // flipping the global site mode (navigating away leaves the app on whatever
  // mode it was).
  // Seeded once from the site mode so the editor opens on the expected palette.
  const [editorMode, setEditorMode] = useState<Mode>(mode);

  // The active bundle is OWNED here (not inside the tablist) so BOTH the tablist
  // and the live preview read the same selection: picking a bundle both swaps
  // the editable slots AND swaps the previewed component (PRD point 4).
  const [activeBundle, setActiveBundle] = useState<Bundle>(BUNDLES[0]);

  // Bumped on every Randomize so the live preview re-staggers in with the fresh
  // palette (PRD point 12). It only feeds ComponentShowcase's mock remount key —
  // it never touches the palette itself.
  const [randomizeNonce, setRandomizeNonce] = useState(0);

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

  // Focus targets for the toolbar's recovery affordances. The copy button hides
  // when custom turns on and reappears when an Undo turns it back off; the Undo
  // button mounts only when there is a copy to revert; Randomize is always
  // present. Focus is moved AFTER the relevant async engage transition settles
  // (SC 2.4.3) — see the two effects below.
  const copyButtonReference = useRef<HTMLButtonElement>(null);
  const randomizeButtonReference = useRef<HTMLButtonElement>(null);
  const undoButtonReference = useRef<HTMLButtonElement>(null);

  // Bumped from `engageFromTheme`'s success callback (the COPY-initiated engage
  // path ONLY — never the color-edit engage, which keeps focus on the picker,
  // a11y brief R-B3). Drives the post-engage focus move once the PATCH settles
  // and React has committed the copy-button hide + any Undo mount (R-B2/R-B4).
  const [copyEngageFocusNonce, setCopyEngageFocusNonce] = useState(0);

  // Set when an engage-Undo (custom → OFF) is in flight, so the focus effect
  // keyed on the disengage settling knows to land focus on the reappeared copy
  // button (R-B5) rather than reacting to an unrelated enabled-flag change.
  const undoReturnsToCopyReference = useRef(false);

  const { save } = useThemeSave(editorMode);
  const toast = useToast();

  const onEngageError = useCallback(
    () => toast.show('custom-theme-toggle-failed'),
    [toast],
  );
  const { commitEngagement } = useCustomThemeEngagement({
    customTheme,
    customThemeEnabled,
    setCustomTheme,
    setCustomThemeEnabled,
    engagingReference,
    onError: onEngageError,
  });

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
  //
  // `commitEngagement` fires this PATCH DIRECTLY, outside `useThemeAutoSave`'s
  // in-flight serialization, because it must atomically carry BOTH the enable
  // flag and the freshly-probed seed AND own the optimistic rollback — none of
  // which the serialized current-mode `save` path models. Not racy in practice:
  // engage is the FIRST edit, while any scheduled save can only be armed by a
  // LATER edit (custom is now on) and won't flush until 700ms after, by which
  // point this PATCH has long since landed.
  const engageCustomTheme = useCallback(
    async (
      variable: Parameters<typeof setOverride>[0],
      value: string,
      postEditValues: Record<Parameters<typeof setOverride>[0], string>,
    ) => {
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

      await commitEngagement({ enabled: true, customTheme: seeded }, () =>
        announce('Your theme is on and saved.'),
      );
    },
    [
      announce,
      baseTheme,
      commitEngagement,
      customTheme,
      editorMode,
      isCustomConfigured,
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

      loadOverrides(editedModeTokens);
      clearUndo();
      await commitEngagement({ enabled: true, customTheme: seeded }, () => {
        if (hadSavedPalette && previousCustomTheme) {
          setEngageUndo({
            customTheme: previousCustomTheme,
            label: themeLabel,
          });
        }
        announce(`Your theme is on. ${themeLabel} palette applied and saved.`);
        // Move focus once the engage has settled: the copy button has gone
        // (custom is now on) so focus would otherwise fall to <body>. Batched
        // with setEngageUndo, so the effect sees the Undo button if one mounted
        // (R-B2/R-B4).
        setCopyEngageFocusNonce((nonce) => nonce + 1);
      });
    },
    [
      announce,
      clearUndo,
      commitEngagement,
      customTheme,
      editorMode,
      isCustomConfigured,
      loadOverrides,
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

      loadOverrides(palette);
      clearUndo();
      await commitEngagement({ enabled: true, customTheme: seeded }, () => {
        if (hadSavedPalette && previousCustomTheme) {
          setEngageUndo({
            customTheme: previousCustomTheme,
            label: 'random palette',
          });
        }
        announce('Your theme is on. Random palette applied and saved.');
      });
    },
    [
      announce,
      baseTheme,
      clearUndo,
      commitEngagement,
      customTheme,
      editorMode,
      isCustomConfigured,
      loadOverrides,
    ],
  );

  // Randomize dispatcher: while custom is already on it is a copy-over with its
  // own Undo (`handleApplyRandom`); while off it goes custom (`engageFromRandom`).
  // Either way the palette is generated ONCE for the current editor mode and the
  // OTHER mode is left untouched (HARD scope: cross-bundle pairs are only
  // guaranteed within one mode's generated palette).
  const handleRandomize = useCallback(() => {
    const palette = generateRandomPalette(editorMode);
    setRandomizeNonce((current) => current + 1);
    if (customThemeEnabled) {
      setEngageUndo(null);
      handleApplyRandom(palette);
    } else {
      void engageFromRandom(palette);
    }
  }, [customThemeEnabled, editorMode, engageFromRandom, handleApplyRandom]);

  // Undo for a copy that overwrote an existing saved palette: restore the prior
  // palette and turn custom back OFF (the state the user copied from). On PATCH
  // failure, roll back to the just-copied on-state. Turning custom off reappears
  // the copy button; the effect below returns focus to it once the disengage
  // settles (this Undo button unmounts as its label goes null — SC 2.4.3).
  const handleEngageUndo = useCallback(async () => {
    if (!engageUndo) return;
    const restored = engageUndo.customTheme;
    setEngageUndo(null);
    undoReturnsToCopyReference.current = true;
    // The revert announces OPTIMISTICALLY (before the await), unlike the three
    // engage paths that announce from `commitEngagement`'s success callback —
    // `commitEngagement` rolls back to the just-copied on-state if the disengage
    // PATCH fails.
    announce('Reverted to previous colors.');
    await commitEngagement({ enabled: false, customTheme: restored });
  }, [announce, commitEngagement, engageUndo]);

  // The single toolbar copy action: seed the custom palette from the CURRENTLY
  // ACTIVE film theme. The button only renders while custom is off, so this is
  // always the go-custom `engageFromTheme` path (there is no copy-over branch:
  // copying while custom is already on is unreachable now the button hides).
  const handleCopyFromBaseTheme = useCallback(() => {
    void engageFromTheme(baseTheme, baseThemeLabel);
  }, [baseTheme, baseThemeLabel, engageFromTheme]);

  // Undo dispatcher. The engage-Undo (custom → OFF) is async + returns focus to
  // the reappearing copy button via the effect below; the copy-over Undo (custom
  // stays ON) is synchronous and returns focus to the always-present Randomize
  // (R-B5).
  const handleUndoClick = useCallback(() => {
    if (engageUndo) {
      void handleEngageUndo();
    } else {
      handleUndo();
      randomizeButtonReference.current?.focus();
    }
  }, [engageUndo, handleEngageUndo, handleUndo]);

  // After a COPY-initiated engage settles, land focus on the Undo button if one
  // appeared (returning user whose palette was overwritten), else on Randomize —
  // never the mode toggle (R-B4). Keyed on the success-callback nonce so it runs
  // after React commits the copy-button hide + Undo mount.
  useEffect(() => {
    if (copyEngageFocusNonce === 0) return;
    if (undoButtonReference.current) {
      undoButtonReference.current.focus();
    } else {
      randomizeButtonReference.current?.focus();
    }
  }, [copyEngageFocusNonce]);

  // After an engage-Undo turns custom back OFF, the copy button reappears
  // (becomes focusable) — return focus to it (R-B5). Guarded by the flag so an
  // unrelated enabled-flag change never steals focus.
  useEffect(() => {
    if (!undoReturnsToCopyReference.current) return;
    if (customThemeEnabled) return;
    undoReturnsToCopyReference.current = false;
    copyButtonReference.current?.focus();
  }, [customThemeEnabled]);

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

  // Contrast roll-up for the title-row status icon — a SUPPLEMENTARY summary of
  // the per-slot row failures (which stay the authoritative SC 3.3.1 report).
  // Binary on whether any contract pair fails (a11y brief R-A2/R-A4).
  const hasContrastIssue = failures.size > 0;

  // The Undo label spans both Undo flavors: the engage-Undo snapshot (copy while
  // custom was off, overwriting a saved palette) and the copy-over Undo (Randomize
  // while custom was already on). Either present means an Undo renders.
  const copyUndoLabel = engageUndo?.label ?? undoThemeLabel;

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
            aria-label={
              hasContrastIssue
                ? 'Theme has a contrast issue to fix'
                : 'Theme colors meet contrast'
            }
            className={`fa-solid text-sm ${hasContrastIssue ? 'fa-triangle-exclamation text-[var(--warn-text)]' : 'fa-circle-check text-[var(--success-text)]'}`}
          />
        </div>
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

      {/* Header toolbar, modeled on the "Your links" toolbar (LinksToolbar):
          the Light/Dark palette toggle leads on the left (like the links tabs)
          and the Randomize + copy actions follow on the right. The SettingsGroup
          card wrapper is dropped (PRD point 8); these controls live in this bare
          strip.

          The strip is a SIBLING ABOVE the preview-scoped content div, so the
          mode toggle, Randomize, copy, and Undo — the surviving keyboard-
          reachable controls — have NO ancestor carrying the injected custom
          palette (`style={contentThemeStyle}`). The mode toggle's active pill
          and Randomize paint from fixed escape hatches, so they stay the legible
          recovery even on a hostile prior palette (a11y brief §3/§5). The copy
          button only renders while custom is off, so it always paints on a
          contrast-guaranteed film theme (R-C1). Randomize fills the CURRENT
          mode's slots with a generated WCAG-AA palette (and goes custom if off)
          (PRD point 11). */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <ModeToggle
          mode={editorMode}
          onModeChange={setEditorMode}
          groupLabel="Palette to edit"
          labels={EDITOR_MODE_LABELS}
        />
        <div className="flex items-center gap-3 sm:ml-auto">
          <RandomizeButton
            ref={randomizeButtonReference}
            onRandomize={handleRandomize}
          />
          {/* Copy the active film theme into the custom palette. CONDITIONALLY
              RENDERED (not opacity-hidden) — once custom is on there is no base
              theme left to copy, and an opacity-hidden button would leave a
              phantom gap in this right-aligned flex row for the common custom-on
              user (R-B1/R-C1). On engage-undo it remounts in the same commit
              customThemeEnabled flips false, so copyButtonReference re-attaches
              before the focus effect runs (R-B5). Reuses the shared elevated
              IconButton (peer to Randomize) with NORMAL bundle tokens +
              --focus-ring; the source theme is named in the accessible name, the
              clone glyph is decorative (R-E1/R-E2). */}
          {!customThemeEnabled && (
            <IconButton
              ref={copyButtonReference}
              variant="elevated"
              surface="base"
              onClick={handleCopyFromBaseTheme}
            >
              <i className="fa-solid fa-clone" aria-hidden="true" />
              Copy {baseThemeLabel} colors
            </IconButton>
          )}
          {copyUndoLabel !== null && (
            <button
              ref={undoButtonReference}
              type="button"
              onClick={handleUndoClick}
              aria-label={`Undo copy from ${copyUndoLabel}`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--mount-highlight)] text-[var(--mount-highlight-fg)] text-xs font-semibold ${EDITOR_FOCUS_RING} rounded-lg active:scale-[0.96] transition-transform cursor-pointer`}
            >
              <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true" />
              Undo
            </button>
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
      <div className="flex flex-col lg:flex-row gap-6">
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
