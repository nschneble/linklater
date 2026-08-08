import { getErrorMessage } from '../errors';
import { getLinks, type Link, type PaginatedLinks } from '../api';
import type { LinksFilter } from './types';

/** The query one page fetch is made from. */
export interface LinksPageRequest {
  filter: LinksFilter;
  page: number;
  search: string;
}

/**
 * How the returned rows join the list already on screen. Page 1 MERGES so a
 * search or filter refetch cannot revert an already-settled card to its
 * loading skeleton; later pages APPEND, because a prepend would shift the
 * offset and let a subsequent page re-serve a row that is already visible.
 */
export type LinksPageMode = 'merge' | 'append';

export type LinksPageOutcome =
  | {
      status: 'loaded';
      mode: LinksPageMode;
      data: Link[];
      pagination: Pick<PaginatedLinks, 'total' | 'limit'>;
    }
  | { status: 'failed'; message: string };

/**
 * Runs one `GET /links` page and reports what the caller should do with it.
 *
 * Resolves rather than rejects on failure, so the caller has one shape to
 * apply and cannot forget the error branch. Cancellation is deliberately NOT
 * handled here: whether a settled request is still wanted is a question about
 * the component's lifetime, which belongs with the effect.
 */
export async function loadLinksPage(
  { filter, page, search }: LinksPageRequest,
  fetchLinks: typeof getLinks = getLinks,
): Promise<LinksPageOutcome> {
  try {
    const result = await fetchLinks({
      // an empty box means "no search", not "match the empty string"
      search: search || undefined,
      read: filter === 'read',
      page,
    });
    return {
      status: 'loaded',
      mode: page === 1 ? 'merge' : 'append',
      data: result.data,
      pagination: { total: result.total, limit: result.limit },
    };
  } catch (error) {
    return {
      status: 'failed',
      message: getErrorMessage(error, 'Failed to load links'),
    };
  }
}
