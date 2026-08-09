/**
 * Copy for the failure codes an OAuth sign-in callback leaves on the login
 * URL. The API half of the contract is oauth-sign-in-failure.ts; a code
 * with no entry here falls back to generic copy, so the two move together.
 *
 * Three constraints on the copy itself:
 * - never the word "password". A refused account is disproportionately
 *   likely to have none, so that would be a second dead end.
 * - "Log in", not "sign in", matching the tab and button already on the
 *   page (WCAG 3.2.4).
 * - no positional wording. The form sits above the provider buttons, and
 *   position is not a reliable cue (WCAG 1.3.3).
 */

/**
 * Mirrors the API's failure union; exported so the copy tests iterate the
 * real list rather than a hand-copy that stays green as codes arrive.
 */
export const AUTH_ERROR_CODES = [
  'mfa_required',
  'oauth_failed',
  'oauth_state_invalid',
  'provider_email_unverified',
] as const;

type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/**
 * Typed so a new code fails the build until it has copy, while the string
 * index still admits the per-provider keys.
 */
const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> &
  Record<string, string> = {
  'mfa_required:apple':
    "Apple can't ask for your authenticator code. Log in with your email instead.",
  'mfa_required:google':
    "Google can't ask for your authenticator code. Log in with your email instead.",
  mfa_required:
    "That sign-in can't ask for your authenticator code. Log in with your email instead.",
  'oauth_failed:apple':
    "Apple couldn't finish that login. Try again, or log in with your email instead.",
  'oauth_failed:google':
    "Google couldn't finish that login. Try again, or log in with your email instead.",
  oauth_failed:
    "That sign-in didn't finish. Try again, or log in with your email instead.",
  'oauth_state_invalid:apple':
    'That Apple login expired or was already used. Try again, or log in with your email instead.',
  'oauth_state_invalid:google':
    'That Google login expired or was already used. Try again, or log in with your email instead.',
  oauth_state_invalid:
    'That login expired or was already used. Try again, or log in with your email instead.',
  'provider_email_unverified:apple':
    "Apple hasn't confirmed this email address. Log in with your email instead.",
  'provider_email_unverified:google':
    "Google hasn't confirmed this email address. Log in with your email instead.",
  provider_email_unverified:
    "That sign-in didn't confirm this email address. Log in with your email instead.",
};

const UNKNOWN_AUTH_ERROR_MESSAGE =
  "That sign-in didn't finish. Log in with your email instead.";

/**
 * Own-property read. The key comes from a URL, and a plain object answers
 * inherited keys with something non-undefined, so the fallback would never
 * be reached and a function could escape into the render.
 */
function ownMessage(key: string): string | undefined {
  if (!Object.hasOwn(AUTH_ERROR_MESSAGES, key)) return undefined;
  return AUTH_ERROR_MESSAGES[key];
}

export function authErrorMessage(
  code: string,
  provider: string | null,
): string {
  if (provider) {
    const perProvider = ownMessage(`${code}:${provider}`);
    if (perProvider) return perProvider;
  }
  return ownMessage(code) ?? UNKNOWN_AUTH_ERROR_MESSAGE;
}
