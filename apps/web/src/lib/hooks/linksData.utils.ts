import type { Link } from '../api';

/**
 * Picks out links from `incoming` that don't already appear in `existing`,
 * keyed by id. Pure – safe to call inside a setter callback to avoid races.
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
