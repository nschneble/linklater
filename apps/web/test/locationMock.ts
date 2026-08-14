/**
 * A `window.location` a test can watch the app navigate away from.
 *
 * jsdom seals the real one and throws on `assign`, so anything asserting
 * that a document was replaced has to redefine the property over a spy.
 * Four suites import this. `assign` is the only method it spies, which is
 * why a fifth (`StumblePage.test.tsx`) still keeps a copy of its own: it
 * watches `replace`.
 *
 * What gets restored is whatever `window.location` held the first time
 * `standOnPath` ran, so that first call has to come before anything else
 * in the file redefines the property by hand. Deferring the capture buys
 * no safety over taking it at import, where a hoisted declaration is
 * already ahead of every test body.
 */

import { vi } from 'vitest';
import type { Mock } from 'vitest';

let realLocation: Location | null = null;

/**
 * Stands the tab on `pathname`, or leaves it where it is when none is
 * given, behind a fresh `assign` spy that is handed back.
 */
export function standOnPath(pathname?: string): Mock {
  realLocation ??= window.location;
  const assign = vi.fn();
  const requestedPathname = pathname === undefined ? {} : { pathname };

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, assign, ...requestedPathname },
    writable: true,
  });

  return assign;
}

/** Puts the sealed original back, so the next suite starts unmocked. */
export function restoreLocation(): void {
  if (realLocation === null) return;

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: realLocation,
    writable: true,
  });
}
