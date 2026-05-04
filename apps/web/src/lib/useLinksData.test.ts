import { describe, expect, it } from 'vitest';
import { fetchParamsReducer } from './useLinksData';

describe('fetchParamsReducer', () => {
  it('reset changes filter and resets page to 1', () => {
    const state = { filter: 'active' as const, page: 3, search: '' };
    const next = fetchParamsReducer(state, {
      type: 'reset',
      filter: 'archived',
      search: '',
    });
    expect(next).toEqual({ filter: 'archived', page: 1, search: '' });
  });

  it('reset returns same reference when filter and search are unchanged', () => {
    const state = { filter: 'active' as const, page: 2, search: 'hello' };
    const next = fetchParamsReducer(state, {
      type: 'reset',
      filter: 'active',
      search: 'hello',
    });
    expect(next).toBe(state);
  });

  it('load-more increments page', () => {
    const state = { filter: 'active' as const, page: 1, search: '' };
    const next = fetchParamsReducer(state, { type: 'load-more' });
    expect(next.page).toBe(2);
  });
});
