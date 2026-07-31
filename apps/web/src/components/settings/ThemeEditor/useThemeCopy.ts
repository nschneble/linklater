import { useCallback, useRef, useState } from 'react';
import { useThemeAutoSave } from './useThemeAutoSave';
import type { ThemeVariable } from './useThemeOverrides';

interface UseThemeCopyOptions {
  /** Whether the custom theme is enabled (gates auto-save). */
  editingEnabled: boolean;
  /** Live editor values, persisted by the debounced auto-save. */
  colorValues: Record<ThemeVariable, string>;
  /** Persists the given values; resolves true on success. */
  save: (colorValues: Record<ThemeVariable, string>) => Promise<boolean>;
  /** Bulk-loads a palette and returns the resolved values it applied. */
  loadOverrides: (
    tokens: Record<string, string>,
  ) => Record<ThemeVariable, string>;
  /** Called when a settled save fails (the editor announces it assertively). */
  onSaveFailed: () => void;
}

export interface UseThemeCopyResult {
  /** Schedule a debounced save after a per-keystroke edit. */
  scheduleSave: () => void;
  /**
   * Push a one-off message through the polite announcement channel (bumps the
   * count + sets the message). Used by the editor for engage/copy utterances
   * ("Your theme is on and saved." / "{label} palette applied and saved.") that
   * ride the same `role="status"` region the settled-save announcements use, so
   * there is only ever one live region (a11y brief §3).
   */
  announce: (message: string) => void;
  /** Increments once per settled save; drives the polite announcement. */
  savedCount: number;
  /** The message the next settled save announces (consume-once reason). */
  savedMessage: string;
  /**
   * Apply an already-resolved palette immediately as a copy-over and announce
   * it via the consume-once reason. Loads the palette and persists via
   * `saveNow`. Shared by both copy-over-while-on actions — Randomize
   * (`handleApplyRandom`) and copying the base film theme — so they can never
   * drift on how a copy-over saves.
   */
  applyPalette: (palette: Record<string, string>, reason: string) => void;
  /**
   * Apply an already-resolved random palette immediately and announce it
   * (Randomize while custom is already on). Thin wrapper over `applyPalette`
   * with the random reason. PRD point 11.
   */
  handleApplyRandom: (palette: Record<ThemeVariable, string>) => void;
}

/**
 * Owns the Theme Editor's copy-from-theme apply path: applying a film theme's
 * (or a random) current-mode tokens and routing each settled save's
 * announcement through a consume-once "reason" so a copy says WHAT happened
 * without double-speaking. Wraps `useThemeAutoSave` so the component only deals
 * in the handlers it renders.
 *
 * Apply is a high-intent one-shot action, so it persists via `saveNow` (not the
 * debounce) — navigating away in the debounce window must not silently drop it.
 * Per-keystroke edits keep using the debounced `scheduleSave`.
 */
export function useThemeCopy({
  editingEnabled,
  colorValues,
  save,
  loadOverrides,
  onSaveFailed,
}: UseThemeCopyOptions): UseThemeCopyResult {
  const [savedCount, setSavedCount] = useState(0);
  const [savedMessage, setSavedMessage] = useState('Your theme saved.');

  // a consume-once reason the next settled save announces
  const pendingSaveReasonReference = useRef<string | null>(null);

  const onSaveFailedReference = useRef(onSaveFailed);
  onSaveFailedReference.current = onSaveFailed;

  // consume the pending reason on success so each save announces one thing
  const handleAutoSaveOutcome = useCallback((outcome: 'saved' | 'failed') => {
    if (outcome === 'saved') {
      const reason = pendingSaveReasonReference.current ?? 'Your theme saved.';
      pendingSaveReasonReference.current = null;
      setSavedMessage(reason);
      setSavedCount((previous) => previous + 1);
    } else {
      onSaveFailedReference.current();
    }
  }, []);

  // bump the count so the region re-fires; useAnnouncer does the clear/set
  const announce = useCallback((message: string) => {
    setSavedMessage(message);
    setSavedCount((previous) => previous + 1);
  }, []);

  const { scheduleSave, saveNow } = useThemeAutoSave({
    isCustom: editingEnabled,
    colorValues,
    save,
    onOutcome: handleAutoSaveOutcome,
  });

  const applyPalette = useCallback(
    (palette: Record<string, string>, reason: string) => {
      const applied = loadOverrides(palette);
      pendingSaveReasonReference.current = reason;
      saveNow(applied);
    },
    [loadOverrides, saveNow],
  );

  const handleApplyRandom = useCallback(
    (palette: Record<ThemeVariable, string>) => {
      applyPalette(palette, 'Random palette applied and saved.');
    },
    [applyPalette],
  );

  return {
    scheduleSave,
    announce,
    savedCount,
    savedMessage,
    applyPalette,
    handleApplyRandom,
  };
}
