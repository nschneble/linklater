/**
 * Whether the consent screen may still name the account it is granting
 * on.
 *
 * Display policy rather than token reading, which is why it does not sit
 * beside `readGrantIdentity`. Nothing here asks what the store holds; it
 * asks what the page has already concluded, and decides whether the
 * identity line survives it.
 *
 * The set below is the states that leave it vouched for. An allowlist
 * rather than a refusal to name it on the one failure that unseats it: a
 * verdict added to the union later goes unnamed here and closes the
 * line, where a denylist would leave the wrong address painted.
 */

import type { AuthorizeFailure } from './extensionAuthorizeMessages';

const VOUCHED_FAILURES: ReadonlySet<AuthorizeFailure> = new Set([
  'request-invalid',
  'unavailable',
]);

export function accountIsVouchedFor(
  failure: AuthorizeFailure | null,
  mismatched: boolean,
): boolean {
  if (mismatched) return false;
  return failure === null || VOUCHED_FAILURES.has(failure);
}
