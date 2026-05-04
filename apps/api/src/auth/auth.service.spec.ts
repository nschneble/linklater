import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';

import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';

const KNOWN_PASSWORD = 'open-sesame';
const KNOWN_PASSWORD_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);
const NEW_PASSWORD = 'new-secure-password-123';
const RESET_TOKEN = 'reset-token-abc';
const SIGNED_TOKEN = 'signed-token';
const UNKNOWN_PASSWORD = 'open-poppy-seed';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const VERIFICATION_TOKEN = 'verification-token-xyz';

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    clearVerificationToken: jest.fn(),
    findByEmail: jest.fn(),
    findByResetToken: jest.fn(),
    findByVerificationToken: jest.fn(),
    findById: jest.fn(),
    resetPasswordWithToken: jest.fn(),
    updateResetToken: jest.fn(),
    updateVerificationToken: jest.fn(),
  } as unknown as UsersService;

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue(SIGNED_TOKEN),
  } as unknown as JwtService;

  const emailServiceMock = {
    sendPasswordResetEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
  } as unknown as EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('returns user without passwordHash when credentials are valid', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        email: USER_EMAIL,
        id: USER_ID,
        passwordHash: KNOWN_PASSWORD_HASH,
      });

      const result = await service.validateUser(USER_EMAIL, KNOWN_PASSWORD);

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('passwordHash');
      expect(result?.email).toBe(USER_EMAIL);
    });

    it('returns null when password is wrong', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        email: USER_EMAIL,
        id: USER_ID,
        passwordHash: KNOWN_PASSWORD_HASH,
      });

      const result = await service.validateUser(USER_EMAIL, UNKNOWN_PASSWORD);
      expect(result).toBeNull();
    });

    it('returns null when user is not found', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser(USER_EMAIL, UNKNOWN_PASSWORD);
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns an accessToken when given a user with id', async () => {
      (jwtServiceMock.sign as jest.Mock).mockReturnValue(SIGNED_TOKEN);

      const result = await service.login({
        email: USER_EMAIL,
        id: USER_ID,
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        email: USER_EMAIL,
        subject: USER_ID,
      });
      expect(result.accessToken).toBe(SIGNED_TOKEN);
    });

    it('returns an accessToken when given a user with userId', async () => {
      const result = await service.login({
        email: USER_EMAIL,
        userId: USER_ID,
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        email: USER_EMAIL,
        subject: USER_ID,
      });
      expect(result.accessToken).toBe(SIGNED_TOKEN);
    });
  });

  describe('sendVerificationEmail', () => {
    it('stores a verification token and sends an email', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });
      (usersServiceMock.updateVerificationToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendVerificationEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.sendVerificationEmail(USER_ID);

      expect(usersServiceMock.updateVerificationToken).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.any(Date),
      );
      expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.any(String),
      );
    });
  });

  describe('verifyEmail', () => {
    it('clears the token when it is valid and not expired', async () => {
      (usersServiceMock.findByVerificationToken as jest.Mock).mockResolvedValue(
        {
          id: USER_ID,
          verificationToken: VERIFICATION_TOKEN,
          verificationTokenExpiresAt: new Date(Date.now() + 3600000),
        },
      );
      (usersServiceMock.clearVerificationToken as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.verifyEmail(VERIFICATION_TOKEN);

      expect(usersServiceMock.clearVerificationToken).toHaveBeenCalledWith(
        USER_ID,
      );
    });

    it('throws BadRequestException when the token is not found', async () => {
      (usersServiceMock.findByVerificationToken as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.verifyEmail('unknown-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the token has expired', async () => {
      (usersServiceMock.findByVerificationToken as jest.Mock).mockResolvedValue(
        {
          id: USER_ID,
          verificationToken: VERIFICATION_TOKEN,
          verificationTokenExpiresAt: new Date(Date.now() - 1000),
        },
      );

      await expect(service.verifyEmail(VERIFICATION_TOKEN)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('stores a reset token and sends an email when the user exists', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });
      (usersServiceMock.updateResetToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendPasswordResetEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.forgotPassword(USER_EMAIL);

      expect(usersServiceMock.updateResetToken).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.any(Date),
      );
      expect(emailServiceMock.sendPasswordResetEmail).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.any(String),
      );
    });

    it('does nothing silently when the user is not found (prevents email enumeration)', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        service.forgotPassword('unknown@example.com'),
      ).resolves.not.toThrow();
      expect(usersServiceMock.updateResetToken).not.toHaveBeenCalled();
      expect(emailServiceMock.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password and clears the reset token when valid', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        resetToken: RESET_TOKEN,
        resetTokenExpiresAt: new Date(Date.now() + 3600000),
      });
      (usersServiceMock.resetPasswordWithToken as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.resetPassword(RESET_TOKEN, NEW_PASSWORD);

      expect(usersServiceMock.resetPasswordWithToken).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
      );
    });

    it('throws BadRequestException when the reset token is not found', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetPassword('unknown-token', NEW_PASSWORD),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the reset token has expired', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        resetToken: RESET_TOKEN,
        resetTokenExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword(RESET_TOKEN, NEW_PASSWORD),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
