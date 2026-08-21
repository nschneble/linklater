import {
  readLocalStorage,
  readPersistedValue,
  writeLocalStorage,
} from '../../theme/storage';
import { useSyncExternalStore } from 'react';

/** `localStorage` key for the single-key keyboard shortcuts preference. */
export const KEYBOARD_SHORTCUTS_KEY = 'linklater_keyboard_shortcuts';

/**
 * Device-local store for whether the app's single-key keyboard
 * shortcuts are active.
 *
 * Every snapshot resolves synchronously, so a stored "disabled"
 * preference gates the listeners on first mount rather than after an
 * effect settles, which matters for speech-input users: a dictated
 * keystroke could otherwise land on `d` (Stumble) before the
 * preference loaded. Only an absent or unreadable store reaches the
 * default of on: `on` and `off` are the sole values recognised and
 * anything else reads as off. Shortcuts exist unless the user turns
 * them off, satisfying WCAG 2.1.4 via a disable that holds for the
 * session a refused write could not persist.
 */
const listeners = new Set<() => void>();

let cachedPreference = readLocalStorage(KEYBOARD_SHORTCUTS_KEY) ?? 'on';

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

function handleShortcutsStorageEvent(event: StorageEvent): void {
  if (event.key !== KEYBOARD_SHORTCUTS_KEY) return;
  cachedPreference = readPersistedValue(
    KEYBOARD_SHORTCUTS_KEY,
    cachedPreference,
  );
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
