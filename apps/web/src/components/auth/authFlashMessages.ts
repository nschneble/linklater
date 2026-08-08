/**
 * Copy for the failure codes an OAuth sign-in callback leaves on `/login`
 * as `?error=<code>&provider=<name>`. The other half of the contract is
 * `apps/api/src/auth/oauth-sign-in-failure.ts`: a code with no entry here
 * degrades to the unknown-code copy, so the two lists move together.
 *
 * Keys are `<code>:<provider>` with a bare `<code>` fallback for a redirect
 * that arrives without a provider. Each string is written out per provider
 * rather than interpolated, matching `settings/oauthFlashMessages.ts`.
 *
 * Three copy constraints, all load-bearing:
 * - never the word "password". `passwordHash` is nullable and a refused
 *   account is disproportionately likely to have none, so pointing at a
 *   password would be a second dead end.
 * - "Log in", not "sign in", for the action the user should take: it
 *   matches the tab and button labels already on the page (WCAG 3.2.4).
 * - no positional wording ("the form below"). The form sits above the
 *   provider buttons, and position is not a reliable cue (WCAG 1.3.3).
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
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

/** Copy for a code this build doesn't know: the value rides in from a URL. */
const UNKNOWN_AUTH_ERROR_MESSAGE =
  "That sign-in didn't finish. Log in with your email instead.";

/** Resolves the login-page copy for a redirect's error code and provider. */
export function authErrorMessage(
  code: string,
  provider: string | null,
): string {
  if (provider) {
    const perProvider = AUTH_ERROR_MESSAGES[`${code}:${provider}`];
    if (perProvider) return perProvider;
  }
  return AUTH_ERROR_MESSAGES[code] ?? UNKNOWN_AUTH_ERROR_MESSAGE;
}
