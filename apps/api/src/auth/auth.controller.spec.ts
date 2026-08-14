import { jest } from '@jest/globals';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { EmailVerificationService } from './email-verification.service';
import { ExtensionAuthController } from './extension-auth.controller';
import { ExtensionAuthService } from './extension-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LocalAuthGuard } from './local-auth.guard';
import { MagicLinkController } from './magic-link.controller';
import { MfaAuthGuard } from './mfa-auth.guard';
import { MultiFactorController } from './multi-factor.controller';
import { OAuthLinkController } from './oauth-link.controller';
import { OAuthLinkService } from './oauth-link.service';
import { OAuthSignInController } from './oauth-sign-in.controller';
import { Test, TestingModule } from '@nestjs/testing';
import { TotpService } from './totp.service';

const ACCESS_TOKEN = 'token';
const SITE_MODE = 'dark';
const THEME_NAME = 'scanner-darkly';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const USER_PASSWORD = 'open-sesame';

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

  const oauthLinkServiceMock = {
    buildGoogleLinkUrl: jest.fn(),
    linkOAuthAccountToUser: jest.fn(),
    unlinkOAuthProvider: jest.fn(),
  } as unknown as OAuthLinkService;

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
        OAuthLinkController,
        OAuthSignInController,
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
        { provide: OAuthLinkService, useValue: oauthLinkServiceMock },
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

  // one representative delegation guards the delegate-to-service wiring
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

      // login takes userId, not full request.user: guards the OAuth shape footgun
      expect(authServiceMock.login).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ accessToken: ACCESS_TOKEN });
    });
  });

  describe('refreshToken', () => {
    it('hands the nominated successor on with the spent token', async () => {
      const nominated = '0123456789abcdef'.repeat(4);

      await controller.refreshToken({
        refreshToken: REFRESH_TOKEN,
        nextRefreshToken: nominated,
      });

      // dropping it here would sign out every client whose answer was lost
      expect(authServiceMock.refresh).toHaveBeenCalledWith(
        REFRESH_TOKEN,
        nominated,
      );
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

    // MultiFactorController delegation; also guards the MFA-token nonce binding
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
});
