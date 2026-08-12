/**
 * Tests for the per-tab rendered-identity record.
 *
 * The storage choice is load-bearing rather than incidental, so it is
 * asserted directly: a record kept in `localStorage` would be shared with
 * every sibling tab and could never disagree with the token they wrote.
 *
 * The refusal cases go through `withRefusedStorage`, and each one first
 * puts the store into a state the refusal must hide. A patch that fails
 * to take answers from the real store, which is indistinguishable from a
 * working refusal until something is there to be found.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetRenderedIdentity,
  noteRenderedIdentity,
  readRenderedIdentity,
} from './renderedIdentity';
import { withRefusedStorage } from '../../../test/refusedStorage';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('renderedIdentity round trip', () => {
  it('reads back the identity it was given', () => {
    noteRenderedIdentity('user-1');
    expect(readRenderedIdentity()).toBe('user-1');
  });

  it('answers null for a tab that has never rendered anyone', () => {
    expect(readRenderedIdentity()).toBeNull();
  });

  it('overwrites rather than accumulating', () => {
    noteRenderedIdentity('user-1');
    noteRenderedIdentity('user-2');
    expect(readRenderedIdentity()).toBe('user-2');
  });

  it('answers null again after the record is forgotten', () => {
    noteRenderedIdentity('user-1');
    forgetRenderedIdentity();
    expect(readRenderedIdentity()).toBeNull();
  });
});

describe('renderedIdentity storage choice', () => {
  const KEY = 'linklater_rendered_identity';

  it('writes to sessionStorage, which is per-tab', () => {
    noteRenderedIdentity('user-1');
    expect(sessionStorage.getItem(KEY)).toBe('user-1');
  });

  it('leaves localStorage untouched, which is shared across tabs', () => {
    noteRenderedIdentity('user-1');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('removes from sessionStorage rather than blanking the value', () => {
    noteRenderedIdentity('user-1');
    forgetRenderedIdentity();
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});

describe('renderedIdentity under blocked storage', () => {
  it('answers null instead of throwing when the read is refused', () => {
    noteRenderedIdentity('user-1');

    withRefusedStorage('getItem', () => {
      expect(readRenderedIdentity()).toBeNull();
    });
  });

  it('swallows a refused write', () => {
    withRefusedStorage('setItem', () => {
      expect(() => noteRenderedIdentity('user-1')).not.toThrow();
    });

    expect(readRenderedIdentity()).toBeNull();
  });

  it('swallows a refused removal', () => {
    noteRenderedIdentity('user-1');

    withRefusedStorage('removeItem', () => {
      expect(() => forgetRenderedIdentity()).not.toThrow();
    });

    expect(readRenderedIdentity()).toBe('user-1');
  });
});
