/**
 * Catches the case where the token this tab holds stopped belonging to the
 * user this tab is rendering.
 *
 * Tokens read through to `localStorage` and a sibling's rotation is carried
 * in by a `storage` event, so a tab can now adopt a token it never asked
 * for. Adopting a rotation of the SAME user is the point of that work and
 * stays silent. Adopting a DIFFERENT user is an account switch nobody on
 * this tab performed, and it gets announced.
 *
 * The subject is read off the stored JWT locally, which is why the 2s
 * throttle below can gate the profile refetch without gating the check:
 * a user flicking between tabs faster than that would otherwise keep
 * rendering the old account's data under the new account's token
 * indefinitely.
 *
 * A tab rendering nobody is deliberately left alone here. Re-hydrating it
 * would replace a login screen mid-keystroke and destroy the typed email
 * (WCAG 3.3.7); that case belongs to `AlreadySignedInNotice`, which offers
 * the move instead of taking it.
 *
 * Recording the new subject is part of announcing it, never a separate
 * step: every path here ends in a document that re-runs this comparison,
 * and one that announced without recording would read the same mismatch
 * and announce again, forever.
 */

import { getStoredToken, readTokenClaims } from '../../lib/api';
import { noteRenderedIdentity, readRenderedIdentity } from './renderedIdentity';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { User } from './types';

const VISIBILITY_REFRESH_MIN_INTERVAL_MS = 2000;

/**
 * `/unread` is the only destination, because the notice rides
 * sessionStorage and only `AuthForm` and `LinksView` consume it. Landing
 * anywhere else strands the message until some later, unrelated arrival.
 */
const SWITCHED_ACCOUNT_DESTINATION = '/unread';

/** Queues the announcement and takes ownership of the new subject. */
function announceSwitchTo(subject: string): void {
  noteRenderedIdentity(subject);
  setPendingNotice('account-switched');
}

/**
 * A full document replacement, never a React state swap. A state swap
 * leaves a stale virtual buffer over the previous user's content, drops
 * focus, races in-flight requests against the new token, and unmounts the
 * pending-notice carrier before it can announce.
 */
function rehydrateAs(subject: string): void {
  announceSwitchTo(subject);
  window.location.assign(SWITCHED_ACCOUNT_DESTINATION);
}

/**
 * Compares the booting token against whoever this tab was rendering before
 * the reload. Returns `true` when a replacement document is on its way, so
 * the caller can abandon the boot it was about to run.
 */
export function reconcileColdBootIdentity(token: string): boolean {
  const subject = readTokenClaims(token)?.sub ?? null;
  const priorIdentity = readRenderedIdentity();
  if (subject === null || priorIdentity === null || subject === priorIdentity) {
    return false;
  }

  // already at the destination: announce in place, no second page load
  if (window.location.pathname === SWITCHED_ACCOUNT_DESTINATION) {
    announceSwitchTo(subject);
    return false;
  }

  rehydrateAs(subject);
  return true;
}

export function useIdentityGuard(
  userReference: RefObject<User | null>,
  refreshUser: () => Promise<void>,
): void {
  const lastVisibilityRefreshReference = useRef(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      const token = getStoredToken();
      if (token === null) return;

      const renderedUser = userReference.current;
      if (renderedUser === null) return;

      const subject = readTokenClaims(token)?.sub ?? null;
      if (subject !== null && subject !== renderedUser.userId) {
        rehydrateAs(subject);
        return;
      }

      const now = Date.now();
      if (
        now - lastVisibilityRefreshReference.current <
        VISIBILITY_REFRESH_MIN_INTERVAL_MS
      ) {
        return;
      }
      lastVisibilityRefreshReference.current = now;
      void refreshUser();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshUser, userReference]);
}
