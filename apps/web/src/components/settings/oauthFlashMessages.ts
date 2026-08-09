/**
 * Copy for the OAuth-link flash messages surfaced by `SettingsView`.
 *
 * `linkedMessage` powers the success Toast (`?linked=…`) and its fallback is
 * provider-agnostic rather than echoing the raw provider code, since the
 * value arrives from the redirect URL and could be anything.
 *
 * `linkErrorMessage` powers the inline `<Alert>` inside `IdPsSection`
 * (`?link_error=…`). The API half of that contract is
 * apps/api/src/auth/oauth-link-failure.ts; a code with no entry here falls
 * back to generic copy, so the two move together.
 *
 * Two constraints on the copy itself:
 * - a declined consent screen is a choice, not a fault. Its copy states
 *   where that leaves the account and offers the way back, with none of the
 *   apology the other codes earn.
 * - the way back names the control by the label it carries, and never says
 *   "sign in" where the heading above the provider rows says log in
 *   (WCAG 3.2.4).
 */

const LINKED_MESSAGES: Record<string, string> = {
  google: 'Google account connected.',
};

/**
 * Mirrors the API's failure union; exported so the copy tests iterate the
 * real list rather than a hand-copy that stays green as codes arrive.
 */
export const LINK_ERROR_CODES = [
  'already_linked',
  'cancelled',
  'provider_error',
  'state_invalid',
  'unknown',
] as const;

type LinkErrorCode = (typeof LINK_ERROR_CODES)[number];

/**
 * Typed so a new code fails the build until it has copy, while the string
 * index still admits a lookup keyed straight off the URL.
 */
const LINK_ERROR_MESSAGES: Record<LinkErrorCode, string> &
  Record<string, string> = {
  already_linked:
    'That account is already linked to another user. Try a different one.',
  cancelled:
    'Your Google account is not connected. Choose Connect Google to link it.',
  provider_error:
    "Google couldn't finish connecting that account. Choose Connect Google to try again.",
  state_invalid:
    'That connection attempt expired or was already used. Choose Connect Google to start again.',
  unknown:
    'Something went wrong connecting that account. Please try again in a moment.',
};

const UNKNOWN_LINKED_MESSAGE = 'Account connected.';
const UNKNOWN_LINK_ERROR_MESSAGE = 'Failed to connect account.';

/**
 * Own-property read. The key comes from a URL, and a plain object answers
 * inherited keys with something non-undefined, so the fallback would never
 * be reached and a function could escape into the render.
 */
function ownMessage(
  messages: Record<string, string>,
  key: string,
): string | undefined {
  if (!Object.hasOwn(messages, key)) return undefined;
  return messages[key];
}

export function linkedMessage(provider: string): string {
  return ownMessage(LINKED_MESSAGES, provider) ?? UNKNOWN_LINKED_MESSAGE;
}

export function linkErrorMessage(code: string): string {
  return ownMessage(LINK_ERROR_MESSAGES, code) ?? UNKNOWN_LINK_ERROR_MESSAGE;
}
