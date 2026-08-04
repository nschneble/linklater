import { findNewLinks, formatNewLinksAnnouncement } from './linksData.utils';
import { getLinks, type Link } from '../api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReannounce } from './useReannounce';
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
 * - A cancellation token discards results when (a) the hook is disabled
 *   mid-flight (filter switched, unmount) or (b) a newer refresh fires
 *   before the previous one resolves – without this, the earlier slower
 *   response could overwrite the later state.
 * - Newly-arrived items are announced via the returned `newLinksAnnouncement`
 *   string – the caller binds it to a pre-mounted `role="status"` live region.
 * - The shared `useReannounce` hook drives the clear-then-set re-trigger, so a
 *   repeat refresh yielding the same count still re-fires even though the
 *   message text is identical (a live region only fires on a text change). Each
 *   arrival bumps a monotonic `announceToken`; the message it should speak is
 *   held in `pendingMessage` and read at fire time.
 * - The 5s TTL empties the announcement so the live region doesn't leave a
 *   stale count in the DOM for a screen reader that reaches it later.
 *
 * @returns `newLinksAnnouncement` – empty string when nothing to announce.
 */
export function useLinksVisibilityRefresh({
  enabled,
  linksReference,
  paginationReference,
  onRefreshed,
}: UseLinksVisibilityRefreshOptions): string {
  // `announceToken` is state not a ref, so identical bumps still re-render
  const [announceToken, setAnnounceToken] = useState(0);
  const [pendingMessage, setPendingMessage] = useState('');
  const newLinksAnnouncement = useReannounce(announceToken, pendingMessage, 0);
  const lastVisibilityRefreshReference = useRef(0);
  const activeTokenReference = useRef(0);

  const runVisibilityRefresh = useCallback(async () => {
    const token = ++activeTokenReference.current;
    try {
      const result = await getLinks({
        read: false,
        page: 1,
        limit: paginationReference.current?.limit,
      });

      // stale fire: newer refresh, disabled, or unmounted mid-flight; discard
      if (token !== activeTokenReference.current) return;

      const additions = findNewLinks(result.data, linksReference.current);

      if (additions.length > 0) {
        onRefreshed(additions, { total: result.total, limit: result.limit });
        // bump rides the same tick as the staleness check, so no phantom announce
        setPendingMessage(formatNewLinksAnnouncement(additions.length));
        setAnnounceToken((current) => current + 1);
      } else {
        onRefreshed([], { total: result.total, limit: result.limit });
      }
    } catch {
      // silent: next navigation retries, no UI error for a background refresh
    }
  }, [linksReference, paginationReference, onRefreshed]);

  useEffect(() => {
    if (!enabled) {
      // invalidate any in-flight refresh so a late result can't leak into state
      activeTokenReference.current++;
      return;
    }

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
      // invalidate whatever token is active at cleanup, not a captured value
      // eslint-disable-next-line react-hooks/exhaustive-deps
      activeTokenReference.current++;
    };
  }, [enabled, runVisibilityRefresh]);

  // clear the announcement after the TTL so no stale count lingers in the DOM
  useEffect(() => {
    if (!newLinksAnnouncement) return;
    const timeoutId = setTimeout(() => {
      setPendingMessage('');
      setAnnounceToken((current) => current + 1);
    }, NEW_LINKS_ANNOUNCEMENT_TTL_MS);
    return () => clearTimeout(timeoutId);
  }, [newLinksAnnouncement]);

  return newLinksAnnouncement;
}
