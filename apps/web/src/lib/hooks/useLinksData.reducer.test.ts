/**
 * The fetch-parameter transitions, pinned directly rather than through the
 * hook that consumes them. Two rules matter beyond the arithmetic: a reset
 * that changes nothing must return the same state object, since a fresh one
 * would re-run the fetch effect on every keystroke, and load-more must leave
 * filter and search alone so a later page keeps querying the same list.
 */

import { describe, expect, it } from 'vitest';
import { fetchParametersReducer } from './useLinksData.reducer';

describe('fetchParametersReducer', () => {
  it('reset changes filter and resets page to 1', () => {
    const state = { filter: 'unread' as const, page: 3, search: '' };
    const next = fetchParametersReducer(state, {
      type: 'reset',
      filter: 'read',
      search: '',
    });
    expect(next).toEqual({ filter: 'read', page: 1, search: '' });
  });

  it('reset returns same reference when filter and search are unchanged', () => {
    const state = { filter: 'unread' as const, page: 2, search: 'hello' };
    const next = fetchParametersReducer(state, {
      type: 'reset',
      filter: 'unread',
      search: 'hello',
    });
    expect(next).toBe(state);
  });

  it('load-more preserves filter and search while only advancing the page', () => {
    const state = { filter: 'read' as const, page: 2, search: 'duck' };
    const next = fetchParametersReducer(state, { type: 'load-more' });
    expect(next).toEqual({ filter: 'read', page: 3, search: 'duck' });
  });
});
