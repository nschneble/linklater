import { jest } from '@jest/globals';

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ExtensionAuthService } from './extension-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';

const ACCESS_TOKEN = 'access-token';
const REFRESH_TOKEN = 'refresh-token';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

describe('ExtensionAuthService', () => {
  let service: ExtensionAuthService;

  const refreshTokenServiceMock = {
    issueTokenPair: jest.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    }),
  } as unknown as RefreshTokenService;

  const prismaServiceMock = {
    extensionAuthCode: {
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  async function buildService(): Promise<ExtensionAuthService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtensionAuthService,
        { provide: RefreshTokenService, useValue: refreshTokenServiceMock },
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();
    const built = module.get<ExtensionAuthService>(ExtensionAuthService);
    built.onModuleInit();
    return built;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildService();
  });

  describe('denialRedirect', () => {
    const CHROME_URI = 'chrome-extension://abc/callback';
    const FIREFOX_URI = 'moz-extension://def/callback';
    const WEB_FLOW_URI = 'https://abcdef.chromiumapp.org/';
    const WITH_QUERY = 'chrome-extension://abc/callback?flow=save';
    const APP_URL = 'https://app.example.com';

    beforeEach(async () => {
      process.env.APP_URL = APP_URL;
      process.env.EXTENSION_REDIRECT_URIS = [
        CHROME_URI,
        FIREFOX_URI,
        WEB_FLOW_URI,
        WITH_QUERY,
      ].join(',');
      service = await buildService();
    });

    afterEach(() => {
      delete process.env.EXTENSION_REDIRECT_URIS;
      delete process.env.APP_URL;
    });

    it('appends the RFC 6749 denial code to an allowed chrome callback', () => {
      expect(service.denialRedirect(CHROME_URI)).toBe(
        `${CHROME_URI}?error=access_denied`,
      );
    });

    it('appends it to an allowed Firefox callback', () => {
      expect(service.denialRedirect(FIREFOX_URI)).toBe(
        `${FIREFOX_URI}?error=access_denied`,
      );
    });

    it('appends it to the host chrome.identity mints for a web auth flow', () => {
      expect(service.denialRedirect(WEB_FLOW_URI)).toBe(
        `${WEB_FLOW_URI}?error=access_denied`,
      );
    });

    it('keeps query parameters the extension already put there', () => {
      expect(service.denialRedirect(WITH_QUERY)).toBe(
        `${WITH_QUERY}&error=access_denied`,
      );
    });

    it('sends an https callback nobody registered back into the app', () => {
      expect(service.denialRedirect('https://evil.example.com/steal')).toBe(
        `${APP_URL}/unread`,
      );
    });

    it('sends an extension scheme nobody registered back into the app', () => {
      expect(service.denialRedirect('chrome-extension://zzz/callback')).toBe(
        `${APP_URL}/unread`,
      );
    });

    it('matches the allowlist exactly, so a longer path is a different URI', () => {
      expect(service.denialRedirect(`${CHROME_URI}/deeper`)).toBe(
        `${APP_URL}/unread`,
      );
    });

    it('refuses a javascript URL, which parses but has no host', () => {
      expect(service.denialRedirect('javascript:alert(1)')).toBe(
        `${APP_URL}/unread`,
      );
    });

    it('refuses a value that is not a URL at all', () => {
      expect(service.denialRedirect('not a url')).toBe(`${APP_URL}/unread`);
    });

    it('refuses an empty value, which is what a missing parameter reads as', () => {
      expect(service.denialRedirect('')).toBe(`${APP_URL}/unread`);
    });

    it('refuses everything when no allowlist is configured', async () => {
      delete process.env.EXTENSION_REDIRECT_URIS;
      service = await buildService();

      expect(service.denialRedirect(CHROME_URI)).toBe(`${APP_URL}/unread`);
    });

    it('touches no storage, since a declined grant records nothing', () => {
      service.denialRedirect(CHROME_URI);
      service.denialRedirect('https://evil.example.com/steal');

      expect(prismaServiceMock.extensionAuthCode.create).not.toHaveBeenCalled();
    });
  });

  describe('authorizeExtension', () => {
    const ALLOWED_URI = 'chrome-extension://abc/callback';

    beforeEach(async () => {
      process.env.EXTENSION_REDIRECT_URIS = ALLOWED_URI;
      service = await buildService();
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
      const freshService = await buildService();

      await expect(
        freshService.authorizeExtension(
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
