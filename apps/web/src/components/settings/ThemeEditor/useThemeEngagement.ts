import { buildThemeSeed } from './buildThemeSeed';
import {
  collectTokens,
  CUSTOM_TOKEN_KEYS,
  isCustomThemeConfigured,
  type CustomTheme,
} from '../../../theme/customTheme';
import { useCallback, useRef } from 'react';
import { useCustomThemeEngagement } from './useCustomThemeEngagement';
import type { BaseTheme, Mode } from '../../../theme/constants';
import type { ThemeVariable } from './useThemeOverrides';

interface UseThemeEngagementOptions {
  /** The currently-active film theme, probed to seed the non-edited mode. */
  baseTheme: BaseTheme;
  /** The committed custom palette (or `null` when never configured). */
  customTheme: CustomTheme | null;
  /** Whether custom is currently on, the state a failed engage rolls back to. */
  customThemeEnabled: boolean;
  /** Which mode's palette the editor is currently editing (local to the editor). */
  editorMode: Mode;
  setCustomTheme: (customTheme: CustomTheme) => void;
  setCustomThemeEnabled: (enabled: boolean) => void;
  /** Called when the engage PATCH fails (the editor toasts it). */
  onError: () => void;
}

interface EngageFromEditArguments {
  /** The slot the user edited. */
  variable: ThemeVariable;
  /** The slot's new value. */
  value: string;
  /**
   * The full post-edit snapshot `{ ...colorValues, [variable]: value }`, the
   * fresh seed source when no saved palette exists. Passed explicitly (not
   * re-probed) so the just-made edit is never dropped mid-drag.
   */
  postEditValues: Record<ThemeVariable, string>;
  /** Announced by the caller strictly after the PATCH resolves. */
  onSuccess: () => void;
}

interface EngageFromRandomArguments {
  /** The generated WCAG-AA palette for `editorMode`. */
  palette: Record<ThemeVariable, string>;
  /**
   * Applies the palette to the live preview swatches. Runs INSIDE the mutex
   * guard, so a second rapid click while one engage is in flight does nothing at
   * all, not even visually. (Contrast the edit path, whose `setOverride` visual
   * apply runs on every drag-burst tick because the caller runs it OUTSIDE this
   * guarded entry point.)
   */
  applyPaletteToPreview: () => void;
  /** Announced by the caller strictly after the PATCH resolves. */
  onSuccess: () => void;
}

export interface UseThemeEngagementResult {
  /**
   * The engage-on-first-edit path. The caller runs `setOverride` on every
   * drag-burst tick BEFORE calling this (so the visible swatch always updates);
   * the internal mutex then collapses the burst so only the first tick fires the
   * network engage. Seeds the edited mode from the saved palette merged with the
   * edit (re-engage) or the full post-edit snapshot (fresh), enables, and
   * persists in ONE direct PATCH.
   */
  engageFromEdit: (engageArguments: EngageFromEditArguments) => void;
  /**
   * The Randomize-while-off path. The mutex guards BOTH the visual apply
   * (`applyPaletteToPreview`) and the engage, so a rapid second click is a full
   * no-op. Seeds the edited mode from the generated palette, preserves the other
   * mode, enables, and persists in ONE direct PATCH.
   */
  engageFromRandom: (engageArguments: EngageFromRandomArguments) => void;
}

/**
 * Owns the Theme Editor's whole go-custom orchestration: the shared re-entrancy
 * mutex, the seed builder both engage paths share, and the two engage entry
 * points themselves, so `ThemeEditor` (index.tsx) is left as view + wiring.
 *
 * The two paths deliberately keep DIFFERENT mutex shapes (an asymmetry this hook
 * preserves rather than unifies):
 *
 * - Edit path (`engageFromEdit`): the caller applies the visual edit
 *   (`setOverride`) on every drag-burst tick OUTSIDE this guarded entry point, so
 *   the swatch always tracks the drag; only the guarded first tick engages.
 * - Random path (`engageFromRandom`): the visual apply is passed in as
 *   `applyPaletteToPreview` and runs INSIDE the guard, so a rapid second click
 *   does nothing at all, not even visually.
 *
 * The mutex reset lives in `commitEngagement`'s `finally` (in
 * `useCustomThemeEngagement`), so a failed engage re-arms it. Announce strings +
 * the error toast stay caller-supplied (`onSuccess` / `onError`). This hook owns
 * WHEN an engage fires, never WHAT it says.
 */
export function useThemeEngagement({
  baseTheme,
  customTheme,
  customThemeEnabled,
  editorMode,
  setCustomTheme,
  setCustomThemeEnabled,
  onError,
}: UseThemeEngagementOptions): UseThemeEngagementResult {
  // Guards the engage-on-first-edit + engage-on-randomize paths: a native color
  // picker fires a burst of `onChange`s during a single drag, and the enabled
  // flag only commits between events, so this stops two of them firing two engage
  // PATCHes. Reset in `commitEngagement`'s `finally` so a settled (or failed)
  // engage always re-arms it.
  const engagingReference = useRef(false);

  const { commitEngagement } = useCustomThemeEngagement({
    customTheme,
    customThemeEnabled,
    setCustomTheme,
    setCustomThemeEnabled,
    engagingReference,
    onError,
  });

  // Seeds both engage paths (see `buildThemeSeed`): the edited mode carries the
  // caller's tokens, the other mode is preserved. Memoized so the two engage
  // callbacks below keep stable identities across renders.
  const buildSeed = useCallback(
    (editedModeTokens: Record<string, string>): CustomTheme =>
      buildThemeSeed(editedModeTokens, baseTheme, customTheme, editorMode),
    [baseTheme, customTheme, editorMode],
  );

  const engageFromEdit = useCallback(
    ({
      variable,
      value,
      postEditValues,
      onSuccess,
    }: EngageFromEditArguments) => {
      // The guard absorbs a color picker's drag burst. The caller has already
      // applied the visual edit for this tick.
      if (engagingReference.current) return;
      engagingReference.current = true;

      // The edited mode's slots: either the edited slot merged into the saved
      // palette (re-engage after a revert) or the full post-edit snapshot
      // (fresh).
      const editedModeTokens = isCustomThemeConfigured(customTheme)
        ? {
            ...(customTheme?.[editorMode] ?? {}),
            [variable]: value,
          }
        : collectTokens(
            CUSTOM_TOKEN_KEYS,
            (key) => postEditValues[key as ThemeVariable],
          );

      void commitEngagement(
        { enabled: true, customTheme: buildSeed(editedModeTokens) },
        onSuccess,
      );
    },
    [buildSeed, commitEngagement, customTheme, editorMode],
  );

  const engageFromRandom = useCallback(
    ({
      palette,
      applyPaletteToPreview,
      onSuccess,
    }: EngageFromRandomArguments) => {
      if (engagingReference.current) return;
      engagingReference.current = true;

      applyPaletteToPreview();
      void commitEngagement(
        { enabled: true, customTheme: buildSeed(palette) },
        onSuccess,
      );
    },
    [buildSeed, commitEngagement],
  );

  return { engageFromEdit, engageFromRandom };
}
