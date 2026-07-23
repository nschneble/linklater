import { jest } from '@jest/globals';
import passport from 'passport';

import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import {
  createOAuthCallbackGuard,
  createOAuthInitiateGuard,
} from './oauth-csrf.guard';
import { OAUTH_STATE_COOKIE_NAME } from './oauth-state-cookie';

const makeContext = (request: object, response: object) =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }) as unknown as ExecutionContext;

const makeResponse = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });

const DUMMY_STRATEGY_NAME = 'oauth-csrf-guard-spec-dummy';

// A minimal real passport strategy, registered once for this suite, so
// `super.canActivate` has something to delegate to. ts-jest's ESM mode
// doesn't reliably intercept a `jest.mock('@nestjs/passport', ...)` factory
// (the real `passport` module still gets resolved), so exercising a real
// strategy is more robust here than fighting that limitation – and it
// exercises the actual delegation path, not a stand-in for it.
class DummyStrategy {
  name = DUMMY_STRATEGY_NAME;
  authenticate(this: { success: (user: unknown) => void }) {
    this.success({ id: 'dummy-user' });
  }
}
passport.use(DUMMY_STRATEGY_NAME, new DummyStrategy());

describe('oauth-csrf.guard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOAuthCallbackGuard', () => {
    it('throws UnauthorizedException and never reaches the strategy when there is no state cookie', async () => {
      const Guard = createOAuthCallbackGuard(DUMMY_STRATEGY_NAME);
      const guard = new Guard();
      const request = { headers: {}, query: { state: 'x'.repeat(64) } };

      await expect(
        guard.canActivate(makeContext(request, makeResponse())),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the cookie and callback state disagree', async () => {
      const Guard = createOAuthCallbackGuard(DUMMY_STRATEGY_NAME);
      const guard = new Guard();
      const request = {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${'a'.repeat(64)}` },
        query: { state: 'b'.repeat(64) },
      };

      await expect(
        guard.canActivate(makeContext(request, makeResponse())),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('delegates to the strategy when the cookie and callback state match', async () => {
      const nonce = 'c'.repeat(64);
      const Guard = createOAuthCallbackGuard(DUMMY_STRATEGY_NAME);
      const guard = new Guard();
      const request = {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${nonce}` },
        query: { state: nonce },
      };

      // The dummy strategy's `success` resolves canActivate `true` via
      // @nestjs/passport's own (real, unmocked) AuthGuard machinery.
      await expect(
        guard.canActivate(makeContext(request, makeResponse())),
      ).resolves.toBe(true);
    });

    it("reads state from the request body for Apple's form_post callback", async () => {
      const nonce = 'd'.repeat(64);
      const Guard = createOAuthCallbackGuard(DUMMY_STRATEGY_NAME);
      const guard = new Guard();
      const request = {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${nonce}` },
        query: {},
        body: { state: nonce },
      };

      await expect(
        guard.canActivate(makeContext(request, makeResponse())),
      ).resolves.toBe(true);
    });

    it('clears the state cookie on the response even when it rejects', async () => {
      const Guard = createOAuthCallbackGuard(DUMMY_STRATEGY_NAME);
      const guard = new Guard();
      const response = makeResponse();
      const request = { headers: {}, query: {} };

      await expect(
        guard.canActivate(makeContext(request, response)),
      ).rejects.toThrow(UnauthorizedException);
      expect(response.clearCookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        expect.objectContaining({ path: '/auth' }),
      );
    });
  });

  describe('createOAuthInitiateGuard', () => {
    it('issues a state cookie and stashes the same nonce on the request before delegating', async () => {
      const Guard = createOAuthInitiateGuard(DUMMY_STRATEGY_NAME);
      const guard = new Guard();
      const request: { oauthStateNonce?: string } = {};
      const response = makeResponse();

      await guard.canActivate(makeContext(request, response));

      expect(response.cookie).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE_NAME,
        request.oauthStateNonce,
        expect.objectContaining({ httpOnly: true }),
      );
      expect(request.oauthStateNonce).toMatch(/^[0-9a-f]{64}$/);
    });

    it('getAuthenticateOptions returns the nonce stashed on the request by canActivate', async () => {
      const Guard = createOAuthInitiateGuard(DUMMY_STRATEGY_NAME);
      const guard = new Guard();
      const request: { oauthStateNonce?: string } = {};

      await guard.canActivate(makeContext(request, makeResponse()));

      expect(guard.getAuthenticateOptions(makeContext(request, {}))).toEqual({
        state: request.oauthStateNonce,
      });
    });
  });
});
