import { useCallback, useRef, type MutableRefObject } from 'react';
import { updateMe } from '../../../lib/api';
import type { CustomTheme } from '../../../theme/customTheme';

interface UseCustomThemeEngagementOptions {
  /** The committed custom palette (or `null` when never configured). */
  customTheme: CustomTheme | null;
  /** Whether custom is currently on — the state a failed commit rolls back to. */
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
   * editor flips the custom theme on or off (first edit, copy-a-theme,
   * Randomize, Undo).
   *
   * It snapshots the current enabled flag + palette, optimistically commits the
   * target, fires ONE direct `PATCH /users/me` (outside the debounced auto-save,
   * which models neither the enable flag nor this rollback), and on success runs
   * the caller's `onSuccess`. On failure it restores the snapshot and toasts via
   * `onError`; either way it re-arms `engagingReference`.
   *
   * The polite live-region announcement is the CALLER's job, not `onSuccess`'s,
   * for the disengage (Undo) path — it must speak optimistically, before the
   * await — whereas the three engage paths announce from `onSuccess`, after the
   * PATCH lands. The envelope is agnostic to which.
   */
  commitEngagement: (
    target: { enabled: boolean; customTheme: CustomTheme },
    onSuccess?: () => void,
  ) => Promise<void>;
}

/**
 * Extracts the one optimistic-commit envelope the Theme Editor's four
 * engage/disengage handlers (`engageCustomTheme`, `engageFromTheme`,
 * `engageFromRandom`, `handleEngageUndo`) all shared verbatim. Each caller keeps
 * its own seed derivation + success side effects; this owns only the rollback
 * contract, so the four can never drift on how a failed PATCH recovers.
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
        // An empty map reads as "not configured", so a never-seeded user lands
        // back where they started.
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
