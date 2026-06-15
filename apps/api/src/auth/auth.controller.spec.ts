import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ExtensionAuthController } from './extension-auth.controller';
import { ExtensionAuthService } from './extension-auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MagicLinkController } from './magic-link.controller';
import { MfaAuthGuard } from './mfa-auth.guard';
import { OAuthAccountService } from './oauth-account.service';
import { OAuthController } from './oauth.controller';
import { TotpService } from './totp.service';
import { MultiFactorController } from './multi-factor.controller';
import type { AuthRequest } from './auth-request.type';

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
  let multiFactorController: MultiFactorController;

  const REFRESH_TOKEN = 'refresh-token';

  const extensionAuthServiceMock = {
    authorizeExtension: jest.fn().mockResolvedValue({
      code: 'auth-code-123',
      callbackUrl: 'chrome-extension://allowed/callback',
    }),
    createExtensionAuthCode: jest.fn().mockResolvedValue('auth-code-123'),
    exchangeExtensionCode: jest.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    }),
  } as unknown as ExtensionAuthService;

  const authServiceMock = {
    disableMfa: jest.fn(),
    login: jest.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    }),
    markWelcomed: jest.fn().mockResolvedValue(undefined),
    me: jest.fn(),
    refresh: jest.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    }),
    regenerateRecoveryCodes: jest.fn(),
    register: jest.fn(),
    registerMagicLink: jest.fn(),
    requestMagicLink: jest.fn(),
    resetPassword: jest.fn().mockResolvedValue({
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
    }),
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
    resendEmailChange: jest.fn(),
    resendVerificationEmail: jest.fn(),
    resetPassword: jest.fn(),
    verifyEmail: jest.fn(),
  } as unknown as EmailVerificationService;

  const oauthAccountServiceMock = {
    buildGoogleLinkUrl: jest.fn(),
    linkOAuthAccountToUser: jest.fn(),
    unlinkOAuthProvider: jest.fn(),
  } as unknown as OAuthAccountService;

  const totpServiceMock = {
    generateSetup: jest.fn(),
    verifySetup: jest.fn(),
  } as unknown as TotpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        AuthController,
        ExtensionAuthController,
        MagicLinkController,
        OAuthController,
        MultiFactorController,
      ],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: EmailVerificationService,
          useValue: emailVerificationServiceMock,
        },
        {
          provide: ExtensionAuthService,
          useValue: extensionAuthServiceMock,
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
    multiFactorController = module.get<MultiFactorController>(
      MultiFactorController,
    );
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

    it('delegates to AuthService.login with the request user id', async () => {
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

      // login(userId) — the controller no longer passes the full request.user
      // object, eliminating the OAuth strategy-shape footgun.
      expect(authServiceMock.login).toHaveBeenCalledWith(USER_ID);
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
    it('delegates to AuthService.resetPassword with token and password and returns the session', async () => {
      (authServiceMock.resetPassword as jest.Mock).mockResolvedValue({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });

      const result = await controller.resetPassword({
        token: RESET_TOKEN,
        password: 'new-password-123',
      });

      expect(authServiceMock.resetPassword).toHaveBeenCalledWith(
        RESET_TOKEN,
        'new-password-123',
      );
      expect(result).toEqual({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
    });
  });

  describe('resendVerification', () => {
    it('applies JwtAuthGuard before CustomThrottlerGuard so only authenticated users can trigger the send', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        AuthController.prototype.resendVerification,
      );
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(CustomThrottlerGuard);
      expect(guards.indexOf(JwtAuthGuard)).toBeLessThan(
        guards.indexOf(CustomThrottlerGuard),
      );
    });

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
    it('applies JwtAuthGuard before CustomThrottlerGuard so only authenticated users can trigger the change', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        AuthController.prototype.requestEmailChange,
      );
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(CustomThrottlerGuard);
      expect(guards.indexOf(JwtAuthGuard)).toBeLessThan(
        guards.indexOf(CustomThrottlerGuard),
      );
    });

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

  describe('resendEmailChange', () => {
    it('applies JwtAuthGuard before CustomThrottlerGuard so only authenticated users can trigger the resend', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        AuthController.prototype.resendEmailChange,
      );
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(CustomThrottlerGuard);
      expect(guards.indexOf(JwtAuthGuard)).toBeLessThan(
        guards.indexOf(CustomThrottlerGuard),
      );
    });

    it('delegates to EmailVerificationService.resendEmailChange with the userId', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      (
        emailVerificationServiceMock.resendEmailChange as jest.Mock
      ).mockResolvedValue(undefined);

      await controller.resendEmailChange(request);

      expect(
        emailVerificationServiceMock.resendEmailChange,
      ).toHaveBeenCalledWith(USER_ID);
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
    it('applies CustomThrottlerGuard before MfaAuthGuard to rate-limit before auth processing', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        MultiFactorController.prototype.verifyOtp,
      );
      expect(guards).toContain(CustomThrottlerGuard);
      expect(guards).toContain(MfaAuthGuard);
      expect(guards.indexOf(CustomThrottlerGuard)).toBeLessThan(
        guards.indexOf(MfaAuthGuard),
      );
    });

    it('delegates to AuthService.verifyOtp with userId, code, method, and the nonce from the MFA token', async () => {
      const request = {
        user: { userId: USER_ID, nonce: 'mfa-nonce-abc' },
      } as never;
      const body = {
        mfaToken: 'mfa-tok',
        code: '123456',
        method: 'totp' as const,
      };

      const result = await multiFactorController.verifyOtp(request, body);

      expect(authServiceMock.verifyOtp).toHaveBeenCalledWith(
        USER_ID,
        '123456',
        'totp',
        'mfa-nonce-abc',
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

      const result = await multiFactorController.totpSetup(request);

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

      const result = await multiFactorController.totpVerifySetup(request, {
        code: '123456',
      });

      expect(totpServiceMock.verifySetup).toHaveBeenCalledWith(
        USER_ID,
        '123456',
      );
      expect(result).toEqual({ recoveryCodes });
    });
  });

  describe('disableMfa', () => {
    it('delegates to AuthService.disableMfa with userId and credentials', async () => {
      const request = { user: { userId: USER_ID } } as never;
      (authServiceMock.disableMfa as jest.Mock).mockResolvedValue(undefined);

      await multiFactorController.disableMfa(request, {
        currentPassword: 'open-sesame',
      });

      expect(authServiceMock.disableMfa).toHaveBeenCalledWith(
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

      const result = await multiFactorController.regenerateRecoveryCodes(
        request,
        {
          currentPassword: 'open-sesame',
        },
      );

      expect(authServiceMock.regenerateRecoveryCodes).toHaveBeenCalledWith(
        USER_ID,
        'open-sesame',
        undefined,
      );
      expect(result).toEqual({ recoveryCodes });
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

  describe('acknowledgeWelcome', () => {
    it('delegates to authService.markWelcomed and returns success', async () => {
      const request = { user: { userId: USER_ID } } as unknown as AuthRequest;

      const result = await controller.acknowledgeWelcome(request);

      expect(authServiceMock.markWelcomed).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ success: true });
    });
  });
});
