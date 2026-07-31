import { SetMetadata } from '@nestjs/common';

/** Metadata key read by `TokenScopeService` to allow the bookmarklet token on a route. */
export const BOOKMARKLET_SCOPE_KEY = 'bookmarkletTokenAllowed';

/**
 * Marks a route handler as reachable by the BOOKMARKLET-kind token. The
 * bookmarklet exists only to save a URL, so this decorator lives on exactly
 * one handler: `POST /links`. Every other `AnyAuthGuard` route rejects the
 * bookmarklet token with a 403, limiting the blast radius if it leaks and is
 * never regenerated.
 *
 * @example
 * @AllowsBookmarkletToken()
 * @Post()
 * async create(...) { … }
 */
export const AllowsBookmarkletToken = () =>
  SetMetadata(BOOKMARKLET_SCOPE_KEY, true);
