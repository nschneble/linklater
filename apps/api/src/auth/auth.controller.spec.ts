import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const NEW_EMAIL = 'new.email@addy.com';
const PENDING_EMAIL_TOKEN = 'pending-email-token-abc';
const RESET_TOKEN = 'reset-token-abc';
const VERIFICATION_TOKEN = 'verification-token-xyz';

const ACCESS_TOKEN = 'token';
const SITE_MODE = 'dark';
const THEME_NAME = 'scanner-darkly';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const USER_PASSWORD = 'open-sesame';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    confirmEmailChange: jest.fn(),
    forgotPassword: jest.fn(),
    login: jest.fn().mockResolvedValue({ accessToken: ACCESS_TOKEN }),
    requestEmailChange: jest.fn(),
    resendVerificationEmail: jest.fn(),
    resetPassword: jest.fn(),
    sendVerificationEmail: jest.fn(),
    verifyEmail: jest.fn(),
  } as unknown as AuthService;

  const usersServiceMock = {
    create: jest.fn(),
    findById: jest.fn(),
  } as unknown as UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('delegates to UsersService.create', async () => {
      const user = {
        createdAt: new Date(),
        email: USER_EMAIL,
        id: USER_ID,
        mode: SITE_MODE,
        theme: THEME_NAME,
        updatedAt: new Date(),
      };
      (usersServiceMock.create as jest.Mock).mockResolvedValue(user);

      const result = await controller.register({
        email: USER_EMAIL,
        password: USER_PASSWORD,
      } as never);

      expect(usersServiceMock.create).toHaveBeenCalledWith(
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
    it('returns user with id remapped to userId', async () => {
      const request = {
        user: {
          email: USER_EMAIL,
          userId: USER_ID,
        },
      } as never;
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        createdAt: new Date(),
        email: USER_EMAIL,
        id: USER_ID,
        mode: SITE_MODE,
        theme: THEME_NAME,
        updatedAt: new Date(),
      });

      const result = await controller.me(request);

      expect(result).not.toHaveProperty('id');
      expect(result.userId).toBe(USER_ID);
      expect(result.email).toBe(USER_EMAIL);
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
});
