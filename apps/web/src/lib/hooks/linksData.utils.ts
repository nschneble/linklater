import type { Link } from '../api';

/**
 * A link is settled once its metadata job has finished and stamped
 * `meta.fetchedAt`. Everything before that (`meta` null, or present but without
 * `fetchedAt`) still counts as pending.
 */
export function isMetadataSettled(link: Link): boolean {
  return Boolean(link.meta?.fetchedAt);
}

/** A link whose metadata has not been fetched yet (still showing a skeleton). */
export function isMetadataPending(link: Link): boolean {
  return !isMetadataSettled(link);
}

/**
 * Picks out links from `incoming` that don't already appear in `existing`,
 * keyed by id. Pure, safe to call inside a setter callback to avoid races.
 */
export function findNewLinks(incoming: Link[], existing: Link[]): Link[] {
  const existingIds = new Set(existing.map((link) => link.id));
  return incoming.filter((link) => !existingIds.has(link.id));
}

/**
 * Builds the polite live-region message for the count of links that arrived
 * via a background visibility refresh.
 */
export function formatNewLinksAnnouncement(count: number): string {
  return count === 1 ? '1 new link added' : `${count} new links added`;
}

/**
 * Merges a freshly fetched page-1 list over the current list so newer metadata
 * always wins and settled metadata never regresses.
 *
 * `incoming` is authoritative for ordering, membership, and every field of
 * each link, with one guard: when an incoming link's `meta.fetchedAt` is
 * nullish (a response that predates the metadata job finishing) but the
 * matching link already in `existing` carries a `meta.fetchedAt`, the existing
 * `meta` is kept. That stops a link the client already settled from reverting
 * to its loading skeleton. A link card's `aria-busy` derives from
 * `!meta.fetchedAt`, so preserving `fetchedAt` is what keeps `aria-busy` from
 * flipping false back to true for a settled card. A link absent from `incoming`
 * is dropped, and a link with no prior copy passes through untouched. Pure, so
 * it is safe to call inside a setter callback to avoid races.
 */
export function mergeSettledMetadata(
  incoming: Link[],
  existing: Link[],
): Link[] {
  const existingById = new Map(
    existing.map((link): [string, Link] => [link.id, link]),
  );
  return incoming.map((link) => {
    if (isMetadataSettled(link)) {
      return link;
    }
    const previous = existingById.get(link.id);
    if (previous && isMetadataSettled(previous)) {
      return { ...link, meta: previous.meta };
    }
    return link;
  });
}
