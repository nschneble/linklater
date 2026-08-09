import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';

/**
 * The exit path for an OAuth sign-in callback that cannot mint a session.
 *
 * A provider callback is a top-level browser navigation, so any exception
 * that escapes it renders as raw JSON on the API origin with no route back
 * into the app. Every refusal redirects to the SPA's `/login` instead,
 * carrying a code the auth form turns into copy (web-side catalog:
 * `components/auth/authFlashMessages.ts`) and the provider so that copy can
 * name it. Codes are part of the contract between the two: renaming one
 * here without renaming it there silently downgrades the message to the
 * unknown-code fallback.
 */
export type OAuthSignInFailure =
  | 'mfa_required'
  | 'oauth_failed'
  | 'oauth_state_invalid'
  | 'provider_email_unverified';

/**
 * Refusal to adopt a pre-existing account when the provider will not vouch
 * for the email it handed us. A distinct class rather than a message string
 * because `OAuthCallbackGuard` maps it to its own recovery copy, and a
 * message match would break the moment someone reworded the string.
 */
export class ProviderEmailUnverifiedException extends UnauthorizedException {
  constructor() {
    super('Your provider has not verified this email address.');
  }
}

/** Sends the browser back to the SPA's login page with a failure code. */
export function redirectOAuthSignInFailure(
  response: Response,
  failure: OAuthSignInFailure,
  provider: string,
): void {
  response.redirect(
    `${process.env.APP_URL}/login?error=${failure}&provider=${encodeURIComponent(provider)}`,
  );
}
