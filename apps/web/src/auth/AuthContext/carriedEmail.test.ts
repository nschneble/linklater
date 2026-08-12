/**
 * Unit tests for carriedEmail.
 *
 * The suite that plays a bounce (`routes/Unauthenticated.test.tsx`) cannot
 * tell storage from module memory: both trees it stands up share one
 * module registry, so a module-scope variable survives its fake document
 * load. Here the reader is asked for a value this module never wrote, and
 * only storage can answer that.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  carryTypedEmail,
  dropCarriedEmail,
  hasCarriedEmail,
  noteTypedEmail,
  takeCarriedEmail,
} from './carriedEmail';
import { withRefusedStorage } from '../../../test/refusedStorage';

const CARRIED_EMAIL_KEY = 'linklater_carried_email';

beforeEach(() => {
  sessionStorage.clear();
  noteTypedEmail('');
});

afterEach(() => {
  sessionStorage.clear();
});

describe('the value crosses a document, not a render', () => {
  it('reads a carry this module was never told about', () => {
    // the previous document is gone; only its storage write survived it
    sessionStorage.setItem(CARRIED_EMAIL_KEY, 'from-a-dead-document@test.com');

    expect(takeCarriedEmail()).toBe('from-a-dead-document@test.com');
  });

  it('sees a carry this module was never told about', () => {
    sessionStorage.setItem(CARRIED_EMAIL_KEY, 'from-a-dead-document@test.com');

    expect(hasCarriedEmail()).toBe(true);
  });

  it('leaves the noted email in storage rather than in memory', () => {
    noteTypedEmail('half-typed@example.com');
    carryTypedEmail();

    expect(sessionStorage.getItem(CARRIED_EMAIL_KEY)).toBe(
      'half-typed@example.com',
    );
  });

  it('writes nothing else, so no second value rides along', () => {
    noteTypedEmail('half-typed@example.com');
    carryTypedEmail();

    expect(Object.keys(sessionStorage)).toEqual([CARRIED_EMAIL_KEY]);
  });
});

describe('what the reads and the drop leave behind', () => {
  it('takes the carry away, so a reload cannot re-announce', () => {
    sessionStorage.setItem(CARRIED_EMAIL_KEY, 'once@example.com');

    expect(takeCarriedEmail()).toBe('once@example.com');
    expect(takeCarriedEmail()).toBeNull();
  });

  it('leaves the carry standing when it is only asked about', () => {
    sessionStorage.setItem(CARRIED_EMAIL_KEY, 'once@example.com');

    expect(hasCarriedEmail()).toBe(true);
    expect(sessionStorage.getItem(CARRIED_EMAIL_KEY)).toBe('once@example.com');
  });

  it('drops a carry the arrival proved was never needed', () => {
    sessionStorage.setItem(CARRIED_EMAIL_KEY, 'landed@example.com');

    dropCarriedEmail();

    expect(hasCarriedEmail()).toBe(false);
  });

  it('answers null and not empty string when nothing was carried', () => {
    expect(takeCarriedEmail()).toBeNull();
    expect(hasCarriedEmail()).toBe(false);
  });

  it('carries an empty box as a value, since the arrival still followed', () => {
    noteTypedEmail('');
    carryTypedEmail();

    expect(hasCarriedEmail()).toBe(true);
    expect(takeCarriedEmail()).toBe('');
  });
});

describe('a store that refuses', () => {
  it('costs the prefill and not the sign-in when the write is refused', () => {
    noteTypedEmail('half-typed@example.com');

    withRefusedStorage('setItem', () => {
      expect(() => carryTypedEmail()).not.toThrow();
    });

    expect(hasCarriedEmail()).toBe(false);
  });

  it('reads as no carry when the read is refused', () => {
    sessionStorage.setItem(CARRIED_EMAIL_KEY, 'unreachable@example.com');

    withRefusedStorage('getItem', () => {
      expect(takeCarriedEmail()).toBeNull();
      expect(hasCarriedEmail()).toBe(false);
    });
  });

  it('does not throw when the drop is refused', () => {
    sessionStorage.setItem(CARRIED_EMAIL_KEY, 'unreachable@example.com');

    withRefusedStorage('removeItem', () => {
      expect(() => dropCarriedEmail()).not.toThrow();
    });
  });
});

/*
 * What this pins is the outcome, not the `typeof window` guard that also
 * produces it. Each function wraps its access in a `try`, and a missing
 * `window` throws inside that `try`, so deleting all four guards changes
 * nothing any of these assertions can see. They are kept because every
 * sibling store here carries them and a reader comparing the four files
 * should find one shape, not because a test could tell them apart.
 */
describe('a render with no document at all', () => {
  // the auth context imports this, and a server render reaches that
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('answers as an empty carry rather than throwing on `window`', () => {
    const stored = window.sessionStorage;
    vi.stubGlobal('window', undefined);

    expect(takeCarriedEmail()).toBeNull();
    expect(hasCarriedEmail()).toBe(false);
    expect(() => carryTypedEmail()).not.toThrow();
    expect(() => dropCarriedEmail()).not.toThrow();

    vi.unstubAllGlobals();
    expect(stored.getItem(CARRIED_EMAIL_KEY)).toBeNull();
  });
});
