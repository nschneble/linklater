/**
 * Whether a live session exists that this tab is showing the login form
 * instead of, asked as a pure read of storage.
 *
 * Two components need the same answer and neither can hold it for the
 * other: `AlreadySignedInNotice` raises the offer, and `useAuthForm` has
 * to know an offer is up before it decides whether to move focus into an
 * input, which would flip a screen reader into forms mode and mute the
 * region the notice is about to populate. Both read storage, so there is
 * nothing to lift and one definition covers both.
 */

import { getStoredToken, readTokenClaims } from '../../lib/api';
import { readRenderedIdentity } from '../../auth/AuthContext/renderedIdentity';

/**
 * Whether storage holds a token somebody is identifiable from that has
 * not run out. A token nobody can be identified from is not evidence
 * anyone signed in, which is also how an opaque `ltk_` API token stays
 * silent, and an expired one is evidence of a session that has ended:
 * the arm this feeds is a boot whose profile fetch failed without a 401,
 * which is exactly what an expired token behind a network blip looks
 * like. Announcing there offers a way back that cannot be taken, and
 * spends a document load to say so. Expiry is necessary and not
 * sufficient, since a revocation
 * (a `tokenVersion` bump) leaves `exp` sitting in the future, and a
 * token carrying no readable expiry is dated by nothing here.
 */
export function storedTokenHasLiveOwner(): boolean {
  const claims = readTokenClaims(getStoredToken());
  if (claims?.subject == null) return false;
  if (claims.exp === null) return true;
  return claims.exp * 1000 > Date.now();
}

/**
 * The offer as a boot of this tab finds it: a token with a live owner,
 * and a tab that rendered somebody before.
 *
 * That second half is what separates a deliberate sign-out from a boot
 * that failed on its own. `logout` clears the token only once the revoke
 * round trip returns, so the login form appears while a live token is
 * still in storage; it forgets the rendered identity first. The cost is a
 * tab that has never rendered anyone, which gets no offer until a sibling
 * writes.
 *
 * A sibling signing in later raises the offer without either half being
 * true at mount, and that arm belongs to the notice alone: focus has
 * already gone wherever the user put it by then, and taking it back would
 * cost more than the announcement is worth.
 */
export function hasStandingSessionOffer(): boolean {
  return readRenderedIdentity() !== null && storedTokenHasLiveOwner();
}
