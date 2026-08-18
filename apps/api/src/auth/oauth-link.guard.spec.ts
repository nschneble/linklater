/**
 * Tests for the account-linking callback guard.
 *
 * They drive the guard over HTTP because the browser reaches the callback as
 * a top-level navigation: what matters is the status and headers it gets
 * back, not which exception the guard picked on the way there. Calling the
 * route handler directly, as the controller spec does, cannot see any of
 * this, since every refusal happens before the handler runs.
 *
 * The provider-side outcomes ride on the real Google link strategy so the
 * split between a declined consent screen and any other provider error is
 * the one passport actually makes, rather than one a stub asserts.
 */

import passport from 'passport';
import request from 'supertest';

import {
  BadRequestException,
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

// set env before the strategy import; its constructor reads it eagerly
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.API_URL = 'http://localhost';
process.env.JWT_SECRET = 'test-jwt-secret-for-link-guard';

import { createOAuthLinkCallbackGuard } from './oauth-link.guard';
import { GoogleLinkStrategy } from './google-link.strategy';

const APP_URL = 'https://app.example.com';

const GOOGLE_LINK_STRATEGY_NAME = 'google-link';
const LINKING_STRATEGY_NAME = 'oauth-link-guard-spec-linking';
const STATE_INVALID_STRATEGY_NAME = 'oauth-link-guard-spec-state-invalid';

// real passport strategies: ts-jest ESM can't mock @nestjs/passport
class LinkingStrategy {
  name = LINKING_STRATEGY_NAME;
  authenticate(this: { success: (user: unknown) => void }) {
    this.success({
      userId: 'user-1',
      providerId: 'google-uid-999',
      providerEmail: 'provider@gmail.com',
    });
  }
}
passport.use(LINKING_STRATEGY_NAME, new LinkingStrategy());

// stands in for a link state that expired, was tampered with, or replayed
class StateInvalidStrategy {
  name = STATE_INVALID_STRATEGY_NAME;
  authenticate(this: { error: (error: Error) => void }) {
    this.error(new BadRequestException('Invalid or expired link state'));
  }
}
passport.use(STATE_INVALID_STRATEGY_NAME, new StateInvalidStrategy());

// constructing the strategy is what registers it with passport
new GoogleLinkStrategy();

describe('createOAuthLinkCallbackGuard', () => {
  let app: INestApplication;
  let handlerReached: boolean;

  @Controller('spec')
  class SpecLinkController {
    @UseGuards(createOAuthLinkCallbackGuard(GOOGLE_LINK_STRATEGY_NAME))
    @Get('provider')
    provider(): string {
      handlerReached = true;
      return 'linked';
    }

    @UseGuards(createOAuthLinkCallbackGuard(STATE_INVALID_STRATEGY_NAME))
    @Get('state')
    state(): string {
      handlerReached = true;
      return 'linked';
    }

    @UseGuards(createOAuthLinkCallbackGuard(LINKING_STRATEGY_NAME))
    @Get('linked')
    linked(): string {
      handlerReached = true;
      return 'linked';
    }
  }

  beforeAll(async () => {
    process.env.APP_URL = APP_URL;
    const moduleReference = await Test.createTestingModule({
      controllers: [SpecLinkController],
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

  it('sends the user back to settings when they decline at the provider', async () => {
    const response = await request(app.getHttpServer())
      .get('/spec/provider')
      .query({ error: 'access_denied', error_description: 'user denied' });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      `${APP_URL}/settings?link_error=cancelled`,
    );
    expect(response.body).toEqual({});
    expect(response.text).not.toContain('statusCode');
    expect(handlerReached).toBe(false);
  });

  it('sends the user back to settings when the provider reports its own failure', async () => {
    const response = await request(app.getHttpServer())
      .get('/spec/provider')
      .query({ error: 'server_error', error_description: 'provider down' });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      `${APP_URL}/settings?link_error=provider_error`,
    );
    expect(response.body).toEqual({});
    expect(response.text).not.toContain('statusCode');
    expect(handlerReached).toBe(false);
  });

  it('sends the user back to settings when the link state is expired or replayed', async () => {
    const response = await request(app.getHttpServer()).get('/spec/state');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      `${APP_URL}/settings?link_error=state_invalid`,
    );
    expect(response.body).toEqual({});
    expect(response.text).not.toContain('statusCode');
    expect(handlerReached).toBe(false);
  });

  it('runs the route handler untouched when the provider vouches for the user', async () => {
    const response = await request(app.getHttpServer()).get('/spec/linked');

    expect(response.status).toBe(200);
    expect(response.text).toBe('linked');
    expect(response.headers.location).toBeUndefined();
    expect(handlerReached).toBe(true);
  });
});
