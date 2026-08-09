import { jest } from '@jest/globals';
import passport from 'passport';
import request from 'supertest';

import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';

import {
  createOAuthCallbackGuard,
  createOAuthInitiateGuard,
} from './oauth-csrf.guard';
import { OAUTH_STATE_COOKIE_NAME } from './oauth-state-cookie';
import { ProviderEmailUnverifiedException } from './oauth-sign-in-failure';

const makeContext = (request: object, response: object) =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }) as unknown as ExecutionContext;

const makeResponse = () => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
  redirect: jest.fn(),
});

const APP_URL = 'https://app.example.com';

const DUMMY_STRATEGY_NAME = 'oauth-csrf-guard-spec-dummy';
const REFUSING_STRATEGY_NAME = 'oauth-csrf-guard-spec-refusing';
const FAILING_STRATEGY_NAME = 'oauth-csrf-guard-spec-failing';

// real passport strategies: ts-jest ESM can't mock @nestjs/passport
class DummyStrategy {
  name = DUMMY_STRATEGY_NAME;
  authenticate(this: { success: (user: unknown) => void }) {
    this.success({ id: 'dummy-user' });
  }
}
passport.use(DUMMY_STRATEGY_NAME, new DummyStrategy());

// stands in for OAuthSignInService refusing an unverified provider email
class RefusingStrategy {
  name = REFUSING_STRATEGY_NAME;
  authenticate(this: { error: (error: Error) => void }) {
    this.error(new ProviderEmailUnverifiedException());
  }
}
passport.use(REFUSING_STRATEGY_NAME, new RefusingStrategy());

// stands in for any other callback failure: no user, no explicit error
class FailingStrategy {
  name = FAILING_STRATEGY_NAME;
  authenticate(this: { fail: (challenge: string) => void }) {
    this.fail('no user');
  }
}
passport.use(FAILING_STRATEGY_NAME, new FailingStrategy());

describe('oauth-csrf.guard', () => {
  beforeEach(() => {
    process.env.APP_URL = APP_URL;
  });

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

      // dummy strategy's success resolves canActivate via real AuthGuard
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

    // the callback is a top-level navigation, so a bare 401 strands
    // the browser on the API origin with no way back into the app
    it('redirects to the login page when the state cookie is missing', async () => {
      // no strategy lookup: the state check rejects before passport
      const Guard = createOAuthCallbackGuard('google');
      const guard = new Guard();
      const response = makeResponse();
      const request = { headers: {}, query: {} };

      await expect(
        guard.canActivate(makeContext(request, response)),
      ).rejects.toThrow(UnauthorizedException);

      expect(response.redirect).toHaveBeenCalledWith(
        `${APP_URL}/login?error=oauth_state_invalid&provider=google`,
      );
    });

    it('redirects to the login page when the provider will not vouch for the email', async () => {
      const nonce = 'e'.repeat(64);
      const Guard = createOAuthCallbackGuard(REFUSING_STRATEGY_NAME);
      const guard = new Guard();
      const response = makeResponse();
      const request = {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${nonce}` },
        query: { state: nonce },
      };

      // rejecting is what keeps the handler from running on the 302
      await expect(
        guard.canActivate(makeContext(request, response)),
      ).rejects.toThrow(ProviderEmailUnverifiedException);

      expect(response.redirect).toHaveBeenCalledWith(
        `${APP_URL}/login?error=provider_email_unverified&provider=${REFUSING_STRATEGY_NAME}`,
      );
    });

    it('redirects to the login page with a generic code when the strategy returns no user', async () => {
      const nonce = 'f'.repeat(64);
      const Guard = createOAuthCallbackGuard(FAILING_STRATEGY_NAME);
      const guard = new Guard();
      const response = makeResponse();
      const request = {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${nonce}` },
        query: { state: nonce },
      };

      await expect(
        guard.canActivate(makeContext(request, response)),
      ).rejects.toThrow(UnauthorizedException);

      expect(response.redirect).toHaveBeenCalledWith(
        `${APP_URL}/login?error=oauth_failed&provider=${FAILING_STRATEGY_NAME}`,
      );
    });

    it('does not redirect when the strategy authenticates the user', async () => {
      const nonce = 'g'.repeat(64);
      const Guard = createOAuthCallbackGuard(DUMMY_STRATEGY_NAME);
      const guard = new Guard();
      const response = makeResponse();
      const request = {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${nonce}` },
        query: { state: nonce },
      };

      await expect(
        guard.canActivate(makeContext(request, response)),
      ).resolves.toBe(true);

      expect(response.redirect).not.toHaveBeenCalled();
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

  // the unit tests above see the guard's own calls; this one sees what the
  // browser gets, which is the whole point: a 302 has to survive the
  // rejection that stops the route handler
  describe('createOAuthCallbackGuard over HTTP', () => {
    let app: INestApplication;
    let handlerReached: boolean;

    @Controller('spec')
    class SpecCallbackController {
      @UseGuards(createOAuthCallbackGuard(REFUSING_STRATEGY_NAME))
      @Get('callback')
      callback(): string {
        handlerReached = true;
        return 'signed in';
      }
    }

    beforeAll(async () => {
      process.env.APP_URL = APP_URL;
      const moduleReference = await Test.createTestingModule({
        controllers: [SpecCallbackController],
      }).compile();
      app = moduleReference.createNestApplication();
      await app.init();
    });

    beforeEach(() => {
      handlerReached = false;
    });

    afterAll(async () => {
      await app.close();
    });

    it('sends a redirect, not a JSON error body, when the provider is refused', async () => {
      const nonce = 'h'.repeat(64);

      const response = await request(app.getHttpServer())
        .get('/spec/callback')
        .set('Cookie', `${OAUTH_STATE_COOKIE_NAME}=${nonce}`)
        .query({ state: nonce });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        `${APP_URL}/login?error=provider_email_unverified&provider=${REFUSING_STRATEGY_NAME}`,
      );
      expect(response.body).toEqual({});
      expect(response.text).not.toContain('statusCode');
      expect(handlerReached).toBe(false);
    });

    it('sends a redirect when the state cookie is missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/spec/callback')
        .query({ state: 'i'.repeat(64) });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        `${APP_URL}/login?error=oauth_state_invalid&provider=${REFUSING_STRATEGY_NAME}`,
      );
      expect(response.body).toEqual({});
      expect(handlerReached).toBe(false);
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
