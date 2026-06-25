import type { LinksFilter } from './types';

/**
 * How long to wait after the user stops typing before firing the search
 * request.
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Maps the current URL pathname to the links filter.
 * `/read` → `'read'`, everything else → `'unread'`.
 */
export function filterFromPath(pathname: string): LinksFilter {
  return pathname === '/read' ? 'read' : 'unread';
}
