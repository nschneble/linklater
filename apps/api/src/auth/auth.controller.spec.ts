import { jest } from '@jest/globals';

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import type { Response } from 'express';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthRequest } from './auth-request.type';
import { LocalAuthGuard } from './local-auth.guard';
import { EmailVerificationService } from './email-verification.service';
import { MfaAuthGuard } from './mfa-auth.guard';
import { OAuthAccountService } from './oauth-account.service';
import { TotpService } from './totp.service';

const ACCESS_TOKEN = 'token';
const NEW_EMAIL = 'new.email@addy.com';
const PENDING_EMAIL_TOKEN = 'pending-email-token-abc';
const RESET_TOKEN = 'reset-token-abc';
const SITE_MODE = 'dark';
const THEME_NAME = 'scanner-darkly';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const USER_PASSWORD = 'open-sesame';
const VERIFICATION_TOKEN = 'verification-token-xyz';

describe('AuthController', () => {
  let controller: AuthController;

  const REFRESH_TOKEN = 'refresh-token';

  const authServiceMock = {
    authorizeExtension: jest.fn().mockResolvedValue({
      code: 'auth-code-123',
      callbackUrl: 'chrome-extension://allowed/callback',
    }),
    createExtensionAuthCode: jest.fn().mockResolvedValue('auth-code-123'),
    disable2fa: jest.fn(),
    exchangeExtensionCode: jest.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    }),
    login: jest.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    }),
    me: jest.fn(),
    refresh: jest.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    }),
    regenerateRecoveryCodes: jest.fn(),
    register: jest.fn(),
    registerMagicLink: jest.fn(),
    requestMagicLink: jest.fn(),
    revokeAllRefreshTokens: jest.fn().mockResolvedValue(undefined),
    setFirstPassword: jest.fn(),
    verifyMagicLink: jest.fn(),
    verifyOtp: jest.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    }),
  } as unknown as AuthService;

  const emailVerificationServiceMock = {
    confirmEmailChange: jest.fn(),
    forgotPassword: jest.fn(),
    requestEmailChange: jest.fn(),
    resendVerificationEmail: jest.fn(),
    resetPassword: jest.fn(),
    verifyEmail: jest.fn(),
  } as unknown as EmailVerificationService;

  const oauthAccountServiceMock = {
    linkOAuthAccountToUser: jest.fn(),
    unlinkOAuthProvider: jest.fn(),
  } as unknown as OAuthAccountService;

  const totpServiceMock = {
    generateSetup: jest.fn(),
    verifySetup: jest.fn(),
  } as unknown as TotpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: EmailVerificationService,
          useValue: emailVerificationServiceMock,
        },
        { provide: OAuthAccountService, useValue: oauthAccountServiceMock },
        { provide: TotpService, useValue: totpServiceMock },
      ],
    })
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(MfaAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('delegates to AuthService.register with email and password', async () => {
      const user = {
        createdAt: new Date(),
        email: USER_EMAIL,
        id: USER_ID,
        mode: SITE_MODE,
        theme: THEME_NAME,
        updatedAt: new Date(),
      };
      (authServiceMock.register as jest.Mock).mockResolvedValue(user);

      const result = await controller.register({
        email: USER_EMAIL,
        password: USER_PASSWORD,
      } as never);

      expect(authServiceMock.register).toHaveBeenCalledWith(
        USER_EMAIL,
        USER_PASSWORD,
      );
      expect(result).toBe(user);
    });
  });

  describe('login', () => {
    it('applies ThrottlerGuard before LocalAuthGuard to prevent bypass via credential failure', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        AuthController.prototype.login,
      );
      expect(guards).toContain(CustomThrottlerGuard);
      expect(guards).toContain(LocalAuthGuard);
      expect(guards.indexOf(CustomThrottlerGuard)).toBeLessThan(
        guards.indexOf(LocalAuthGuard),
      );
    });

    it('delegates to AuthService.login with the request user', async () => {
      const request = {
        user: {
          email: USER_EMAIL,
          userId: USER_ID,
        },
      } as never;
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        accessToken: ACCESS_TOKEN,
      });

      const result = await controller.login(request);

      expect(authServiceMock.login).toHaveBeenCalledWith(request.user);
      expect(result).toEqual({ accessToken: ACCESS_TOKEN });
    });
  });

  describe('me', () => {
    it('delegates to AuthService.me with the userId', async () => {
      const request = {
        user: {
          email: USER_EMAIL,
          userId: USER_ID,
        },
      } as never;
      const meResult = {
        createdAt: new Date(),
        email: USER_EMAIL,
        userId: USER_ID,
        mode: SITE_MODE,
        theme: THEME_NAME,
        updatedAt: new Date(),
      };
      (authServiceMock.me as jest.Mock).mockResolvedValue(meResult);

      const result = await controller.me(request);

      expect(authServiceMock.me).toHaveBeenCalledWith(USER_ID);
      expect(result).toBe(meResult);
    });
  });

  describe('verifyEmail', () => {
    it('delegates to EmailVerificationService.verifyEmail with the token', async () => {
      (emailVerificationServiceMock.verifyEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.verifyEmail({ token: VERIFICATION_TOKEN });

      expect(emailVerificationServiceMock.verifyEmail).toHaveBeenCalledWith(
        VERIFICATION_TOKEN,
      );
    });
  });

  describe('forgotPassword', () => {
    it('delegates to EmailVerificationService.forgotPassword with the email', async () => {
      (
        emailVerificationServiceMock.forgotPassword as jest.Mock
      ).mockResolvedValue(undefined);

      await controller.forgotPassword({ email: USER_EMAIL });

      expect(emailVerificationServiceMock.forgotPassword).toHaveBeenCalledWith(
        USER_EMAIL,
      );
    });
  });

  describe('resetPassword', () => {
    it('delegates to EmailVerificationService.resetPassword with token and password', async () => {
      (
        emailVerificationServiceMock.resetPassword as jest.Mock
      ).mockResolvedValue(undefined);

      await controller.resetPassword({
        token: RESET_TOKEN,
        password: 'new-password-123',
      });

      expect(emailVerificationServiceMock.resetPassword).toHaveBeenCalledWith(
        RESET_TOKEN,
        'new-password-123',
      );
    });
  });

  describe('resendVerification', () => {
    it('delegates to EmailVerificationService.resendVerificationEmail with the userId', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      (
        emailVerificationServiceMock.resendVerificationEmail as jest.Mock
      ).mockResolvedValue(undefined);

      await controller.resendVerification(request);

      expect(
        emailVerificationServiceMock.resendVerificationEmail,
      ).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('requestEmailChange', () => {
    it('delegates to EmailVerificationService.requestEmailChange with userId, new email, and optional code', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      (
        emailVerificationServiceMock.requestEmailChange as jest.Mock
      ).mockResolvedValue(undefined);

      await controller.requestEmailChange(request, {
        email: NEW_EMAIL,
        code: '123456',
      });

      expect(
        emailVerificationServiceMock.requestEmailChange,
      ).toHaveBeenCalledWith(USER_ID, NEW_EMAIL, '123456');
    });
  });

  describe('verifyEmailChange', () => {
    it('delegates to EmailVerificationService.confirmEmailChange with the token', async () => {
      (
        emailVerificationServiceMock.confirmEmailChange as jest.Mock
      ).mockResolvedValue(undefined);

      await controller.verifyEmailChange({ token: PENDING_EMAIL_TOKEN });

      expect(
        emailVerificationServiceMock.confirmEmailChange,
      ).toHaveBeenCalledWith(PENDING_EMAIL_TOKEN);
    });
  });

  describe('verifyOtp', () => {
    it('delegates to AuthService.verifyOtp with userId, code, and method', async () => {
      const request = { user: { userId: USER_ID } } as never;
      const body = {
        mfaToken: 'mfa-tok',
        code: '123456',
        method: 'totp' as const,
      };

      const result = await controller.verifyOtp(request, body);

      expect(authServiceMock.verifyOtp).toHaveBeenCalledWith(
        USER_ID,
        '123456',
        'totp',
      );
      expect(result).toEqual({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
    });
  });

  describe('totpSetup', () => {
    it('delegates to TotpService.generateSetup with userId and email', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      const setupResult = {
        qrCodeDataUrl: 'data:image/png;base64,...',
        secret: 'ABCDEF',
      };
      (totpServiceMock.generateSetup as jest.Mock).mockResolvedValue(
        setupResult,
      );

      const result = await controller.totpSetup(request);

      expect(totpServiceMock.generateSetup).toHaveBeenCalledWith(
        USER_ID,
        USER_EMAIL,
      );
      expect(result).toBe(setupResult);
    });
  });

  describe('totpVerifySetup', () => {
    it('delegates to TotpService.verifySetup and wraps recovery codes in object', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      const recoveryCodes = ['aaaaa-bbbbb', 'ccccc-ddddd'];
      (totpServiceMock.verifySetup as jest.Mock).mockResolvedValue(
        recoveryCodes,
      );

      const result = await controller.totpVerifySetup(request, {
        code: '123456',
      });

      expect(totpServiceMock.verifySetup).toHaveBeenCalledWith(
        USER_ID,
        '123456',
      );
      expect(result).toEqual({ recoveryCodes });
    });
  });

  describe('requestMagicLink', () => {
    it('delegates to AuthService.requestMagicLink with the provided email', async () => {
      (authServiceMock.requestMagicLink as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.requestMagicLink({ email: USER_EMAIL });

      expect(authServiceMock.requestMagicLink).toHaveBeenCalledWith(USER_EMAIL);
    });
  });

  describe('registerMagicLink', () => {
    it('delegates to AuthService.registerMagicLink with the email from the request body', async () => {
      (authServiceMock.registerMagicLink as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.registerMagicLink({ email: USER_EMAIL });

      expect(authServiceMock.registerMagicLink).toHaveBeenCalledWith(
        USER_EMAIL,
      );
    });
  });

  describe('verifyMagicLink', () => {
    it('delegates to AuthService.verifyMagicLink and returns the access token', async () => {
      const ACCESS_TOKEN_VALUE = 'magic-access-token';
      (authServiceMock.verifyMagicLink as jest.Mock).mockResolvedValue({
        accessToken: ACCESS_TOKEN_VALUE,
      });

      const result = await controller.verifyMagicLink({
        token: 'valid-token',
      });

      expect(authServiceMock.verifyMagicLink).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(result).toEqual({ accessToken: ACCESS_TOKEN_VALUE });
    });
  });

  describe('disable2fa', () => {
    it('delegates to AuthService.disable2fa with userId and credentials', async () => {
      const request = { user: { userId: USER_ID } } as never;
      (authServiceMock.disable2fa as jest.Mock).mockResolvedValue(undefined);

      await controller.disable2fa(request, { currentPassword: 'open-sesame' });

      expect(authServiceMock.disable2fa).toHaveBeenCalledWith(
        USER_ID,
        'open-sesame',
        undefined,
      );
    });
  });

  describe('regenerateRecoveryCodes', () => {
    it('delegates to AuthService.regenerateRecoveryCodes and wraps result', async () => {
      const request = { user: { userId: USER_ID } } as never;
      const recoveryCodes = ['aaaaa-bbbbb'];
      (authServiceMock.regenerateRecoveryCodes as jest.Mock).mockResolvedValue(
        recoveryCodes,
      );

      const result = await controller.regenerateRecoveryCodes(request, {
        currentPassword: 'open-sesame',
      });

      expect(authServiceMock.regenerateRecoveryCodes).toHaveBeenCalledWith(
        USER_ID,
        'open-sesame',
        undefined,
      );
      expect(result).toEqual({ recoveryCodes });
    });
  });

  describe('googleCallback', () => {
    it('redirects to oauth callback with the access token and refresh token on success', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      const response = { redirect: jest.fn() } as never;
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });

      await controller.googleCallback(request, response);

      expect(response.redirect).toHaveBeenCalledWith(
        expect.stringContaining(
          `#token=${ACCESS_TOKEN}&refresh=${REFRESH_TOKEN}`,
        ),
      );
    });

    it('redirects to login error page when login returns an MFA challenge', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      const response = { redirect: jest.fn() } as never;
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        mfaToken: 'mfa-tok',
        mfaMethod: 'totp',
      });

      await controller.googleCallback(request, response);

      expect(response.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=mfa_required'),
      );
    });
  });

  describe('appleCallback', () => {
    it('redirects to oauth callback with the access token and refresh token on success', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      const response = { redirect: jest.fn() } as never;
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });

      await controller.appleCallback(request, response);

      expect(response.redirect).toHaveBeenCalledWith(
        expect.stringContaining(
          `#token=${ACCESS_TOKEN}&refresh=${REFRESH_TOKEN}`,
        ),
      );
    });

    it('redirects to login error page when login returns an MFA challenge', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      const response = { redirect: jest.fn() } as never;
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        mfaToken: 'mfa-tok',
        mfaMethod: 'email',
      });

      await controller.appleCallback(request, response);

      expect(response.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=mfa_required'),
      );
    });
  });

  describe('setPassword', () => {
    it('delegates to authService.setFirstPassword with userId and password', async () => {
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;
      (authServiceMock.setFirstPassword as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.setPassword(request, {
        password: USER_PASSWORD,
      });

      expect(authServiceMock.setFirstPassword).toHaveBeenCalledWith(
        USER_ID,
        USER_PASSWORD,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('unlinkProvider', () => {
    it('delegates to oauthAccountService.unlinkOAuthProvider with userId and provider', async () => {
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;
      (
        oauthAccountServiceMock.unlinkOAuthProvider as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await controller.unlinkProvider(request, 'google');

      expect(oauthAccountServiceMock.unlinkOAuthProvider).toHaveBeenCalledWith(
        USER_ID,
        'google',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('googleLink', () => {
    it('redirects to the Google OAuth authorization URL', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_LINK_CALLBACK_URL =
        'https://api.example.com/auth/google/link/callback';
      process.env.JWT_SECRET = 'test-secret';

      const request = {
        user: { userId: USER_ID },
      } as unknown as AuthRequest;
      const response = { redirect: jest.fn() } as unknown as Response;

      controller.googleLink(request, response);

      expect(response.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth'),
      );
    });
  });

  describe('googleLinkCallback', () => {
    it('redirects to settings with linked=google on success', async () => {
      process.env.APP_URL = 'https://app.example.com';
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;
      const response = { redirect: jest.fn() } as unknown as Response;
      (
        oauthAccountServiceMock.linkOAuthAccountToUser as jest.Mock
      ).mockResolvedValue(undefined);

      await controller.googleLinkCallback(request, response);

      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/settings?linked=google',
      );
    });

    it('redirects with link_error=already_linked when ConflictException is thrown', async () => {
      process.env.APP_URL = 'https://app.example.com';
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;
      const response = { redirect: jest.fn() } as unknown as Response;
      (
        oauthAccountServiceMock.linkOAuthAccountToUser as jest.Mock
      ).mockRejectedValue(new ConflictException('Already linked'));

      await controller.googleLinkCallback(request, response);

      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/settings?link_error=already_linked',
      );
    });

    it('redirects with link_error=email_mismatch when BadRequestException is thrown', async () => {
      process.env.APP_URL = 'https://app.example.com';
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;
      const response = { redirect: jest.fn() } as unknown as Response;
      (
        oauthAccountServiceMock.linkOAuthAccountToUser as jest.Mock
      ).mockRejectedValue(new BadRequestException('Email mismatch'));

      await controller.googleLinkCallback(request, response);

      expect(response.redirect).toHaveBeenCalledWith(
        'https://app.example.com/settings?link_error=email_mismatch',
      );
    });

    it('re-throws unexpected errors from linkOAuthAccountToUser', async () => {
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;
      const response = { redirect: jest.fn() } as unknown as Response;
      (
        oauthAccountServiceMock.linkOAuthAccountToUser as jest.Mock
      ).mockRejectedValue(new Error('Database connection lost'));

      await expect(
        controller.googleLinkCallback(request, response),
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('refreshToken', () => {
    it('delegates to authService.refresh and returns the token pair', async () => {
      const result = await controller.refreshToken({
        refreshToken: REFRESH_TOKEN,
      });

      expect(authServiceMock.refresh).toHaveBeenCalledWith(REFRESH_TOKEN);
      expect(result).toEqual({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
    });
  });

  describe('revokeAllSessions', () => {
    it('delegates to authService.revokeAllRefreshTokens and returns success', async () => {
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;

      const result = await controller.revokeAllSessions(request);

      expect(authServiceMock.revokeAllRefreshTokens).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('extensionAuthorize', () => {
    it('delegates to authService.authorizeExtension with userId, codeChallenge, and redirectUri', async () => {
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;
      const response = { redirect: jest.fn() } as unknown as Response;
      (authServiceMock.authorizeExtension as jest.Mock).mockResolvedValue({
        code: 'auth-code-123',
        callbackUrl: 'chrome-extension://allowed/callback',
      });

      await controller.extensionAuthorize(
        request,
        response,
        'challenge123',
        'chrome-extension://allowed/callback',
      );

      expect(authServiceMock.authorizeExtension).toHaveBeenCalledWith(
        USER_ID,
        'challenge123',
        'chrome-extension://allowed/callback',
      );
      expect(response.redirect).toHaveBeenCalledWith(
        expect.stringContaining('code=auth-code-123'),
      );
    });

    it('propagates exceptions thrown by authService.authorizeExtension', async () => {
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;
      const response = { redirect: jest.fn() } as unknown as Response;
      (authServiceMock.authorizeExtension as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid redirect_uri'),
      );

      await expect(
        controller.extensionAuthorize(
          request,
          response,
          'challenge123',
          'chrome-extension://not-allowed/callback',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('extensionToken', () => {
    it('delegates to authService.exchangeExtensionCode and returns token pair', async () => {
      const result = await controller.extensionToken({
        code: 'auth-code-123',
        codeVerifier: 'verifier-xyz',
      });

      expect(authServiceMock.exchangeExtensionCode).toHaveBeenCalledWith(
        'auth-code-123',
        'verifier-xyz',
      );
      expect(result).toEqual({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
    });
  });
});
