import { jest } from '@jest/globals';
import {
  OAUTH_STATE_COOKIE_NAME,
  consumeOAuthState,
  issueOAuthState,
} from './oauth-state-cookie';

import type { Request, Response } from 'express';

const makeResponse = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  }) as unknown as Response;

const makeRequest = (overrides: {
  cookieHeader?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}) =>
  ({
    headers: { cookie: overrides.cookieHeader },
    query: overrides.query ?? {},
    body: overrides.body,
  }) as unknown as Request;

describe('oauth-state-cookie', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('issueOAuthState', () => {
    it('sets an httpOnly, Secure, SameSite=None cookie scoped to /auth and returns the same value', () => {
      const response = makeResponse();

      const nonce = issueOAuthState(response);

      expect(nonce).toMatch(/^[0-9a-f]{64}$/);
      expect(response.cookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        nonce,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/auth',
        }),
      );
    });

    // Always Secure/None, unconditionally – not gated on NODE_ENV. Apple's
    // callback is a cross-site POST (form_post); SameSite=None is required
    // for the cookie to survive that navigation at all, and None mandates
    // Secure. Both local dev (mkcert) and production (Caddy) terminate TLS
    // in front of this server, so the browser's connection is HTTPS either
    // way – see the docstring on `issueOAuthState`.
    it('marks the cookie secure regardless of NODE_ENV', () => {
      const response = makeResponse();

      issueOAuthState(response);

      const [, , options] = (response.cookie as jest.Mock).mock.calls[0] as [
        string,
        string,
        { secure: boolean },
      ];
      expect(options.secure).toBe(true);
    });

    it('generates a different nonce on every call', () => {
      const response = makeResponse();
      const first = issueOAuthState(response);
      const second = issueOAuthState(response);
      expect(first).not.toBe(second);
    });
  });

  describe('consumeOAuthState', () => {
    it('returns true when the cookie and query state match', () => {
      const nonce = 'a'.repeat(64);
      const request = makeRequest({
        cookieHeader: `${OAUTH_STATE_COOKIE_NAME}=${nonce}`,
        query: { state: nonce },
      });
      const response = makeResponse();

      expect(consumeOAuthState(request, response)).toBe(true);
    });

    it('returns true when the cookie and body state match (Apple form_post)', () => {
      const nonce = 'b'.repeat(64);
      const request = makeRequest({
        cookieHeader: `${OAUTH_STATE_COOKIE_NAME}=${nonce}`,
        body: { state: nonce },
      });
      const response = makeResponse();

      expect(consumeOAuthState(request, response)).toBe(true);
    });

    it('always clears the cookie, regardless of outcome (single-use)', () => {
      const request = makeRequest({});
      const response = makeResponse();

      consumeOAuthState(request, response);

      expect(response.clearCookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        expect.objectContaining({ path: '/auth' }),
      );
    });

    it('returns false when there is no cookie at all – forged/replayed callback with no matching browser session', () => {
      const nonce = 'c'.repeat(64);
      const request = makeRequest({ query: { state: nonce } });
      const response = makeResponse();

      expect(consumeOAuthState(request, response)).toBe(false);
    });

    it('returns false when there is no state in the query or body', () => {
      const nonce = 'd'.repeat(64);
      const request = makeRequest({
        cookieHeader: `${OAUTH_STATE_COOKIE_NAME}=${nonce}`,
      });
      const response = makeResponse();

      expect(consumeOAuthState(request, response)).toBe(false);
    });

    it('returns false when the cookie and state values differ', () => {
      const request = makeRequest({
        cookieHeader: `${OAUTH_STATE_COOKIE_NAME}=${'e'.repeat(64)}`,
        query: { state: 'f'.repeat(64) },
      });
      const response = makeResponse();

      expect(consumeOAuthState(request, response)).toBe(false);
    });

    it('returns false when the cookie and state differ in length (guards the timingSafeEqual precondition)', () => {
      const request = makeRequest({
        cookieHeader: `${OAUTH_STATE_COOKIE_NAME}=short`,
        query: { state: 'g'.repeat(64) },
      });
      const response = makeResponse();

      expect(consumeOAuthState(request, response)).toBe(false);
    });

    it('reads the right cookie out of a multi-cookie header', () => {
      const nonce = 'h'.repeat(64);
      const request = makeRequest({
        cookieHeader: `other=1; ${OAUTH_STATE_COOKIE_NAME}=${nonce}; another=2`,
        query: { state: nonce },
      });
      const response = makeResponse();

      expect(consumeOAuthState(request, response)).toBe(true);
    });
  });

  it('a full issue-then-consume round trip succeeds with a matching cookie and state', () => {
    const response = makeResponse();
    const nonce = issueOAuthState(response);

    const callbackRequest = makeRequest({
      cookieHeader: `${OAUTH_STATE_COOKIE_NAME}=${nonce}`,
      query: { state: nonce },
    });

    expect(consumeOAuthState(callbackRequest, makeResponse())).toBe(true);
  });
});
