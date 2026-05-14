import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaAuthGuard } from './mfa-auth.guard';
import { TotpService } from './totp.service';
import { SmsSetupService } from '../sms/sms-setup.service';

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

  const authServiceMock = {
    confirmEmailChange: jest.fn(),
    disable2fa: jest.fn(),
    forgotPassword: jest.fn(),
    login: jest.fn().mockResolvedValue({ accessToken: ACCESS_TOKEN }),
    me: jest.fn(),
    regenerateRecoveryCodes: jest.fn(),
    register: jest.fn(),
    requestEmailChange: jest.fn(),
    resendVerificationEmail: jest.fn(),
    resetPassword: jest.fn(),
    sendVerificationEmail: jest.fn(),
    verifyEmail: jest.fn(),
    verifyOtp: jest.fn().mockResolvedValue({ accessToken: ACCESS_TOKEN }),
  } as unknown as AuthService;

  const totpServiceMock = {
    generateSetup: jest.fn(),
    verifySetup: jest.fn(),
  } as unknown as TotpService;

  const smsSetupServiceMock = {
    initiateSetup: jest.fn(),
    smsResend: jest.fn(),
    verifySetup: jest.fn(),
  } as unknown as SmsSetupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: SmsSetupService, useValue: smsSetupServiceMock },
        { provide: TotpService, useValue: totpServiceMock },
      ],
    })
      .overrideGuard(ThrottlerGuard)
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
    it('delegates to AuthService.verifyEmail with the token', async () => {
      (authServiceMock.verifyEmail as jest.Mock).mockResolvedValue(undefined);

      await controller.verifyEmail({ token: VERIFICATION_TOKEN });

      expect(authServiceMock.verifyEmail).toHaveBeenCalledWith(
        VERIFICATION_TOKEN,
      );
    });
  });

  describe('forgotPassword', () => {
    it('delegates to AuthService.forgotPassword with the email', async () => {
      (authServiceMock.forgotPassword as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.forgotPassword({ email: USER_EMAIL });

      expect(authServiceMock.forgotPassword).toHaveBeenCalledWith(USER_EMAIL);
    });
  });

  describe('resetPassword', () => {
    it('delegates to AuthService.resetPassword with token and password', async () => {
      (authServiceMock.resetPassword as jest.Mock).mockResolvedValue(undefined);

      await controller.resetPassword({
        token: RESET_TOKEN,
        password: 'new-password-123',
      });

      expect(authServiceMock.resetPassword).toHaveBeenCalledWith(
        RESET_TOKEN,
        'new-password-123',
      );
    });
  });

  describe('resendVerification', () => {
    it('delegates to AuthService.resendVerificationEmail with the userId', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      (authServiceMock.resendVerificationEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.resendVerification(request);

      expect(authServiceMock.resendVerificationEmail).toHaveBeenCalledWith(
        USER_ID,
      );
    });
  });

  describe('requestEmailChange', () => {
    it('delegates to AuthService.requestEmailChange with userId and new email', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      (authServiceMock.requestEmailChange as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.requestEmailChange(request, { email: NEW_EMAIL });

      expect(authServiceMock.requestEmailChange).toHaveBeenCalledWith(
        USER_ID,
        NEW_EMAIL,
      );
    });
  });

  describe('verifyEmailChange', () => {
    it('delegates to AuthService.confirmEmailChange with the token', async () => {
      (authServiceMock.confirmEmailChange as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.verifyEmailChange({ token: PENDING_EMAIL_TOKEN });

      expect(authServiceMock.confirmEmailChange).toHaveBeenCalledWith(
        PENDING_EMAIL_TOKEN,
      );
    });
  });

  describe('verifyOtp', () => {
    it('delegates to AuthService.verifyOtp with userId, code, and method', async () => {
      const request = { user: { userId: USER_ID } } as never;
      const body = { mfaToken: 'mfa-tok', code: '123456', method: 'totp' as const };

      const result = await controller.verifyOtp(request, body);

      expect(authServiceMock.verifyOtp).toHaveBeenCalledWith(
        USER_ID,
        '123456',
        'totp',
      );
      expect(result).toEqual({ accessToken: ACCESS_TOKEN });
    });
  });

  describe('totpSetup', () => {
    it('delegates to TotpService.generateSetup with userId and email', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      const setupResult = { qrCodeDataUrl: 'data:image/png;base64,...', secret: 'ABCDEF' };
      (totpServiceMock.generateSetup as jest.Mock).mockResolvedValue(setupResult);

      const result = await controller.totpSetup(request);

      expect(totpServiceMock.generateSetup).toHaveBeenCalledWith(USER_ID, USER_EMAIL);
      expect(result).toBe(setupResult);
    });
  });

  describe('totpVerifySetup', () => {
    it('delegates to TotpService.verifySetup and wraps recovery codes in object', async () => {
      const request = { user: { userId: USER_ID, email: USER_EMAIL } } as never;
      const recoveryCodes = ['aaaaa-bbbbb', 'ccccc-ddddd'];
      (totpServiceMock.verifySetup as jest.Mock).mockResolvedValue(recoveryCodes);

      const result = await controller.totpVerifySetup(request, { code: '123456' });

      expect(totpServiceMock.verifySetup).toHaveBeenCalledWith(USER_ID, '123456');
      expect(result).toEqual({ recoveryCodes });
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
      (authServiceMock.regenerateRecoveryCodes as jest.Mock).mockResolvedValue(recoveryCodes);

      const result = await controller.regenerateRecoveryCodes(request, { currentPassword: 'open-sesame' });

      expect(authServiceMock.regenerateRecoveryCodes).toHaveBeenCalledWith(
        USER_ID,
        'open-sesame',
        undefined,
      );
      expect(result).toEqual({ recoveryCodes });
    });
  });

  describe('getRecoveryCodes', () => {
    it('delegates to AuthService.regenerateRecoveryCodes and wraps result', async () => {
      const request = { user: { userId: USER_ID } } as never;
      const recoveryCodes = ['aaaaa-bbbbb'];
      (authServiceMock.regenerateRecoveryCodes as jest.Mock).mockResolvedValue(recoveryCodes);

      const result = await controller.getRecoveryCodes(request, { currentPassword: 'open-sesame' });

      expect(authServiceMock.regenerateRecoveryCodes).toHaveBeenCalledWith(
        USER_ID,
        'open-sesame',
        undefined,
      );
      expect(result).toEqual({ recoveryCodes });
    });
  });

  describe('smsSetup', () => {
    it('delegates to SmsSetupService.initiateSetup with userId and phoneNumber', async () => {
      const request = { user: { userId: USER_ID } } as never;
      (smsSetupServiceMock.initiateSetup as jest.Mock).mockResolvedValue(undefined);

      await controller.smsSetup(request, { phoneNumber: '+15555550100' });

      expect(smsSetupServiceMock.initiateSetup).toHaveBeenCalledWith(
        USER_ID,
        '+15555550100',
      );
    });
  });

  describe('smsVerify', () => {
    it('delegates to SmsSetupService.verifySetup and wraps recovery codes', async () => {
      const request = { user: { userId: USER_ID } } as never;
      const recoveryCodes = ['aaaaa-bbbbb'];
      (smsSetupServiceMock.verifySetup as jest.Mock).mockResolvedValue(recoveryCodes);

      const result = await controller.smsVerify(request, { code: '123456' });

      expect(smsSetupServiceMock.verifySetup).toHaveBeenCalledWith(USER_ID, '123456');
      expect(result).toEqual({ recoveryCodes });
    });
  });

  describe('smsResend', () => {
    it('delegates to SmsSetupService.smsResend with userId', async () => {
      const request = { user: { userId: USER_ID } } as never;
      (smsSetupServiceMock.smsResend as jest.Mock).mockResolvedValue(undefined);

      await controller.smsResend(request);

      expect(smsSetupServiceMock.smsResend).toHaveBeenCalledWith(USER_ID);
    });
  });
});
