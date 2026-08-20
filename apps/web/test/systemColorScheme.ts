import { vi } from 'vitest';
import type { Mode } from '../src/theme/constants';

type ChangeListener = (event: MediaQueryListEvent) => void;

export interface SystemColorSchemeStub {
  /** Moves the OS preference and notifies subscribers. Wrap in `act`. */
  flip: (systemMode: Mode) => void;
  /** Subscribers still attached, for asserting listener cleanup. */
  listenerCount: () => number;
}

/**
 * Installs a `window.matchMedia` stub that answers the light-scheme query
 * alone, so a listener querying `(prefers-color-scheme: dark)` reads as a
 * permanent miss instead of quietly borrowing the light answer.
 */
export function stubSystemColorScheme(systemMode: Mode): SystemColorSchemeStub {
  const listeners = new Set<ChangeListener>();
  const lightQuery = {
    matches: systemMode === 'light',
    media: '(prefers-color-scheme: light)',
    onchange: null,
    addEventListener: vi.fn((type: string, listener: ChangeListener) => {
      if (type === 'change') listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: ChangeListener) => {
      if (type === 'change') listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  };

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((media: string) =>
      media === lightQuery.media
        ? lightQuery
        : {
            matches: false,
            media,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          },
    ),
  });

  return {
    flip: (nextSystemMode: Mode) => {
      lightQuery.matches = nextSystemMode === 'light';
      for (const listener of listeners) {
        listener({ matches: lightQuery.matches } as MediaQueryListEvent);
      }
    },
    listenerCount: () => listeners.size,
  };
}
