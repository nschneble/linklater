import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { MagicLinkController } from './magic-link.controller';

// The @Throttle decorator stores metadata directly on the method function
// using keys `'THROTTLER:TTL' + bucketName` and `'THROTTLER:LIMIT' + bucketName`.
const THROTTLER_TTL = 'THROTTLER:TTL';
const THROTTLER_LIMIT = 'THROTTLER:LIMIT';

const USER_EMAIL = 'email@addy.com';
const MAGIC_TOKEN = 'magic-token-abc';

describe('MagicLinkController', () => {
  let controller: MagicLinkController;

  const authServiceMock = {
    registerMagicLink: jest.fn(),
    requestMagicLink: jest.fn(),
    verifyMagicLink: jest.fn(),
  } as unknown as AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MagicLinkController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    })
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MagicLinkController>(MagicLinkController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // requestMagicLink
  // ──────────────────────────────────────────────

  describe('requestMagicLink', () => {
    it('delegates to AuthService.requestMagicLink with the email', async () => {
      (authServiceMock.requestMagicLink as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.requestMagicLink({ email: USER_EMAIL });

      expect(authServiceMock.requestMagicLink).toHaveBeenCalledWith(USER_EMAIL);
    });

    it('uses CustomThrottlerGuard', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        MagicLinkController.prototype.requestMagicLink,
      );
      expect(guards).toContain(CustomThrottlerGuard);
    });

    it('throttle bucket is auth-request-magic-link with 3 requests per 60 s', () => {
      const method = MagicLinkController.prototype.requestMagicLink;
      const ttl = Reflect.getMetadata(
        THROTTLER_TTL + 'auth-request-magic-link',
        method,
      );
      const limit = Reflect.getMetadata(
        THROTTLER_LIMIT + 'auth-request-magic-link',
        method,
      );
      expect(limit).toBe(3);
      expect(ttl).toBe(60000);
    });
  });

  // ──────────────────────────────────────────────
  // registerMagicLink
  // ──────────────────────────────────────────────

  describe('registerMagicLink', () => {
    it('delegates to AuthService.registerMagicLink with the email', async () => {
      (authServiceMock.registerMagicLink as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.registerMagicLink({ email: USER_EMAIL });

      expect(authServiceMock.registerMagicLink).toHaveBeenCalledWith(
        USER_EMAIL,
      );
    });

    it('uses CustomThrottlerGuard', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        MagicLinkController.prototype.registerMagicLink,
      );
      expect(guards).toContain(CustomThrottlerGuard);
    });

    it('throttle bucket is auth-register with 5 requests per 60 s', () => {
      const method = MagicLinkController.prototype.registerMagicLink;
      const ttl = Reflect.getMetadata(THROTTLER_TTL + 'auth-register', method);
      const limit = Reflect.getMetadata(
        THROTTLER_LIMIT + 'auth-register',
        method,
      );
      expect(limit).toBe(5);
      expect(ttl).toBe(60000);
    });
  });

  // ──────────────────────────────────────────────
  // verifyMagicLink
  // ──────────────────────────────────────────────

  describe('verifyMagicLink', () => {
    it('delegates to AuthService.verifyMagicLink and returns the token pair', async () => {
      const tokens = { accessToken: 'at', refreshToken: 'rt' };
      (authServiceMock.verifyMagicLink as jest.Mock).mockResolvedValue(tokens);

      const result = await controller.verifyMagicLink({ token: MAGIC_TOKEN });

      expect(authServiceMock.verifyMagicLink).toHaveBeenCalledWith(MAGIC_TOKEN);
      expect(result).toBe(tokens);
    });

    it('uses CustomThrottlerGuard', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        MagicLinkController.prototype.verifyMagicLink,
      );
      expect(guards).toContain(CustomThrottlerGuard);
    });

    it('throttle bucket is auth-verify-magic-link with 10 requests per 60 s', () => {
      const method = MagicLinkController.prototype.verifyMagicLink;
      const ttl = Reflect.getMetadata(
        THROTTLER_TTL + 'auth-verify-magic-link',
        method,
      );
      const limit = Reflect.getMetadata(
        THROTTLER_LIMIT + 'auth-verify-magic-link',
        method,
      );
      expect(limit).toBe(10);
      expect(ttl).toBe(60000);
    });

    it('propagates errors thrown by AuthService.verifyMagicLink', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      (authServiceMock.verifyMagicLink as jest.Mock).mockRejectedValue(
        new BadRequestException('Token is invalid or expired'),
      );

      await expect(
        controller.verifyMagicLink({ token: 'bad-token' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
