import { setShortcutsEnabled } from '../src/lib/hooks/useShortcutsEnabled';

/**
 * Resets the keyboard-shortcuts preference for a `beforeEach`.
 * `localStorage.clear()` alone leaves the module's in-memory copy and
 * the shared refusal map behind.
 */
export function resetShortcutsPreference(): void {
  setShortcutsEnabled(true);
  window.localStorage.clear();
}
