import type { LinksFilter } from './types';

/**
 * Internal state driving the `GET /links` query. Held in a reducer so that
 * filter/search changes & load-more increments can be handled atomically.
 */
export interface FetchParams {
  /** The current tab – `'unread'` or `'read'`. */
  filter: LinksFilter;
  /** The current pagination page number, starting at 1. */
  page: number;
  /** The full-text search query string, or an empty string when not searching. */
  search: string;
  /**
   * One-shot limit override for the next fetch. Used by the "less doesn't
   * need more" rule: when the next page would leave exactly one trailing
   * item, the override grabs that item in the same request rather than
   * forcing a follow-up.
   */
  limit?: number;
}

export type FetchParamsAction =
  | { type: 'reset'; filter: LinksFilter; search: string }
  | { type: 'load-more'; limit?: number };

/**
 * Pure reducer for `FetchParams`. `'reset'` replaces filter/search and
 * resets the page to 1, but is a no-op when filter and search haven't
 * changed to avoid redundant fetches. `'load-more'` increments the page #
 * and optionally carries a one-shot limit override for that page.
 */
export function fetchParamsReducer(
  state: FetchParams,
  action: FetchParamsAction,
): FetchParams {
  switch (action.type) {
    case 'reset':
      if (state.filter === action.filter && state.search === action.search) {
        return state;
      }
      return { filter: action.filter, page: 1, search: action.search };
    case 'load-more':
      return { ...state, page: state.page + 1, limit: action.limit };
  }
}
