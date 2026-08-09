import type { Response } from 'express';

/**
 * The exit path for an OAuth account-linking callback that cannot link.
 *
 * A provider callback is a top-level browser navigation, so any exception
 * that escapes it renders as raw JSON on the API origin with no route back
 * into the app. Every outcome redirects to the SPA's settings page instead,
 * carrying a code the settings view turns into copy (web-side catalog:
 * components/settings/oauthFlashMessages.ts). Codes are part of the
 * contract between the two: renaming one here without renaming it there
 * silently downgrades the message to the unknown-code fallback.
 *
 * The codes stay separate because they call for different recovery. A
 * cancellation is the user's own choice, an expired or replayed attempt is
 * worth repeating, and a provider failure is neither.
 */
export type OAuthLinkFailure =
  | 'already_linked'
  | 'cancelled'
  | 'provider_error'
  | 'state_invalid'
  | 'unknown';

/** Sends the browser back to the SPA settings page with a code. */
export function redirectOAuthLinkFailure(
  response: Response,
  failure: OAuthLinkFailure,
): void {
  response.redirect(`${process.env.APP_URL}/settings?link_error=${failure}`);
}
