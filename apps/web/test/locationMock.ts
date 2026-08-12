/**
 * A `window.location` a test can watch the app navigate away from.
 *
 * jsdom seals the real one and throws on `assign`, so anything asserting
 * that a document was replaced has to redefine the property over a spy.
 * Four suites needed the same eight lines to do it, and two of them held
 * two copies.
 *
 * The original is captured on first use rather than at import, so a suite
 * that installs its mock inside `beforeEach` cannot end up saving an
 * earlier mock as the thing it restores.
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
