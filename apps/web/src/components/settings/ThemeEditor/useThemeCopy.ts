import { useCallback, useEffect, useRef, useState } from 'react';
import { readThemeTokens } from './themeProbe';
import { useThemeAutoSave } from './useThemeAutoSave';
import type { BaseTheme, Mode } from '../../../theme/constants';
import type { ThemeVariable } from './useThemeOverrides';

interface UseThemeCopyOptions {
  /** Whether the custom theme is enabled (gates auto-save). */
  editingEnabled: boolean;
  /** The committed base theme; a change drops a stale Undo snapshot. */
  baseTheme: BaseTheme;
  /**
   * The editor's LOCAL mode (the Light/Dark tabs, not the site mode). Copy
   * applies this mode's palette and a change drops the Undo snapshot.
   */
  editorMode: Mode;
  /** Live editor values, snapshotted for Undo. */
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
   * ("Your theme is on and saved." / "Reverted to previous colors.") that ride
   * the same `role="status"` region the settled-save announcements use, so there
   * is only ever one live region (a11y brief §3).
   */
  announce: (message: string) => void;
  /** Increments once per settled save; drives the polite announcement. */
  savedCount: number;
  /** The message the next settled save announces (consume-once reason). */
  savedMessage: string;
  /** Label of the last-applied theme, or `null` when there's nothing to undo. */
  undoThemeLabel: string | null;
  /** Drop the pending Undo snapshot (called on manual edits). */
  clearUndo: () => void;
  /** Apply a film theme's current-mode palette immediately and announce it. */
  handleApply: (themeId: BaseTheme, themeLabel: string) => void;
  /** Revert the last apply and announce the revert. */
  handleUndo: () => void;
}

/**
 * Owns the Theme Editor's copy-from-theme / Undo state machine: snapshotting
 * the prior palette, applying a film theme's current-mode tokens, reverting,
 * and routing each settled save's announcement through a consume-once "reason"
 * so a copy/undo says WHAT happened without double-speaking. Wraps
 * `useThemeAutoSave` so the component only deals in the handlers it renders.
 *
 * Apply/Undo are high-intent one-shot actions, so they persist via `saveNow`
 * (not the debounce) — navigating away in the debounce window must not silently
 * drop them. Per-keystroke edits keep using the debounced `scheduleSave`.
 */
export function useThemeCopy({
  editingEnabled,
  baseTheme,
  editorMode,
  colorValues,
  save,
  loadOverrides,
  onSaveFailed,
}: UseThemeCopyOptions): UseThemeCopyResult {
  const [savedCount, setSavedCount] = useState(0);
  const [savedMessage, setSavedMessage] = useState('Your theme saved.');
  const [undoThemeLabel, setUndoThemeLabel] = useState<string | null>(null);

  // Always-current values (snapshot source for Undo) + a consume-once reason
  // the next settled save announces.
  const colorValuesReference = useRef(colorValues);
  colorValuesReference.current = colorValues;
  const undoSnapshotReference = useRef<Record<ThemeVariable, string> | null>(
    null,
  );
  const pendingSaveReasonReference = useRef<string | null>(null);

  const onSaveFailedReference = useRef(onSaveFailed);
  onSaveFailedReference.current = onSaveFailed;

  // A success consumes the pending reason (or the generic message) so each
  // settled save announces exactly one thing; a failure routes to the editor's
  // assertive Toast.
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

  // Push a one-off message through the same polite channel the settled-save
  // announcements use (engage/copy utterances). Clearing-then-setting is the
  // live region's job (in `useAnnouncer`); here we just bump the count so the
  // region re-fires with the new message.
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

  // A manual edit, or a theme/mode change, makes the "undo the last copy"
  // snapshot stale — drop it so Undo never reverts to a mismatched palette.
  const clearUndo = useCallback(() => {
    undoSnapshotReference.current = null;
    setUndoThemeLabel(null);
  }, []);

  useEffect(() => {
    clearUndo();
  }, [editorMode, baseTheme, clearUndo]);

  const handleApply = useCallback(
    (themeId: BaseTheme, themeLabel: string) => {
      undoSnapshotReference.current = { ...colorValuesReference.current };
      const applied = loadOverrides(readThemeTokens(themeId, editorMode));
      pendingSaveReasonReference.current = `${themeLabel} palette applied and saved.`;
      setUndoThemeLabel(themeLabel);
      saveNow(applied);
    },
    [loadOverrides, editorMode, saveNow],
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

  return {
    scheduleSave,
    announce,
    savedCount,
    savedMessage,
    undoThemeLabel,
    clearUndo,
    handleApply,
    handleUndo,
  };
}
