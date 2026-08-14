/**
 * Drives the extension authorize route over HTTP with the real guard and
 * the real JWT strategy in place.
 *
 * The controller spec cannot see any of this. It overrides `JwtAuthGuard`
 * with a permissive stub, so every refusal is stubbed away before the
 * handler runs, and its guard assertion reads the decorator metadata,
 * which stays true of a route no request can pass. That is the shape that
 * hid a grant endpoint 401ing for every user: the decorator was there, the
 * suite was green, and nothing ever presented a request to it.
 *
 * A bearer header is what the strategy extracts from
 * (`ExtractJwt.fromAuthHeaderAsBearerToken`), so the accepted case here is
 * also the evidence that the caller has to be able to set one.
 *
 * `JwtAuthGuard` is the one thing left real. The throttler on the sibling
 * token route is overridden only because Nest instantiates every guard on
 * the controller and that one needs a module this test does not import.
 *
 * The body-validation arms live here for the same reason the guard ones
 * do. A handler called directly is handed whatever the test writes, so the
 * DTO's own rules only bind a request that goes through the pipe, and the
 * refusals arrive with a bearer because a guard runs ahead of a pipe.
 */

import { jest } from '@jest/globals';

import request from 'supertest';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

// the strategy reads JWT_SECRET when Nest instantiates it, below
process.env.JWT_SECRET = 'test-secret-for-extension-guard';

import { CustomThrottlerGuard } from './custom-throttler.guard';
import { ExtensionAuthController } from './extension-auth.controller';
import { ExtensionAuthService } from './extension-auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

const CODE = 'auth-code-123';
const CODE_CHALLENGE = 'sha256-challenge-abc';
const REDIRECT_URI = 'chrome-extension://abc/callback';
const USER_EMAIL = 'alice@example.com';
const USER_ID = 'user-1';

function signToken(payload: Record<string, unknown>, secret: string): string {
  return new JwtService({ secret }).sign(payload);
}

/** A bearer the strategy accepts, so a refusal below is the pipe's. */
function acceptedToken(): string {
  return signToken(
    { subject: USER_ID, email: USER_EMAIL, tokenVersion: 0 },
    process.env.JWT_SECRET as string,
  );
}

describe('POST /auth/extension/authorize (guarded)', () => {
  let app: INestApplication;

  const extensionAuthServiceMock = {
    authorizeExtension: jest.fn(),
  } as unknown as ExtensionAuthService;

  const prismaServiceMock = {
    user: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({
      controllers: [ExtensionAuthController],
      providers: [
        JwtStrategy,
        { provide: ExtensionAuthService, useValue: extensionAuthServiceMock },
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    })
      // the sibling token route's throttler needs a module absent here
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleReference.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prismaServiceMock.user.findUnique as jest.Mock).mockResolvedValue({
      tokenVersion: 0,
    });
    (
      extensionAuthServiceMock.authorizeExtension as jest.Mock
    ).mockResolvedValue({ code: CODE, callbackUrl: REDIRECT_URI });
  });

  it('refuses a request carrying no Authorization header', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/extension/authorize')
      .send({ codeChallenge: CODE_CHALLENGE, redirectUri: REDIRECT_URI });

    expect(response.status).toBe(401);
    expect(extensionAuthServiceMock.authorizeExtension).not.toHaveBeenCalled();
  });

  it('refuses a bearer token signed with another secret', async () => {
    const forged = signToken(
      { subject: USER_ID, email: USER_EMAIL },
      'not-the-server-secret',
    );

    const response = await request(app.getHttpServer())
      .post('/auth/extension/authorize')
      .set('Authorization', `Bearer ${forged}`)
      .send({ codeChallenge: CODE_CHALLENGE, redirectUri: REDIRECT_URI });

    expect(response.status).toBe(401);
    expect(extensionAuthServiceMock.authorizeExtension).not.toHaveBeenCalled();
  });

  it('refuses an MFA challenge token, which is not a full session', async () => {
    const mfaToken = signToken(
      { subject: USER_ID, email: USER_EMAIL, mfaPending: true },
      process.env.JWT_SECRET as string,
    );

    const response = await request(app.getHttpServer())
      .post('/auth/extension/authorize')
      .set('Authorization', `Bearer ${mfaToken}`)
      .send({ codeChallenge: CODE_CHALLENGE, redirectUri: REDIRECT_URI });

    expect(response.status).toBe(401);
    expect(extensionAuthServiceMock.authorizeExtension).not.toHaveBeenCalled();
  });

  it('mints a code for a bearer token the strategy accepts', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/extension/authorize')
      .set('Authorization', `Bearer ${acceptedToken()}`)
      .send({ codeChallenge: CODE_CHALLENGE, redirectUri: REDIRECT_URI });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      redirectUrl: `${REDIRECT_URI}?code=${CODE}`,
    });
    expect(extensionAuthServiceMock.authorizeExtension).toHaveBeenCalledWith(
      USER_ID,
      CODE_CHALLENGE,
      REDIRECT_URI,
    );
  });

  it('refuses a body carrying neither field', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/extension/authorize')
      .set('Authorization', `Bearer ${acceptedToken()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(extensionAuthServiceMock.authorizeExtension).not.toHaveBeenCalled();
  });

  // an empty string is the case a required-field check alone lets past
  it.each([
    ['codeChallenge', { codeChallenge: '', redirectUri: REDIRECT_URI }],
    ['redirectUri', { codeChallenge: CODE_CHALLENGE, redirectUri: '' }],
  ])(
    'refuses an empty %s rather than handing it to the service',
    async (_field, body) => {
      const response = await request(app.getHttpServer())
        .post('/auth/extension/authorize')
        .set('Authorization', `Bearer ${acceptedToken()}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(
        extensionAuthServiceMock.authorizeExtension,
      ).not.toHaveBeenCalled();
    },
  );
});
