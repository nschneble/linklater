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
 * Whether storage holds a token that names somebody and has not run out.
 *
 * The two halves fail for different reasons. A token nobody can be
 * identified from is not evidence anyone signed in, which is also how an
 * opaque `ltk_` API token stays silent. An expiry already passed is read
 * as the token no longer speaking for a session by itself, which is
 * weaker than it once was: the pre-flight in `lib/api/core.ts` renews
 * exactly such a token before spending a request on it, so a live refresh
 * token behind it puts the session back in one round trip. Withholding
 * the offer there is the conservative answer rather than the correct one,
 * and it is kept because widening it is a question about what to promise
 * someone, not about what is true.
 *
 * Neither half is close to sufficient in the other direction. A
 * revocation (a `tokenVersion` bump) leaves `exp` sitting in the future,
 * and a token carrying no readable expiry is dated by nothing here.
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
