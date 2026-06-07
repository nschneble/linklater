import { jest } from '@jest/globals';

import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OAuthAccountService } from './oauth-account.service';
import { OAuthController } from './oauth.controller';
import type { AuthRequest } from './auth-request.type';

const ACCESS_TOKEN = 'access-token-abc';
const REFRESH_TOKEN = 'refresh-token-xyz';
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

describe('OAuthController', () => {
  let controller: OAuthController;

  const authServiceMock = {
    login: jest.fn(),
  } as unknown as AuthService;

  const oauthAccountServiceMock = {
    buildGoogleLinkUrl: jest.fn(),
    linkOAuthAccountToUser: jest.fn(),
    unlinkOAuthProvider: jest.fn(),
  } as unknown as OAuthAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: OAuthAccountService, useValue: oauthAccountServiceMock },
      ],
    })
      .overrideGuard(AuthGuard('google'))
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard('google-link'))
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard('apple'))
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OAuthController>(OAuthController);
    jest.clearAllMocks();

    process.env.APP_URL = 'https://app.example.com';
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // googleCallback / completeOAuthLogin — normal path
  // ──────────────────────────────────────────────

  describe('googleCallback', () => {
    it('redirects to /oauth/callback with token fragment on successful login', async () => {
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
      const response = makeResponse();

      await controller.googleCallback(makeRequest(), response);

      expect(authServiceMock.login).toHaveBeenCalledWith(USER_ID);
      expect(response.redirect).toHaveBeenCalledWith(
        `https://app.example.com/oauth/callback#token=${ACCESS_TOKEN}&refresh=${REFRESH_TOKEN}`,
      );
    });

    it('redirects to /login?error=mfa_required when MFA is required', async () => {
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        mfaToken: 'mfa-tok',
        mfaMethod: 'totp',
      });
      const response = makeResponse();

      await controller.googleCallback(makeRequest(), response);

      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/login?error=mfa_required',
      );
    });
  });

  // ──────────────────────────────────────────────
  // appleCallback — delegates to same completeOAuthLogin
  // ──────────────────────────────────────────────

  describe('appleCallback', () => {
    it('redirects to /oauth/callback with token fragment on successful login', async () => {
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
      const response = makeResponse();

      await controller.appleCallback(makeRequest(), response);

      expect(response.redirect).toHaveBeenCalledWith(
        `https://app.example.com/oauth/callback#token=${ACCESS_TOKEN}&refresh=${REFRESH_TOKEN}`,
      );
    });

    it('redirects to /login?error=mfa_required when login returns an MFA challenge', async () => {
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        mfaToken: 'mfa-tok',
        mfaMethod: 'totp',
      });
      const response = makeResponse();

      await controller.appleCallback(makeRequest(), response);

      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/login?error=mfa_required',
      );
    });
  });

  // ──────────────────────────────────────────────
  // googleLinkCallback
  // ──────────────────────────────────────────────

  describe('googleLinkCallback', () => {
    it('redirects to /settings?linked=google on success', async () => {
      (
        oauthAccountServiceMock.linkOAuthAccountToUser as jest.Mock
      ).mockResolvedValue(undefined);
      const response = makeResponse();
      const request = makeRequest();

      await controller.googleLinkCallback(request, response);

      expect(
        oauthAccountServiceMock.linkOAuthAccountToUser,
      ).toHaveBeenCalledWith(USER_ID, 'google', PROVIDER_ID, PROVIDER_EMAIL);
      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/settings?linked=google',
      );
    });

    it('redirects to /settings?link_error=already_linked when ConflictException is thrown', async () => {
      (
        oauthAccountServiceMock.linkOAuthAccountToUser as jest.Mock
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
      (
        oauthAccountServiceMock.linkOAuthAccountToUser as jest.Mock
      ).mockRejectedValue(new Error('Database connection lost'));
      const response = makeResponse();

      await controller.googleLinkCallback(makeRequest(), response);

      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/settings?link_error=unknown',
      );
    });
  });

  // ──────────────────────────────────────────────
  // unlinkProvider
  // ──────────────────────────────────────────────

  describe('unlinkProvider', () => {
    it('delegates to OAuthAccountService.unlinkOAuthProvider and returns success', async () => {
      (
        oauthAccountServiceMock.unlinkOAuthProvider as jest.Mock
      ).mockResolvedValue(undefined);
      const request = makeRequest();

      const result = await controller.unlinkProvider(request, 'google');

      expect(oauthAccountServiceMock.unlinkOAuthProvider).toHaveBeenCalledWith(
        USER_ID,
        'google',
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ──────────────────────────────────────────────
  // googleLink — guard is applied
  // ──────────────────────────────────────────────

  describe('googleLink', () => {
    it('is gated by JwtAuthGuard', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        OAuthController.prototype.googleLink,
      );
      expect(guards).toContain(JwtAuthGuard);
    });

    it('delegates to OAuthAccountService.buildGoogleLinkUrl and returns the URL', () => {
      const expectedUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=signed';
      (oauthAccountServiceMock.buildGoogleLinkUrl as jest.Mock).mockReturnValue(
        { url: expectedUrl },
      );
      const request = makeRequest();

      const result = controller.googleLink(request);

      expect(oauthAccountServiceMock.buildGoogleLinkUrl).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result).toEqual({ url: expectedUrl });
    });
  });
});
