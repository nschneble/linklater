import { timingSafeEqual } from 'crypto';
import { generateHexToken } from '../common/index.js';
import type { Request, Response } from 'express';

/** Name of the double-submit CSRF cookie set by `issueOAuthState`. */
export const OAUTH_STATE_COOKIE_NAME = 'oauth_state';

/** How long the cookie survives before a callback is rejected as stale. */
const OAUTH_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Issues a random OAuth sign-in CSRF nonce as an httpOnly cookie and returns
 * the same value to pass as the `state` query parameter Google/Apple echo
 * back on the callback (a double-submit cookie).
 *
 * Binding to a cookie – not just a signed value – is required here. The
 * account-linking flow (`oauth-link-state.ts`) can get away with a signed,
 * unbound state because it embeds an authenticated user's ID: even replayed,
 * it can only ever link the same account. Sign-in has no user to embed yet,
 * so the state's only job is proving the callback belongs to the SAME
 * browser that clicked "Sign in" – and a signature alone can't prove that.
 * An attacker who completes their own real OAuth flow legitimately obtains a
 * validly-signed `code`+`state` pair and can simply replay that whole URL to
 * a victim (classic OAuth login-CSRF); nothing about the signature ties it
 * to the initiating browser. A cookie only that browser holds does.
 *
 * `sameSite: 'none'` (not `'lax'`) because Apple's callback is a cross-site
 * top-level POST (`response_mode=form_post`, required by
 * `@nicokaiser/passport-apple`) – Lax's top-level-navigation exception only
 * covers safe methods (GET/HEAD), so a Lax cookie is silently dropped on
 * Apple's POST callback and this check would reject every real Apple
 * sign-in. `SameSite=None` mandates `Secure`, which is always true here
 * (`secure: true` unconditionally, not just in production) because both the
 * documented local dev setup and the deployed app terminate TLS in front of
 * this server (mkcert locally, Caddy in production – see `.env.example`'s
 * `https://localhost:3000` callback URLs and `main.ts`'s `loadHttpsOptions`)
 * so the browser's connection is HTTPS in both cases regardless of the
 * Node-to-proxy hop. The CSRF guarantee itself comes from the double-submit
 * match in `consumeOAuthState`, not from SameSite – None doesn't weaken it.
 */
export function issueOAuthState(response: Response): string {
  const nonce = generateHexToken();
  response.cookie(OAUTH_STATE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE_MS,
    path: '/auth',
  });
  return nonce;
}

/**
 * Verifies an OAuth callback's `state` (query param for Google's GET
 * callback, body field for Apple's `response_mode=form_post` callback)
 * against the cookie set by `issueOAuthState`, then clears the cookie –
 * single-use, like every other token in this codebase. Returns `true` only
 * when both are present, equal length, and match via a constant-time
 * comparison.
 */
export function consumeOAuthState(
  request: Request,
  response: Response,
): boolean {
  const cookieValue = readCookie(request, OAUTH_STATE_COOKIE_NAME);
  const receivedState = readState(request);
  response.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/auth' });

  if (!cookieValue || !receivedState) return false;

  const expected = Buffer.from(cookieValue);
  const received = Buffer.from(receivedState);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

function readState(request: Request): string | undefined {
  const fromQuery = request.query?.state;
  if (typeof fromQuery === 'string') return fromQuery;

  const fromBody = (request.body as Record<string, unknown> | undefined)?.state;
  if (typeof fromBody === 'string') return fromBody;

  return undefined;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}
