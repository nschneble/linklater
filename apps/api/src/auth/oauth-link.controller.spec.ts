import { jest } from '@jest/globals';

import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

import { JwtAuthGuard } from './jwt-auth.guard';
import { OAuthLinkController } from './oauth-link.controller';
import { OAuthLinkService } from './oauth-link.service';
import type { AuthRequest } from './auth-request.type';

const USER_ID = 'user-1';
const PROVIDER_ID = 'google-uid-999';
const PROVIDER_EMAIL = 'provider@gmail.com';

const makeRequest = (
  overrides: Partial<{
    userId: string;
    providerId: string;
    providerEmail: string;
  }> = {},
) =>
  ({
    user: {
      userId: USER_ID,
      providerId: PROVIDER_ID,
      providerEmail: PROVIDER_EMAIL,
      ...overrides,
    },
  }) as unknown as AuthRequest;

const makeResponse = () => ({ redirect: jest.fn() }) as unknown as Response;

describe('OAuthLinkController', () => {
  let controller: OAuthLinkController;

  const oauthLinkServiceMock = {
    buildGoogleLinkUrl: jest.fn(),
    linkOAuthAccountToUser: jest.fn(),
    unlinkOAuthProvider: jest.fn(),
  } as unknown as OAuthLinkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthLinkController],
      providers: [
        { provide: OAuthLinkService, useValue: oauthLinkServiceMock },
      ],
    })
      .overrideGuard(AuthGuard('google-link'))
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OAuthLinkController>(OAuthLinkController);
    jest.clearAllMocks();

    process.env.APP_URL = 'https://app.example.com';
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // googleLinkCallback
  // ──────────────────────────────────────────────

  describe('googleLinkCallback', () => {
    it('redirects to /settings?linked=google on success', async () => {
      (
        oauthLinkServiceMock.linkOAuthAccountToUser as jest.Mock
      ).mockResolvedValue(undefined);
      const response = makeResponse();
      const request = makeRequest();

      await controller.googleLinkCallback(request, response);

      expect(oauthLinkServiceMock.linkOAuthAccountToUser).toHaveBeenCalledWith(
        USER_ID,
        'google',
        PROVIDER_ID,
        PROVIDER_EMAIL,
      );
      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/settings?linked=google',
      );
    });

    it('redirects to /settings?link_error=already_linked when ConflictException is thrown', async () => {
      (
        oauthLinkServiceMock.linkOAuthAccountToUser as jest.Mock
      ).mockRejectedValue(
        new ConflictException('Provider already linked to a different user'),
      );
      const response = makeResponse();

      await controller.googleLinkCallback(makeRequest(), response);

      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/settings?link_error=already_linked',
      );
    });

    it('redirects to /settings?link_error=unknown when an unexpected error occurs', async () => {
      const loggerError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      (
        oauthLinkServiceMock.linkOAuthAccountToUser as jest.Mock
      ).mockRejectedValue(new Error('Database connection lost'));
      const response = makeResponse();

      await controller.googleLinkCallback(makeRequest(), response);

      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/settings?link_error=unknown',
      );
      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  // ──────────────────────────────────────────────
  // googleLink - guard is applied
  // ──────────────────────────────────────────────

  describe('googleLink', () => {
    it('is gated by JwtAuthGuard', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        OAuthLinkController.prototype.googleLink,
      );
      expect(guards).toContain(JwtAuthGuard);
    });

    it('delegates to OAuthLinkService.buildGoogleLinkUrl and returns the URL', () => {
      const expectedUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=signed';
      (oauthLinkServiceMock.buildGoogleLinkUrl as jest.Mock).mockReturnValue({
        url: expectedUrl,
      });
      const request = makeRequest();

      const result = controller.googleLink(request);

      expect(oauthLinkServiceMock.buildGoogleLinkUrl).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result).toEqual({ url: expectedUrl });
    });
  });

  // ──────────────────────────────────────────────
  // unlinkProvider - disconnect an OAuth provider
  // ──────────────────────────────────────────────

  describe('unlinkProvider', () => {
    it('is gated by JwtAuthGuard', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        OAuthLinkController.prototype.unlinkProvider,
      );
      expect(guards).toContain(JwtAuthGuard);
    });

    it('delegates to OAuthLinkService.unlinkOAuthProvider and reports success', async () => {
      (oauthLinkServiceMock.unlinkOAuthProvider as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.unlinkProvider(makeRequest(), 'google');

      expect(oauthLinkServiceMock.unlinkOAuthProvider).toHaveBeenCalledWith(
        USER_ID,
        'google',
      );
      expect(result).toEqual({ success: true });
    });

    it('surfaces a BadRequestException from the service as a 400', async () => {
      (oauthLinkServiceMock.unlinkOAuthProvider as jest.Mock).mockRejectedValue(
        new BadRequestException('cannot disconnect'),
      );

      await expect(
        controller.unlinkProvider(makeRequest(), 'google'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
