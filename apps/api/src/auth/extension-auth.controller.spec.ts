/*
 * Handler-level tests. Both guards are stubbed permissive here, so nothing
 * in this file is evidence that either one refuses anything: the metadata
 * assertion below says a guard is named on the route, not that a request
 * has to satisfy it. `extension-auth.guard.spec.ts` is where the authorize
 * route is driven over HTTP with the real guard, and it is the file that
 * would have caught the grant refusing every user.
 */

import { jest } from '@jest/globals';

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CustomThrottlerGuard } from './custom-throttler.guard';
import { ExtensionAuthController } from './extension-auth.controller';
import { ExtensionAuthService } from './extension-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthRequest } from './auth-request.type';

// @Throttle stores method metadata under THROTTLER:TTL and THROTTLER:LIMIT
const THROTTLER_TTL = 'THROTTLER:TTL';
const THROTTLER_LIMIT = 'THROTTLER:LIMIT';

const ACCESS_TOKEN = 'access-token-abc';
const REFRESH_TOKEN = 'refresh-token-xyz';
const USER_ID = 'user-1';
const CODE = 'auth-code-123';
const CODE_CHALLENGE = 'sha256-challenge-abc';
const CODE_VERIFIER = 'verifier-xyz';
const REDIRECT_URI = 'chrome-extension://abc/callback';

const makeRequest = () =>
  ({ user: { userId: USER_ID } }) as unknown as AuthRequest;

describe('ExtensionAuthController', () => {
  let controller: ExtensionAuthController;

  const extensionAuthServiceMock = {
    authorizeExtension: jest.fn(),
    exchangeExtensionCode: jest.fn(),
  } as unknown as ExtensionAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExtensionAuthController],
      providers: [
        {
          provide: ExtensionAuthService,
          useValue: extensionAuthServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExtensionAuthController>(ExtensionAuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // extensionAuthorize
  // ──────────────────────────────────────────────

  describe('extensionAuthorize', () => {
    it('is gated by JwtAuthGuard', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        ExtensionAuthController.prototype.extensionAuthorize,
      );
      expect(guards).toContain(JwtAuthGuard);
    });

    it('returns the callback URL with the code as a query parameter', async () => {
      (
        extensionAuthServiceMock.authorizeExtension as jest.Mock
      ).mockResolvedValue({
        code: CODE,
        callbackUrl: REDIRECT_URI,
      });

      const result = await controller.extensionAuthorize(makeRequest(), {
        codeChallenge: CODE_CHALLENGE,
        redirectUri: REDIRECT_URI,
      });

      const destination = new URL(REDIRECT_URI);
      destination.searchParams.set('code', CODE);
      expect(result).toEqual({ redirectUrl: destination.toString() });
    });

    it('propagates BadRequestException when redirect URI is not allowed', async () => {
      (
        extensionAuthServiceMock.authorizeExtension as jest.Mock
      ).mockRejectedValue(new BadRequestException('Invalid redirect_uri'));

      await expect(
        controller.extensionAuthorize(makeRequest(), {
          codeChallenge: CODE_CHALLENGE,
          redirectUri: 'https://evil.example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates BadRequestException when code_challenge is missing', async () => {
      (
        extensionAuthServiceMock.authorizeExtension as jest.Mock
      ).mockRejectedValue(
        new BadRequestException('code_challenge and redirect_uri are required'),
      );

      await expect(
        controller.extensionAuthorize(makeRequest(), {
          codeChallenge: '',
          redirectUri: REDIRECT_URI,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────
  // extensionToken
  // ──────────────────────────────────────────────

  describe('extensionToken', () => {
    it('delegates to ExtensionAuthService.exchangeExtensionCode and returns the token pair', async () => {
      const tokens = { accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN };
      (
        extensionAuthServiceMock.exchangeExtensionCode as jest.Mock
      ).mockResolvedValue(tokens);

      const result = await controller.extensionToken({
        code: CODE,
        codeVerifier: CODE_VERIFIER,
      });

      expect(
        extensionAuthServiceMock.exchangeExtensionCode,
      ).toHaveBeenCalledWith(CODE, CODE_VERIFIER);
      expect(result).toBe(tokens);
    });

    it('uses CustomThrottlerGuard', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        ExtensionAuthController.prototype.extensionToken,
      );
      expect(guards).toContain(CustomThrottlerGuard);
    });

    it('overrides the default bucket with 20 requests per 60 s', () => {
      const method = ExtensionAuthController.prototype.extensionToken;
      const ttl = Reflect.getMetadata(THROTTLER_TTL + 'default', method);
      const limit = Reflect.getMetadata(THROTTLER_LIMIT + 'default', method);
      expect(limit).toBe(20);
      expect(ttl).toBe(60000);
    });
  });
});
