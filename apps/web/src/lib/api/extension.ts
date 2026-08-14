/**
 * The browser extension's PKCE grant, as the web app sees it.
 *
 * A `fetch` rather than a top-level navigation at the API, for the reason
 * `initiateOAuthLink` gives: the endpoint is guarded by a session JWT, and
 * only a request the app builds itself can carry one. The server answers
 * with the extension's callback URL, code appended, and the caller
 * navigates to that.
 */

import { apiFetchRequired } from './core';

export async function authorizeExtension(
  codeChallenge: string,
  redirectUri: string,
): Promise<{ redirectUrl: string }> {
  return apiFetchRequired<{ redirectUrl: string }>(
    '/auth/extension/authorize',
    {
      body: JSON.stringify({ codeChallenge, redirectUri }),
      method: 'POST',
    },
  );
}
