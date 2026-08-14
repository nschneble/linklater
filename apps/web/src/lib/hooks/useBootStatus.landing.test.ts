/*
 * The boot region's copy, and the reduction that picks it.
 *
 * Two things are pinned here that a rendered test would only reach by
 * standing up a whole boot. The signed-in sentence is compared byte for
 * byte, because it is the one string on this screen that predates the
 * landing distinction and the complaint was never about it. And every
 * landing is asked for its copy, so a new member of the union cannot
 * arrive without an answer.
 *
 * The unauthenticated sentence is asserted as a whole rather than by
 * substring: what makes it safe on all thirteen landings an
 * unauthenticated boot can reach is that it reports auth state and names
 * no screen, and a substring check would pass on copy that named one.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveBootLanding,
  terminalBootMessage,
} from './useBootStatus.landing';

describe('resolveBootLanding', () => {
  it('reads a crash as the error landing whatever the auth state', () => {
    expect(resolveBootLanding(true, true)).toBe('error');
    expect(resolveBootLanding(true, false)).toBe('error');
  });

  it('separates the signed-in landing from the signed-out one', () => {
    expect(resolveBootLanding(false, true)).toBe('app');
    expect(resolveBootLanding(false, false)).toBe('signed-out');
  });
});

describe('terminalBootMessage', () => {
  it('leaves the signed-in sentence exactly as it has always read', () => {
    expect(terminalBootMessage('app', false)).toBe('Linklater is ready.');
  });

  it('keeps saying it even when a notice was consumed on the way in', () => {
    expect(terminalBootMessage('app', true)).toBe('Linklater is ready.');
  });

  it('reports the auth state without naming a screen or an instruction', () => {
    expect(terminalBootMessage('signed-out', false)).toBe(
      "Linklater is ready. You're not signed in.",
    );
  });

  it('stands down when a consumed notice already accounted for the landing', () => {
    expect(terminalBootMessage('signed-out', true)).toBe('');
  });

  it('claims nothing at all when the boot ended on the error fallback', () => {
    expect(terminalBootMessage('error', false)).toBe('');
    expect(terminalBootMessage('error', true)).toBe('');
  });
});
