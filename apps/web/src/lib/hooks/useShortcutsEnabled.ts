import {
  readLocalStorage,
  readPersistedValue,
  writeLocalStorage,
} from '../../theme/storage';
import { useSyncExternalStore } from 'react';

/** `localStorage` key for the single-key keyboard shortcuts preference. */
export const KEYBOARD_SHORTCUTS_KEY = 'linklater_keyboard_shortcuts';

/**
 * Device-local store for whether the single-key keyboard shortcuts are
 * active. Snapshots resolve synchronously, so a disable gates the
 * listeners on the first committed render, not after an effect: a
 * speech-input user's dictated keystroke must not reach `d` (Stumble)
 * first.
 */
const listeners = new Set<() => void>();

/**
 * The preference this session starts on. An absent store is a fresh
 * install and starts on; a store that throws cannot show the user left
 * them on, and `off` withdraws nothing under WCAG 2.1.4, since each of
 * the single-character shortcuts has a focusable control of its own.
 */
function seedPreference(): string {
  if (typeof window === 'undefined') return 'on';
  try {
    return window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY) ?? 'on';
  } catch {
    return 'off';
  }
}

let cachedPreference = seedPreference();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function readEnabled(): boolean {
  return readPersistedValue(KEYBOARD_SHORTCUTS_KEY, cachedPreference) === 'on';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The preference a `storage` event leaves this tab holding. The event is
 * proof a sibling just wrote the stored value, which is the one thing the
 * refusal record cannot tell once the store has cycled back to the value
 * the refusal saw. A present stored value other than `on` is taken as a
 * disable on that proof alone, which no other read here does:
 * `readPersistedValue` hands back the cached copy instead when the stored
 * value is the one the refusal saw. The event fixes no order
 * against this tab's own writes, and of the two unordered answers only a
 * stray `on` re-arms a `document`-level handler someone asked to stop. So
 * the record stands only against a stored `on`, and a refused local
 * disable outlives one.
 *
 * The refused local enable is the direction given up: while the store
 * reads anything but `on`, any sibling event drops it, even one whose
 * write predates the enable, so a switch turned on in a tab whose store
 * refuses writes can visibly go back off. An absent or unreadable store is
 * neither value, so a sibling's `removeItem` still evicts nothing.
 *
 * The two reads are not one snapshot: the store is shared across
 * processes and the spec has authors assume no locking. Only the first
 * can short-circuit to `off`, so a tear misses only towards the
 * fall-through, which re-reads the store, and the write that caused it
 * delivers an event of its own.
 *
 * `lib/api/storage.ts` leaves the same unordered event to `readPersisted`
 * in both directions, having no unsafe one to break the tie towards.
 */
function resolveSiblingPreference(): string {
  const stored = readLocalStorage(KEYBOARD_SHORTCUTS_KEY);
  if (stored !== null && stored !== 'on') return 'off';

  return readPersistedValue(KEYBOARD_SHORTCUTS_KEY, cachedPreference);
}

function handleShortcutsStorageEvent(event: StorageEvent): void {
  if (event.key !== KEYBOARD_SHORTCUTS_KEY) return;
  cachedPreference = resolveSiblingPreference();
  notifyListeners();
}

function startCrossTabShortcutsSync(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', handleShortcutsStorageEvent);
}

startCrossTabShortcutsSync();

/**
 * Persists the keyboard-shortcuts preference and notifies every
 * subscribed consumer. `readPersistedValue` holds the in-memory copy
 * against the value the refusal saw, and the copy moves before the
 * notify, which is what subscribers re-read.
 */
export function setShortcutsEnabled(enabled: boolean): void {
  cachedPreference = enabled ? 'on' : 'off';
  writeLocalStorage(KEYBOARD_SHORTCUTS_KEY, cachedPreference);
  notifyListeners();
}

/**
 * Reads whether single-key keyboard shortcuts are enabled. Re-renders the
 * caller whenever the preference changes anywhere in the app.
 */
export function useShortcutsEnabled(): boolean {
  return useSyncExternalStore(subscribe, readEnabled, readEnabled);
}

/**
 * Exists for suites that re-import this module: without it each import
 * leaves another listener on the shared `window`. The app never stops
 * reading a sibling tab's preference while it runs, which is why nothing
 * in `src` calls this.
 */
export function stopCrossTabShortcutsSync(): void {
  if (typeof window === 'undefined') return;
  window.removeEventListener('storage', handleShortcutsStorageEvent);
}
