import type { LinksFilter } from './types';

/**
 * Internal state driving the `GET /links` query. Held in a reducer so that
 * filter/search changes & load-more increments can be handled atomically.
 */
export interface FetchParameters {
  /** The current tab – `'unread'` or `'read'`. */
  filter: LinksFilter;
  /** The current pagination page number, starting at 1. */
  page: number;
  /** The full-text search query string, or an empty string when not searching. */
  search: string;
}

export type FetchParametersAction =
  | { type: 'reset'; filter: LinksFilter; search: string }
  | { type: 'load-more' };

/**
 * Pure reducer for `FetchParameters`. `'reset'` replaces filter/search and
 * resets the page to 1, but is a no-op when filter and search haven't
 * changed to avoid redundant fetches. `'load-more'` increments the page
 * number. The per-page `limit` is intentionally never varied: the server
 * computes its offset as `(page - 1) * limit`, so bumping `limit` on a
 * later page would multiply into the offset and silently skip a row. The
 * "less doesn't need more" rule is honored by fetching a trailing item as
 * its own follow-up page (see the auto-load net in `useLinksFetch`).
 */
export function fetchParametersReducer(
  state: FetchParameters,
  action: FetchParametersAction,
): FetchParameters {
  switch (action.type) {
    case 'reset':
      if (state.filter === action.filter && state.search === action.search) {
        return state;
      }
      return { filter: action.filter, page: 1, search: action.search };
    case 'load-more':
      return { ...state, page: state.page + 1 };
  }
}
