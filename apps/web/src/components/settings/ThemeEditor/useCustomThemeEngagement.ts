import { updateMe } from '../../../lib/api';
import { useCallback, useRef, type MutableRefObject } from 'react';
import type { CustomTheme } from '../../../theme/customTheme';

interface UseCustomThemeEngagementOptions {
  /** The committed custom palette (or `null` when never configured). */
  customTheme: CustomTheme | null;
  /** Whether custom is currently on: the state a failed commit rolls back to. */
  customThemeEnabled: boolean;
  setCustomTheme: (customTheme: CustomTheme) => void;
  setCustomThemeEnabled: (enabled: boolean) => void;
  /**
   * The engage-on-first-edit re-entrancy guard. Reset in the commit's `finally`
   * so a settled (or failed) engage always re-arms it.
   */
  engagingReference: MutableRefObject<boolean>;
  /** Called when the engage/disengage PATCH fails (the editor toasts it). */
  onError: () => void;
}

export interface UseCustomThemeEngagementResult {
  /**
   * The shared optimistic engage→PATCH→rollback envelope behind every way the
   * editor flips the custom theme ON (first edit, Randomize-while-off). Copying
   * a theme is NOT here; it only runs while custom is already on, as a plain
   * copy-over save, so it never touches the enable flag.
   *
   * It snapshots the current enabled flag + palette, optimistically commits the
   * target, fires ONE direct `PATCH /users/me` (outside the debounced auto-save,
   * which models neither the enable flag nor this rollback), and on success runs
   * the caller's `onSuccess`. On failure it restores the snapshot and toasts via
   * `onError`; either way it re-arms `engagingReference`.
   *
   * Both engage paths announce from `onSuccess`, after the PATCH lands (the
   * envelope stays agnostic to when the announcement fires).
   */
  commitEngagement: (
    target: { enabled: boolean; customTheme: CustomTheme },
    onSuccess?: () => void,
  ) => Promise<void>;
}

/**
 * Extracts the one optimistic-commit envelope the Theme Editor's two engage
 * handlers (`engageFromEdit`, `engageFromRandom`) both share verbatim. Each
 * caller keeps its own seed derivation + success side effects; this owns only
 * the rollback contract, so the two can never drift on how a failed PATCH
 * recovers.
 */
export function useCustomThemeEngagement({
  customTheme,
  customThemeEnabled,
  setCustomTheme,
  setCustomThemeEnabled,
  engagingReference,
  onError,
}: UseCustomThemeEngagementOptions): UseCustomThemeEngagementResult {
  const onErrorReference = useRef(onError);
  onErrorReference.current = onError;

  const commitEngagement = useCallback(
    async (
      target: { enabled: boolean; customTheme: CustomTheme },
      onSuccess?: () => void,
    ) => {
      const previousEnabled = customThemeEnabled;
      const previousCustomTheme = customTheme;
      setCustomThemeEnabled(target.enabled);
      setCustomTheme(target.customTheme);
      try {
        await updateMe({
          customThemeEnabled: target.enabled,
          customTheme: target.customTheme,
        });
        onSuccess?.();
      } catch {
        setCustomThemeEnabled(previousEnabled);
        // empty map = "not configured", so a never-seeded user reverts
        setCustomTheme(previousCustomTheme ?? { dark: {}, light: {} });
        onErrorReference.current();
      } finally {
        engagingReference.current = false;
      }
    },
    [
      customTheme,
      customThemeEnabled,
      engagingReference,
      setCustomTheme,
      setCustomThemeEnabled,
    ],
  );

  return { commitEngagement };
}
