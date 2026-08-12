/**
 * Records that the standing session offer was followed and did not land.
 *
 * A click is not a bounce. `AlreadySignedInNotice` knows only that its
 * link was activated, and the common case is that the link works, so
 * arming an announcement there announces on success as loudly as on
 * failure. The auth gate is the one party that observes the failure: the
 * catch-all in `routes/Unauthenticated.tsx` renders only when a load has
 * already come back with no user, on a path that needs one.
 *
 * Three things have to be true before the arrival gets to speak, and each
 * of the three is a message the user would otherwise lose or have
 * contradicted.
 *
 * A load that never followed the offer was in no session to be put out
 * of, and saying so to someone who simply opened a bookmarked page is a
 * claim about a session they never had.
 *
 * An offer still standing behind the arrival is about to speak for
 * itself, out of a region of its own. Queuing here as well puts two
 * polite regions in one batched render, read in DOM order with the false
 * half first.
 *
 * The slot is one-shot, and whatever already owns it was put there by a
 * flow the user asked for. Several of those are assertive error copy that
 * this warning would both replace and demote to the polite channel (WCAG
 * 3.3.1 Error Identification).
 */

import { hasCarriedEmail } from './carriedEmail';
import { hasPendingNotice, setPendingNotice } from '../../lib/pendingNotice';
import { hasStandingSessionOffer } from './standingSessionOffer';

export function announceOfferBounce(): void {
  if (!hasCarriedEmail()) return;
  if (hasStandingSessionOffer()) return;
  if (hasPendingNotice()) return;

  setPendingNotice('session-unavailable');
}
