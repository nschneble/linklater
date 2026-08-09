import { useCallback, useEffect, useRef } from 'react';
import type { ThemeVariable } from './useThemeOverrides';

/** How long editing must settle before an auto-save fires. */
const AUTO_SAVE_DEBOUNCE_MS = 700;

export type AutoSaveOutcome = 'saved' | 'failed';

interface UseThemeAutoSaveOptions {
  /** Auto-save only runs for the editable custom theme. */
  isCustom: boolean;
  /** The live editor token values (latest is read at flush time, via a ref). */
  colorValues: Record<ThemeVariable, string>;
  /** Persists the given values; resolves true on success. */
  save: (colorValues: Record<ThemeVariable, string>) => Promise<boolean>;
  /** Announced once per settled burst with the terminal outcome. */
  onOutcome: (outcome: AutoSaveOutcome) => void;
}

export interface UseThemeAutoSaveResult {
  /**
   * Call after any user edit to schedule a debounced save. Coalesces a burst
   * of edits into a single trailing save (one announcement per pause).
   */
  scheduleSave: () => void;
  /**
   * Persist immediately, bypassing the debounce. Used by the high-intent
   * one-shot actions (copy-from-theme apply, Undo) so a deliberate palette
   * change is saved at once rather than risking loss in the debounce window.
   */
  saveNow: (colorValues: Record<ThemeVariable, string>) => void;
}

/**
 * Drives the Theme Editor's auto-save. Replaces the old explicit Save button:
 * every edit schedules a debounced persist, and only the terminal outcome of
 * the settled burst is announced (intermediate "saving" states stay silent so
 * assistive tech is not barraged on every keystroke; a11y brief B1/B2).
 *
 * Saves are serialized (see `flush`): overlapping saves can't race, so the user
 * hears one settled outcome for the final state and never a spurious failure.
 */
export function useThemeAutoSave({
  isCustom,
  colorValues,
  save,
  onOutcome,
}: UseThemeAutoSaveOptions): UseThemeAutoSaveResult {
  const valuesReference = useRef(colorValues);
  valuesReference.current = colorValues;

  const isCustomReference = useRef(isCustom);
  isCustomReference.current = isCustom;

  const saveReference = useRef(save);
  saveReference.current = save;

  const onOutcomeReference = useRef(onOutcome);
  onOutcomeReference.current = onOutcome;

  const timerReference = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightReference = useRef(false);
  const pendingValuesReference = useRef<Record<ThemeVariable, string> | null>(
    null,
  );

  // serialize saves: an overlap trips the re-entry guard, faking a failure
  const flush = useCallback(async (values: Record<ThemeVariable, string>) => {
    if (inFlightReference.current) {
      pendingValuesReference.current = values;
      return;
    }
    inFlightReference.current = true;
    let succeeded = false;
    let next: Record<ThemeVariable, string> | null = values;
    while (next) {
      succeeded = await saveReference.current(next);
      next = pendingValuesReference.current;
      pendingValuesReference.current = null;
    }
    inFlightReference.current = false;
    onOutcomeReference.current(succeeded ? 'saved' : 'failed');
  }, []);

  const scheduleSave = useCallback(() => {
    if (!isCustomReference.current) return;
    if (timerReference.current) clearTimeout(timerReference.current);
    timerReference.current = setTimeout(() => {
      timerReference.current = null;
      void flush(valuesReference.current);
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [flush]);

  const saveNow = useCallback(
    (values: Record<ThemeVariable, string>) => {
      if (timerReference.current) {
        clearTimeout(timerReference.current);
        timerReference.current = null;
      }
      void flush(values);
    },
    [flush],
  );

  // drop any pending save when the editor unmounts
  useEffect(() => {
    return () => {
      if (timerReference.current) clearTimeout(timerReference.current);
    };
  }, []);

  return { scheduleSave, saveNow };
}
