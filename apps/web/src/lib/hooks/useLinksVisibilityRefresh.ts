import { getLinks, type Link } from '../api';
import { findNewLinks, formatNewLinksAnnouncement } from './linksData.utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { PaginatedLinks } from '../api';

const VISIBILITY_REFRESH_MIN_INTERVAL_MS = 2000;
const NEW_LINKS_ANNOUNCEMENT_TTL_MS = 5000;

interface UseLinksVisibilityRefreshOptions {
  enabled: boolean;
  linksReference: MutableRefObject<Link[]>;
  paginationReference: MutableRefObject<Pick<
    PaginatedLinks,
    'total' | 'limit'
  > | null>;
  onRefreshed: (
    additions: Link[],
    result: { total: number; limit: number },
  ) => void;
}

/**
 * Soft-refreshes the unread list when the user returns to the tab after
 * saving a link via the bookmarklet on another tab. Scoped to the default
 * unread, no-search view.
 *
 * - 2s stale-time guard prevents rapid tab-switching from fanning out requests.
 * - Newly-arrived items are announced via the returned `newLinksAnnouncement`
 *   string — the caller binds it to a pre-mounted `role="status"` live region.
 * - The clear-then-set microtask pattern ensures repeat-count announcements
 *   re-fire even when the message text is identical.
 * - The 5s TTL clears the announcement so a follow-up refresh that yields the
 *   same count still triggers a fresh announcement (aria-live fires on change).
 *
 * @returns `newLinksAnnouncement` — empty string when nothing to announce.
 */
export function useLinksVisibilityRefresh({
  enabled,
  linksReference,
  paginationReference,
  onRefreshed,
}: UseLinksVisibilityRefreshOptions): string {
  const [newLinksAnnouncement, setNewLinksAnnouncement] = useState('');
  const lastVisibilityRefreshReference = useRef(0);

  const runVisibilityRefresh = useCallback(async () => {
    try {
      const result = await getLinks({
        read: false,
        page: 1,
        limit: paginationReference.current?.limit,
      });

      const additions = findNewLinks(result.data, linksReference.current);

      if (additions.length > 0) {
        onRefreshed(additions, { total: result.total, limit: result.limit });
        // Clear-then-set on a microtask so re-announcement fires even if
        // the message text is identical to the previous one.
        setNewLinksAnnouncement('');
        setTimeout(() => {
          setNewLinksAnnouncement(formatNewLinksAnnouncement(additions.length));
        }, 0);
      } else {
        onRefreshed([], { total: result.total, limit: result.limit });
      }
    } catch {
      // Silent: next user navigation will retry. We don't surface a
      // background-refresh failure as a UI error.
    }
  }, [linksReference, paginationReference, onRefreshed]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (
        now - lastVisibilityRefreshReference.current <
        VISIBILITY_REFRESH_MIN_INTERVAL_MS
      ) {
        return;
      }
      lastVisibilityRefreshReference.current = now;
      void runVisibilityRefresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, runVisibilityRefresh]);

  // Clear the announcement after TTL so a follow-up refresh yielding the
  // same count still fires a new aria-live announcement (only text changes trigger it).
  useEffect(() => {
    if (!newLinksAnnouncement) return;
    const timeoutId = setTimeout(() => {
      setNewLinksAnnouncement('');
    }, NEW_LINKS_ANNOUNCEMENT_TTL_MS);
    return () => clearTimeout(timeoutId);
  }, [newLinksAnnouncement]);

  return newLinksAnnouncement;
}
