import { jest } from '@jest/globals';

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { ExtensionAuthService } from './extension-auth.service';
import { PrismaService } from '../prisma/prisma.service';

const SIGNED_TOKEN = 'signed-token';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

describe('ExtensionAuthService', () => {
  let service: ExtensionAuthService;

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue(SIGNED_TOKEN),
  } as unknown as JwtService;

  const prismaServiceMock = {
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
    },
    extensionAuthCode: {
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtensionAuthService,
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();
    service = module.get<ExtensionAuthService>(ExtensionAuthService);
    jest.clearAllMocks();
  });

  describe('authorizeExtension', () => {
    const ALLOWED_URI = 'chrome-extension://abc/callback';

    beforeEach(() => {
      process.env.EXTENSION_REDIRECT_URIS = ALLOWED_URI;
    });

    afterEach(() => {
      delete process.env.EXTENSION_REDIRECT_URIS;
    });

    it('returns a code and callbackUrl when challenge and redirect URI are valid', async () => {
      const result = await service.authorizeExtension(
        USER_ID,
        'sha256-challenge-abc',
        ALLOWED_URI,
      );

      expect(typeof result.code).toBe('string');
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.callbackUrl).toBe(ALLOWED_URI);
      expect(prismaServiceMock.extensionAuthCode.create).toHaveBeenCalled();
    });

    it('throws BadRequestException when codeChallenge is empty', async () => {
      await expect(
        service.authorizeExtension(USER_ID, '', ALLOWED_URI),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when redirectUri is empty', async () => {
      await expect(
        service.authorizeExtension(USER_ID, 'sha256-challenge-abc', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when redirectUri is not in the allowed list', async () => {
      await expect(
        service.authorizeExtension(
          USER_ID,
          'sha256-challenge-abc',
          'https://evil.example.com/callback',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when EXTENSION_REDIRECT_URIS is not set', async () => {
      delete process.env.EXTENSION_REDIRECT_URIS;

      await expect(
        service.authorizeExtension(
          USER_ID,
          'sha256-challenge-abc',
          ALLOWED_URI,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createExtensionAuthCode', () => {
    it('stores a hashed code and returns the raw code', async () => {
      const rawCode = await service.createExtensionAuthCode(
        USER_ID,
        'abc_challenge',
      );

      expect(typeof rawCode).toBe('string');
      expect(rawCode.length).toBeGreaterThan(0);
      expect(prismaServiceMock.extensionAuthCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            codeChallenge: 'abc_challenge',
          }),
        }),
      );
    });
  });

  describe('exchangeExtensionCode', () => {
    it('issues a token pair when code and PKCE verifier are valid', async () => {
      const rawCode = 'a'.repeat(64);
      const codeVerifier = 'valid-verifier';

      const { createHash } = await import('node:crypto');
      const codeChallenge = createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      (
        prismaServiceMock.extensionAuthCode.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'eac-1',
        userId: USER_ID,
        codeChallenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        user: { id: USER_ID, email: USER_EMAIL },
      });

      const result = await service.exchangeExtensionCode(rawCode, codeVerifier);

      expect(prismaServiceMock.extensionAuthCode.delete).toHaveBeenCalledWith({
        where: { id: 'eac-1' },
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws UnauthorizedException when the code is not found', async () => {
      (
        prismaServiceMock.extensionAuthCode.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.exchangeExtensionCode('bad-code', 'verifier'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the code is expired', async () => {
      (
        prismaServiceMock.extensionAuthCode.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'eac-1',
        userId: USER_ID,
        codeChallenge: 'challenge',
        expiresAt: new Date(Date.now() - 1000),
        user: { id: USER_ID, email: USER_EMAIL },
      });

      await expect(
        service.exchangeExtensionCode('any-code', 'any-verifier'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the PKCE verifier does not match', async () => {
      const { createHash } = await import('node:crypto');
      const realChallenge = createHash('sha256')
        .update('correct-verifier')
        .digest('base64url');

      (
        prismaServiceMock.extensionAuthCode.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'eac-1',
        userId: USER_ID,
        codeChallenge: realChallenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        user: { id: USER_ID, email: USER_EMAIL },
      });

      await expect(
        service.exchangeExtensionCode('any-code', 'wrong-verifier'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
