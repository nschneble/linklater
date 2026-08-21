import {
  forgetRefusedWrite,
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
 * The preference a `storage` event leaves this tab holding. The event
 * proves a sibling wrote, which no refusal record can tell once the store
 * cycles back to the value the refusal saw. Only a disable is taken on
 * it: a stray `on` re-arms a handler someone asked to stop.
 */
function resolveSiblingPreference(): string {
  const stored = readLocalStorage(KEYBOARD_SHORTCUTS_KEY);
  // absent and unreadable are neither value, so a removeItem evicts nothing
  if (stored !== null && stored !== 'on') return 'off';

  // a tear between the two reads misses only towards this re-read
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
 * Drops this module's memory of the preference to a fixed `on`, touching
 * no store. Fixed rather than a re-seed on purpose: `seedPreference`
 * answers `off` under a refusal, and a test wants one starting point
 * either way. Nothing in `src` calls this.
 */
export function forgetShortcutsPreference(): void {
  cachedPreference = 'on';
  forgetRefusedWrite(KEYBOARD_SHORTCUTS_KEY);
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
