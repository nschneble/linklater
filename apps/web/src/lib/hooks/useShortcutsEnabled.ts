import { readLocalStorage } from '../../theme/storage';
import { useSyncExternalStore } from 'react';

/** `localStorage` key for the single-key keyboard shortcuts preference. */
export const KEYBOARD_SHORTCUTS_KEY = 'linklater_keyboard_shortcuts';

/**
 * Device-local store for whether the app's single-key keyboard shortcuts are
 * active. Shared by `useAppShell` (the `x` menu shortcut), `useLinksView`
 * (the `useKeyboardShortcuts` listener), and the Settings toggle that writes
 * it, so all three read one source of truth.
 *
 * The value is read synchronously from `localStorage` on every snapshot, so a
 * stored "disabled" preference gates the listeners on first mount rather than
 * after an effect settles. That gap matters for speech-input users: without a
 * synchronous read, a dictated keystroke could land on `d` (Stumble) before
 * the stored preference loaded. Default is on (shortcuts exist unless the user
 * turns them off), satisfying WCAG 2.1.4 via a conformant disable path.
 */
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  return readLocalStorage(KEYBOARD_SHORTCUTS_KEY) !== 'off';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Persists the keyboard-shortcuts preference and notifies every subscribed
 * consumer so the toggle and both shortcut listeners update together.
 */
export function setShortcutsEnabled(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        KEYBOARD_SHORTCUTS_KEY,
        enabled ? 'on' : 'off',
      );
    }
  } catch {
    // Storage can be blocked (private browsing); still notify subscribers so
    // the in-session UI stays consistent even if the choice will not persist.
  }
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Reads whether single-key keyboard shortcuts are enabled. Re-renders the
 * caller whenever the preference changes anywhere in the app.
 */
export function useShortcutsEnabled(): boolean {
  return useSyncExternalStore(subscribe, readEnabled, readEnabled);
}
