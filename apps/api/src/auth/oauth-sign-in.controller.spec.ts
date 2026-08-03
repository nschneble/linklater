import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { OAuthSignInController } from './oauth-sign-in.controller';
import type { AuthRequest } from './auth-request.type';

const ACCESS_TOKEN = 'access-token-abc';
const REFRESH_TOKEN = 'refresh-token-xyz';
const USER_ID = 'user-1';

const makeRequest = () =>
  ({
    user: { userId: USER_ID },
  }) as unknown as AuthRequest;

const makeResponse = () => ({ redirect: jest.fn() }) as unknown as Response;

describe('OAuthSignInController', () => {
  let controller: OAuthSignInController;

  const authServiceMock = {
    login: jest.fn(),
  } as unknown as AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthSignInController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    })
      .overrideGuard(AuthGuard('google'))
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard('apple'))
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OAuthSignInController>(OAuthSignInController);
    jest.clearAllMocks();

    process.env.APP_URL = 'https://app.example.com';
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // googleCallback / completeOAuthLogin - normal path
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
  // appleCallback - delegates to same completeOAuthLogin
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
});
