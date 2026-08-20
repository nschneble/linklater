/**
 * Puts the keyboard-shortcuts preference back to its module-load state,
 * for a `beforeEach`.
 *
 * `localStorage.clear()` no longer reaches it: the preference keeps an
 * in-memory copy, and a refused write leaves an entry in the shared
 * refusal map, which has no reset. A write that lands clears both, so it
 * has to run before the clear.
 */

import { setShortcutsEnabled } from '../src/lib/hooks/useShortcutsEnabled';

export function resetShortcutsPreference(): void {
  setShortcutsEnabled(true);
  window.localStorage.clear();
}
