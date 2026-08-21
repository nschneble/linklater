import { forgetShortcutsPreference } from '../src/lib/hooks/useShortcutsEnabled';

/**
 * Resets the keyboard-shortcuts preference for a `beforeEach`.
 * `localStorage.clear()` alone leaves the module's in-memory copy and the
 * shared refusal map behind, and the wipe is wrapped so a refusing store
 * costs the wipe rather than the whole reset. The `return` carries
 * nothing, being how this repo spells an empty catch.
 */
export function resetShortcutsPreference(): void {
  forgetShortcutsPreference();
  try {
    window.localStorage.clear();
  } catch {
    return;
  }
}
