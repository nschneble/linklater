/*
 * The decline route driven over HTTP, because the two things that matter
 * about it are both properties of the response rather than of a return
 * value: that it answers with a redirect at all, and that it answers one
 * to a caller carrying no session.
 *
 * The controller spec cannot see either. It calls the handler directly,
 * where `@Redirect` is metadata nobody has read yet, and its guards are
 * stubbed permissive, so a guard appearing on this route would not show
 * up there as anything.
 */

import { jest } from '@jest/globals';

import request from 'supertest';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

import { CustomThrottlerGuard } from './custom-throttler.guard';
import { ExtensionAuthController } from './extension-auth.controller';
import { ExtensionAuthService } from './extension-auth.service';

const ALLOWED_URI = 'chrome-extension://abc/callback';
const APP_URL = 'https://app.example.com';

describe('GET /auth/extension/deny', () => {
  let app: INestApplication;

  const extensionAuthServiceMock = {
    denialRedirect: jest.fn(),
  } as unknown as ExtensionAuthService;

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({
      controllers: [ExtensionAuthController],
      providers: [
        { provide: ExtensionAuthService, useValue: extensionAuthServiceMock },
      ],
    })
      // the sibling token route's throttler needs a module absent here
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleReference.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects a caller with no Authorization header at all', async () => {
    (extensionAuthServiceMock.denialRedirect as jest.Mock).mockReturnValue(
      `${ALLOWED_URI}?error=access_denied`,
    );

    const response = await request(app.getHttpServer())
      .get('/auth/extension/deny')
      .query({ redirect_uri: ALLOWED_URI });

    // the session this exits may already be the thing that went away
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      `${ALLOWED_URI}?error=access_denied`,
    );
  });

  it('hands the parameter through under its wire name', async () => {
    (extensionAuthServiceMock.denialRedirect as jest.Mock).mockReturnValue(
      `${APP_URL}/unread`,
    );

    await request(app.getHttpServer())
      .get('/auth/extension/deny')
      .query({ redirect_uri: ALLOWED_URI });

    expect(extensionAuthServiceMock.denialRedirect).toHaveBeenCalledWith(
      ALLOWED_URI,
    );
  });

  it('reads a missing parameter as the empty string rather than throwing', async () => {
    (extensionAuthServiceMock.denialRedirect as jest.Mock).mockReturnValue(
      `${APP_URL}/unread`,
    );

    const response = await request(app.getHttpServer()).get(
      '/auth/extension/deny',
    );

    expect(response.status).toBe(302);
    expect(extensionAuthServiceMock.denialRedirect).toHaveBeenCalledWith('');
  });

  it('sets no cookie, since declining establishes nothing', async () => {
    (extensionAuthServiceMock.denialRedirect as jest.Mock).mockReturnValue(
      `${APP_URL}/unread`,
    );

    const response = await request(app.getHttpServer())
      .get('/auth/extension/deny')
      .query({ redirect_uri: 'https://evil.example.com' });

    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
