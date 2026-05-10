import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';

class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, { code }: { code: string }) {
    super(message);
    this.code = code;
  }
}

jest.mock('../prisma/generated/client', () => ({
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../prisma/generated/client';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';

const makeP2002 = () =>
  new (
    Prisma as {
      PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
    }
  ).PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
  });

const KNOWN_PASSWORD = 'open-sesame';
const KNOWN_PASSWORD_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);
const OAUTH_PROVIDER = 'google';
const OAUTH_PROVIDER_ID = 'google-uid-123';
const NEW_EMAIL = 'new.email@addy.com';
const NEW_PASSWORD = 'new-secure-password-123';
const PENDING_EMAIL_TOKEN = 'pending-email-token-abc';
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
    confirmPendingEmail: jest.fn(),
    create: jest.fn(),
    createOAuthUser: jest.fn(),
    findByEmail: jest.fn(),
    findByPendingEmailToken: jest.fn(),
    findByResetToken: jest.fn(),
    findByVerificationToken: jest.fn(),
    findById: jest.fn(),
    findOAuthAccount: jest.fn(),
    linkOAuthAccount: jest.fn(),
    markEmailVerified: jest.fn(),
    resetPasswordWithToken: jest.fn(),
    updatePendingEmail: jest.fn(),
    updateResetToken: jest.fn(),
    updateVerificationToken: jest.fn(),
  } as unknown as UsersService;

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue(SIGNED_TOKEN),
  } as unknown as JwtService;

  const emailServiceMock = {
    sendEmailChangeVerificationEmail: jest.fn(),
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

  describe('register', () => {
    it('creates the user and sends a verification email', async () => {
      const user = { id: USER_ID, email: USER_EMAIL };
      (usersServiceMock.create as jest.Mock).mockResolvedValue(user);
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(user);
      (usersServiceMock.updateVerificationToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendVerificationEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.register(USER_EMAIL, KNOWN_PASSWORD);

      expect(usersServiceMock.create).toHaveBeenCalledWith(
        USER_EMAIL,
        KNOWN_PASSWORD,
      );
      expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.any(String),
      );
      expect(result).toBe(user);
    });
  });

  describe('me', () => {
    it('returns user with id remapped to userId', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.me(USER_ID);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
      expect(result).not.toHaveProperty('id');
      expect(result.userId).toBe(USER_ID);
      expect(result.email).toBe(USER_EMAIL);
    });
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

    it('returns null when user has no password (SSO-only account)', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        email: USER_EMAIL,
        id: USER_ID,
        passwordHash: null,
      });

      const result = await service.validateUser(USER_EMAIL, KNOWN_PASSWORD);
      expect(result).toBeNull();
    });
  });

  describe('findOrCreateOAuthUser', () => {
    it('returns existing user when OAuth account already exists', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        user: { id: USER_ID, email: USER_EMAIL },
      });

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
      expect(usersServiceMock.linkOAuthAccount).not.toHaveBeenCalled();
      expect(usersServiceMock.createOAuthUser).not.toHaveBeenCalled();
    });

    it('auto-links OAuth account to existing user with same email', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.linkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
      );
      expect(usersServiceMock.createOAuthUser).not.toHaveBeenCalled();
      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('sets emailVerifiedAt when auto-linking an unverified account', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: null,
      });
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );
      (usersServiceMock.markEmailVerified as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.markEmailVerified).toHaveBeenCalledWith(USER_ID);
    });

    it('creates a new user and OAuth account when no match exists', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.createOAuthUser as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.createOAuthUser).toHaveBeenCalledWith(USER_EMAIL);
      expect(usersServiceMock.linkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
      );
      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('recovers via OAuth account lookup when concurrent creation causes P2002', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          userId: USER_ID,
          user: { id: USER_ID, email: USER_EMAIL },
        });
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.createOAuthUser as jest.Mock).mockRejectedValue(
        makeP2002(),
      );

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('recovers via email lookup when OAuth account not yet linked after P2002', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });
      (usersServiceMock.createOAuthUser as jest.Mock).mockRejectedValue(
        makeP2002(),
      );

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('re-throws non-P2002 errors from createOAuthUser', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.createOAuthUser as jest.Mock).mockRejectedValue(
        new Error('unexpected database error'),
      );

      await expect(
        service.findOrCreateOAuthUser(
          OAUTH_PROVIDER,
          OAUTH_PROVIDER_ID,
          USER_EMAIL,
        ),
      ).rejects.toThrow('unexpected database error');
    });
  });

  describe('login', () => {
    it('returns an accessToken', async () => {
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

  describe('resendVerificationEmail', () => {
    it('stores a new token and sends an email when the user is not yet verified', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: null,
      });
      (usersServiceMock.updateVerificationToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendVerificationEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.resendVerificationEmail(USER_ID);

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

    it('throws BadRequestException when the user is already verified', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });

      await expect(service.resendVerificationEmail(USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('requestEmailChange', () => {
    it('stores pending email and sends a verification email to the new address', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.updatePendingEmail as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        emailServiceMock.sendEmailChangeVerificationEmail as jest.Mock
      ).mockResolvedValue(undefined);

      await service.requestEmailChange(USER_ID, NEW_EMAIL);

      expect(usersServiceMock.updatePendingEmail).toHaveBeenCalledWith(
        USER_ID,
        NEW_EMAIL,
        expect.any(String),
        expect.any(Date),
      );
      expect(
        emailServiceMock.sendEmailChangeVerificationEmail,
      ).toHaveBeenCalledWith(NEW_EMAIL, expect.any(String));
    });

    it('throws ConflictException when the new email is already in use', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: 'other-user',
        email: NEW_EMAIL,
      });

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('confirmEmailChange', () => {
    it('confirms the email change when the token is valid and not expired', async () => {
      (usersServiceMock.findByPendingEmailToken as jest.Mock).mockResolvedValue(
        {
          id: USER_ID,
          pendingEmail: NEW_EMAIL,
          pendingEmailToken: PENDING_EMAIL_TOKEN,
          pendingEmailTokenExpiresAt: new Date(Date.now() + 3600000),
        },
      );
      (usersServiceMock.confirmPendingEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.confirmEmailChange(PENDING_EMAIL_TOKEN);

      expect(usersServiceMock.confirmPendingEmail).toHaveBeenCalledWith(
        USER_ID,
        NEW_EMAIL,
      );
    });

    it('throws BadRequestException when the token is not found', async () => {
      (usersServiceMock.findByPendingEmailToken as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.confirmEmailChange('unknown-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the token has expired', async () => {
      (usersServiceMock.findByPendingEmailToken as jest.Mock).mockResolvedValue(
        {
          id: USER_ID,
          pendingEmail: NEW_EMAIL,
          pendingEmailToken: PENDING_EMAIL_TOKEN,
          pendingEmailTokenExpiresAt: new Date(Date.now() - 1000),
        },
      );

      await expect(
        service.confirmEmailChange(PENDING_EMAIL_TOKEN),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when pendingEmail is missing', async () => {
      (usersServiceMock.findByPendingEmailToken as jest.Mock).mockResolvedValue(
        {
          id: USER_ID,
          pendingEmail: null,
          pendingEmailToken: PENDING_EMAIL_TOKEN,
          pendingEmailTokenExpiresAt: new Date(Date.now() + 3600000),
        },
      );

      await expect(
        service.confirmEmailChange(PENDING_EMAIL_TOKEN),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
