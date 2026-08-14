/**
 * What the extension consent screen says when a grant fails, and how a
 * rejection is sorted into one of the three things it can say.
 *
 * Page-local rather than in `noticeCatalog.ts`, which carries notices
 * across a navigation through sessionStorage. These are same-route:
 * nothing moves, and the message is spoken where the failed control still
 * sits. `authFlashMessages.ts` is the precedent for copy kept beside the
 * screen that renders it.
 *
 * The sort reads `status` and never `message`. `parseError` fills an
 * `ApiError`'s message from the server's own response body, so the house
 * `getErrorMessage` convention would render raw server text such as
 * "Invalid redirect_uri" into a message the user is being asked to act on.
 *
 * The session-lost wording stops at signing in again on purpose. The grant
 * does not survive that trip today, so promising the extension will pick
 * up where it left off would be a promise the flow breaks.
 */

import { ApiError } from '../../lib/api';

export type AuthorizeFailure =
  'request-invalid' | 'session-lost' | 'unavailable';

export const AUTHORIZE_FAILURE_MESSAGES: Record<AuthorizeFailure, string> = {
  'request-invalid':
    "We couldn't read the request the extension sent. Close this tab and start again from the extension.",
  'session-lost':
    "You're no longer signed in. Sign in again, then start over from the extension.",
  unavailable:
    "We couldn't authorize the extension right now. Please try again.",
};

export function authorizeFailureFrom(caught: unknown): AuthorizeFailure {
  if (!(caught instanceof ApiError)) return 'unavailable';
  if (caught.status === 401) return 'session-lost';
  if (caught.status === 400) return 'request-invalid';
  return 'unavailable';
}
