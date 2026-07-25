import { getLinks, type Link } from '../api';
import { findNewLinks, formatNewLinksAnnouncement } from './linksData.utils';
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
  // The clear-then-set re-announce lives in the shared `useReannounce` hook:
  // each arrival bumps `announceToken` (so an identical consecutive count still
  // re-fires), and `pendingMessage` carries the text the hook reads at fire
  // time. `announceToken` is state (not a ref) so a repeat bump with an
  // unchanged message still forces the render that re-runs the hook's effect.
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

      // Stale fire: a newer refresh started, the hook was disabled, or the
      // component unmounted while this request was in flight. Discard.
      if (token !== activeTokenReference.current) return;

      const additions = findNewLinks(result.data, linksReference.current);

      if (additions.length > 0) {
        onRefreshed(additions, { total: result.total, limit: result.limit });
        // Hand the message + a fresh token to `useReannounce`, which owns the
        // clear-then-set so an identical consecutive count still re-fires. The
        // bump happens on the same tick as the (already-passed) staleness check
        // above, so a stale in-flight refresh can't fire a phantom announcement.
        setPendingMessage(formatNewLinksAnnouncement(additions.length));
        setAnnounceToken((current) => current + 1);
      } else {
        onRefreshed([], { total: result.total, limit: result.limit });
      }
    } catch {
      // Silent: next user navigation will retry. We don't surface a
      // background-refresh failure as a UI error.
    }
  }, [linksReference, paginationReference, onRefreshed]);

  useEffect(() => {
    if (!enabled) {
      // Invalidate any in-flight refresh so a result that arrives after the
      // filter switch cannot leak into the new consumer state.
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
      // Invalidate so cleanup-after-unmount drops any in-flight result.
      // Reading the latest .current here is intentional – we want to
      // invalidate WHATEVER token is active at cleanup time, not capture
      // a stale value on attachment.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      activeTokenReference.current++;
    };
  }, [enabled, runVisibilityRefresh]);

  // Empty the announcement after the TTL so the live region doesn't leave a
  // stale count in the DOM. Clearing goes through the same trigger/message
  // inputs `useReannounce` owns: blank the pending message, then bump the token
  // so the hook re-runs and settles the region back to ''.
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
