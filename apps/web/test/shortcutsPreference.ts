import { forgetShortcutsPreference } from '../src/lib/hooks/useShortcutsEnabled';

/**
 * Resets the keyboard-shortcuts preference for a `beforeEach`.
 * `localStorage.clear()` alone leaves the module's in-memory copy and the
 * shared refusal map behind, and the wipe is guarded so that a store which
 * refuses costs the wipe rather than the whole reset.
 */
export function resetShortcutsPreference(): void {
  forgetShortcutsPreference();
  try {
    window.localStorage.clear();
  } catch {
    return;
  }
}
