/**
 * Catches the case where the token this tab holds stopped belonging to the
 * user this tab is rendering.
 *
 * Tokens read through to `localStorage` and a sibling's rotation is carried
 * in by a `storage` event, so a tab adopts tokens it never asked for.
 * Adopting a rotation of the SAME user is what that sync exists for and
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
 * would replace a login screen mid-keystroke and destroy the typed email;
 * that case belongs to `AlreadySignedInNotice`, which offers the move
 * instead of taking it.
 *
 * Rendering nobody is not the only place that reasoning holds, though.
 * `routes/Common.tsx` renders regardless of auth state, so a signed-in
 * user sits on `/reset-password` with a new password half typed and a
 * single-use token in the query string. Replacing that document costs
 * both, and the reset link cannot be reissued without another email.
 * Nothing at WCAG A or AA compels holding off: 3.2.5 Change on Request
 * is AAA, and 3.3.7 Redundant Entry governs a second ask, not a field
 * cleared before it was ever submitted. That cost is reason enough on
 * its own. Those routes get the same offer-don't-take treatment, on
 * both the visibility arm and the cold boot.
 *
 * Recording the new subject is part of announcing it, never a separate
 * step: every path here ends in a document that re-runs this comparison,
 * and one that announced without recording would read the same mismatch
 * and announce again, forever.
 */

import { getStoredToken, readTokenClaims } from '../../lib/api';
import {
  normalizePathname,
  rendersRegardlessOfAuth,
} from './authAgnosticPaths';
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

function standingOnDestination(): boolean {
  return (
    normalizePathname(window.location.pathname) === SWITCHED_ACCOUNT_DESTINATION
  );
}

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
  const subject = readTokenClaims(token)?.subject ?? null;
  const priorIdentity = readRenderedIdentity();
  if (subject === null || priorIdentity === null || subject === priorIdentity) {
    return false;
  }

  // a boot off an emailed link would spend the link on the bounce
  if (rendersRegardlessOfAuth()) return false;

  // already at the destination: announce in place, no second page load
  if (standingOnDestination()) {
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

      const subject = readTokenClaims(token)?.subject ?? null;
      if (subject !== null && subject !== renderedUser.userId) {
        // a form here holds typed input this tab would destroy taking it
        if (rendersRegardlessOfAuth()) return;
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
