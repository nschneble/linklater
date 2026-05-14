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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../prisma/generated/client';

import { AuthService } from './auth.service';
import { EmailTwoFactorService } from './email-2fa.service';
import { TotpService } from './totp.service';
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
    disableTwoFactor: jest.fn(),
    findByEmail: jest.fn(),
    findByIdWithPasswordHash: jest.fn(),
    findByPendingEmailToken: jest.fn(),
    findByResetToken: jest.fn(),
    findByVerificationToken: jest.fn(),
    findById: jest.fn(),
    findOAuthAccount: jest.fn(),
    findUnusedRecoveryCodes: jest.fn(),
    linkOAuthAccount: jest.fn(),
    markEmailVerified: jest.fn(),
    markRecoveryCodeUsed: jest.fn(),
    reissueRecoveryCodes: jest.fn(),
    resetPasswordWithToken: jest.fn(),
    updatePendingEmail: jest.fn(),
    updateResetToken: jest.fn(),
    updateVerificationToken: jest.fn(),
  } as unknown as UsersService;

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue(SIGNED_TOKEN),
  } as unknown as JwtService;

  const emailServiceMock = {
    sendEmailChangeVerification: jest.fn(),
    sendPasswordReset: jest.fn(),
    sendVerification: jest.fn(),
  } as unknown as EmailService;

  const emailTwoFactorServiceMock = {
    sendCode: jest.fn().mockResolvedValue(undefined),
    verifyCode: jest.fn(),
  } as unknown as EmailTwoFactorService;

  const totpServiceMock = {
    verifyCode: jest.fn(),
  } as unknown as TotpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: EmailTwoFactorService, useValue: emailTwoFactorServiceMock },
        { provide: TotpService, useValue: totpServiceMock },
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
      const user = { id: USER_ID, email: USER_EMAIL, theme: 'scanner-darkly' };
      (usersServiceMock.create as jest.Mock).mockResolvedValue(user);
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(user);
      (usersServiceMock.updateVerificationToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendVerification as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.register(USER_EMAIL, KNOWN_PASSWORD);

      expect(usersServiceMock.create).toHaveBeenCalledWith(
        USER_EMAIL,
        KNOWN_PASSWORD,
      );
      expect(emailServiceMock.sendVerification).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.any(String),
        'scanner-darkly',
      );
      expect(result).toBe(user);
    });
  });

  describe('me', () => {
    it('returns user with id remapped to userId and 2FA status fields', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        createdAt: new Date(),
        updatedAt: new Date(),
        totpSecret: null,
        totpEnabledAt: null,
        totpVerifiedAt: null,
        emailTwoFactorEnabledAt: null,
      });

      const result = await service.me(USER_ID);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
      expect(result).not.toHaveProperty('id');
      expect(result.userId).toBe(USER_ID);
      expect(result.email).toBe(USER_EMAIL);
      expect(result.twoFactorMethod).toBeNull();
      expect(result.twoFactorPending).toBe(false);
      expect(result).not.toHaveProperty('totpSecret');
    });

    it('returns twoFactorMethod totp when totpEnabledAt is set', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpSecret: 'encrypted-secret',
        totpEnabledAt: new Date(),
        totpVerifiedAt: new Date(),
        emailTwoFactorEnabledAt: null,
      });

      const result = await service.me(USER_ID);

      expect(result.twoFactorMethod).toBe('totp');
      expect(result.twoFactorPending).toBe(false);
    });

    it('returns twoFactorPending true when totpSecret is set but totpEnabledAt is null', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpSecret: 'encrypted-secret',
        totpEnabledAt: null,
        totpVerifiedAt: null,
        emailTwoFactorEnabledAt: null,
      });

      const result = await service.me(USER_ID);

      expect(result.twoFactorMethod).toBeNull();
      expect(result.twoFactorPending).toBe(true);
    });

    it('returns twoFactorMethod email when emailTwoFactorEnabledAt is set', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpSecret: null,
        totpEnabledAt: null,
        totpVerifiedAt: null,
        emailTwoFactorEnabledAt: new Date(),
      });

      const result = await service.me(USER_ID);

      expect(result.twoFactorMethod).toBe('email');
      expect(result.twoFactorPending).toBe(false);
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
    it('returns an accessToken when 2FA is not enabled', async () => {
      const result = await service.login({
        email: USER_EMAIL,
        userId: USER_ID,
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        email: USER_EMAIL,
        subject: USER_ID,
      });
      expect(result).toEqual({ accessToken: SIGNED_TOKEN });
    });

    it('returns mfaToken and mfaMethod totp when totpEnabledAt is set', async () => {
      const result = await service.login({
        email: USER_EMAIL,
        userId: USER_ID,
        totpEnabledAt: new Date(),
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        { subject: USER_ID, mfaPending: true },
        { expiresIn: '5m' },
      );
      expect(result).toEqual({ mfaToken: SIGNED_TOKEN, mfaMethod: 'totp' });
      expect(emailTwoFactorServiceMock.sendCode).not.toHaveBeenCalled();
    });

    it('returns mfaToken and mfaMethod email when emailTwoFactorEnabledAt is set and sends code', async () => {
      const result = await service.login({
        email: USER_EMAIL,
        userId: USER_ID,
        emailTwoFactorEnabledAt: new Date(),
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        { subject: USER_ID, mfaPending: true },
        { expiresIn: '5m' },
      );
      expect(result).toEqual({ mfaToken: SIGNED_TOKEN, mfaMethod: 'email' });
      expect(emailTwoFactorServiceMock.sendCode).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID, email: USER_EMAIL }),
      );
    });
  });

  describe('sendVerificationEmail', () => {
    it('stores a verification token and sends an email', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'before-sunrise',
      });
      (usersServiceMock.updateVerificationToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendVerification as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.sendVerificationEmail(USER_ID);

      expect(usersServiceMock.updateVerificationToken).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.any(Date),
      );
      expect(emailServiceMock.sendVerification).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.any(String),
        'before-sunrise',
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

    it('throws BadRequestException when verificationTokenExpiresAt is null', async () => {
      (usersServiceMock.findByVerificationToken as jest.Mock).mockResolvedValue(
        {
          id: USER_ID,
          verificationToken: VERIFICATION_TOKEN,
          verificationTokenExpiresAt: null,
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
        theme: 'hit-man',
      });
      (usersServiceMock.updateResetToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendPasswordReset as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.forgotPassword(USER_EMAIL);

      expect(usersServiceMock.updateResetToken).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.any(Date),
      );
      expect(emailServiceMock.sendPasswordReset).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.any(String),
        'hit-man',
      );
    });

    it('does nothing silently when the user is not found (prevents email enumeration)', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        service.forgotPassword('unknown@example.com'),
      ).resolves.not.toThrow();
      expect(usersServiceMock.updateResetToken).not.toHaveBeenCalled();
      expect(emailServiceMock.sendPasswordReset).not.toHaveBeenCalled();
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

    it('throws BadRequestException when resetTokenExpiresAt is null', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        resetToken: RESET_TOKEN,
        resetTokenExpiresAt: null,
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
        theme: 'boyhood',
      });
      (usersServiceMock.updateVerificationToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendVerification as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.resendVerificationEmail(USER_ID);

      expect(usersServiceMock.updateVerificationToken).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.any(Date),
      );
      expect(emailServiceMock.sendVerification).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.any(String),
        'boyhood',
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
    const makeUserNoTwoFactor = (overrides = {}) => ({
      id: USER_ID,
      email: USER_EMAIL,
      theme: 'dazed-and-confused',
      totpEnabledAt: null,
      emailTwoFactorEnabledAt: null,
      ...overrides,
    });

    it('stores pending email and sends a verification email to the new address', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor(),
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.updatePendingEmail as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        emailServiceMock.sendEmailChangeVerification as jest.Mock
      ).mockResolvedValue(undefined);

      await service.requestEmailChange(USER_ID, NEW_EMAIL);

      expect(usersServiceMock.updatePendingEmail).toHaveBeenCalledWith(
        USER_ID,
        NEW_EMAIL,
        expect.any(String),
        expect.any(Date),
      );
      expect(emailServiceMock.sendEmailChangeVerification).toHaveBeenCalledWith(
        NEW_EMAIL,
        expect.any(String),
        'dazed-and-confused',
      );
    });

    it('throws ConflictException when the new email is already in use', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor(),
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: 'other-user',
        email: NEW_EMAIL,
      });

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL),
      ).rejects.toThrow(ConflictException);
    });

    it('allows the request when the new email belongs to the same user (re-verify)', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor(),
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: NEW_EMAIL,
      });
      (usersServiceMock.updatePendingEmail as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        emailServiceMock.sendEmailChangeVerification as jest.Mock
      ).mockResolvedValue(undefined);

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL),
      ).resolves.not.toThrow();
    });

    it('throws ForbiddenException when 2FA is enabled and no code is provided', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ totpEnabledAt: new Date() }),
      );

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows email change when 2FA is enabled and valid TOTP code is provided', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ totpEnabledAt: new Date() }),
      );
      (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(true);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.updatePendingEmail as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        emailServiceMock.sendEmailChangeVerification as jest.Mock
      ).mockResolvedValue(undefined);

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL, '123456'),
      ).resolves.not.toThrow();

      expect(totpServiceMock.verifyCode).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID }),
        '123456',
      );
    });

    it('throws UnauthorizedException when 2FA is enabled and TOTP code is invalid', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ totpEnabledAt: new Date() }),
      );
      (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(false);

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL, '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when Email 2FA is enabled and no code is provided', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ emailTwoFactorEnabledAt: new Date() }),
      );

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows email change when Email 2FA is enabled and valid email code is provided', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ emailTwoFactorEnabledAt: new Date() }),
      );
      (emailTwoFactorServiceMock.verifyCode as jest.Mock).mockResolvedValue(
        true,
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.updatePendingEmail as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        emailServiceMock.sendEmailChangeVerification as jest.Mock
      ).mockResolvedValue(undefined);

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL, '123456'),
      ).resolves.not.toThrow();

      expect(emailTwoFactorServiceMock.verifyCode).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID }),
        '123456',
      );
    });

    it('throws UnauthorizedException when Email 2FA is enabled and email code is invalid', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ emailTwoFactorEnabledAt: new Date() }),
      );
      (emailTwoFactorServiceMock.verifyCode as jest.Mock).mockResolvedValue(
        false,
      );

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL, '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('allows email change using a recovery code when 2FA is enabled', async () => {
      const REAUTH_RECOVERY_CODE = 'aaaaa-bbbbb-ccccc';
      const realHash = await bcrypt.hash(REAUTH_RECOVERY_CODE, 1);
      const codeId = 'rc-email-1';

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ totpEnabledAt: new Date() }),
      );
      (usersServiceMock.findUnusedRecoveryCodes as jest.Mock).mockResolvedValue(
        [{ id: codeId, codeHash: realHash }],
      );
      (usersServiceMock.markRecoveryCodeUsed as jest.Mock).mockResolvedValue(
        undefined,
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.updatePendingEmail as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        emailServiceMock.sendEmailChangeVerification as jest.Mock
      ).mockResolvedValue(undefined);

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL, REAUTH_RECOVERY_CODE),
      ).resolves.not.toThrow();

      expect(usersServiceMock.markRecoveryCodeUsed).toHaveBeenCalledWith(
        codeId,
      );
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

    it('throws BadRequestException when pendingEmailTokenExpiresAt is null', async () => {
      (usersServiceMock.findByPendingEmailToken as jest.Mock).mockResolvedValue(
        {
          id: USER_ID,
          pendingEmail: NEW_EMAIL,
          pendingEmailToken: PENDING_EMAIL_TOKEN,
          pendingEmailTokenExpiresAt: null,
        },
      );

      await expect(
        service.confirmEmailChange(PENDING_EMAIL_TOKEN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyOtp', () => {
    const RECOVERY_CODE_STUB = 'aaaaa-bbbbb';

    describe('totp method', () => {
      it('returns accessToken when TOTP code is valid', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: new Date(),
          emailTwoFactorEnabledAt: null,
        });
        (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(true);

        const result = await service.verifyOtp(USER_ID, '123456', 'totp');

        expect(totpServiceMock.verifyCode).toHaveBeenCalledWith(
          expect.objectContaining({ id: USER_ID }),
          '123456',
        );
        expect(result).toHaveProperty('accessToken');
      });

      it('throws UnauthorizedException when TOTP code is invalid', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: new Date(),
          emailTwoFactorEnabledAt: null,
        });
        (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(false);

        await expect(
          service.verifyOtp(USER_ID, '000000', 'totp'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException when email 2FA user submits totp method', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: null,
          emailTwoFactorEnabledAt: new Date(),
        });

        await expect(
          service.verifyOtp(USER_ID, '123456', 'totp'),
        ).rejects.toThrow(UnauthorizedException);

        expect(totpServiceMock.verifyCode).not.toHaveBeenCalled();
      });
    });

    describe('email method', () => {
      it('returns accessToken when email code is valid', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          emailTwoFactorEnabledAt: new Date(),
        });
        (emailTwoFactorServiceMock.verifyCode as jest.Mock).mockResolvedValue(
          true,
        );

        const result = await service.verifyOtp(USER_ID, '123456', 'email');

        expect(emailTwoFactorServiceMock.verifyCode).toHaveBeenCalledWith(
          expect.objectContaining({ id: USER_ID }),
          '123456',
        );
        expect(result).toHaveProperty('accessToken');
      });

      it('throws UnauthorizedException when emailTwoFactorEnabledAt is not set', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: null,
          emailTwoFactorEnabledAt: null,
        });

        await expect(
          service.verifyOtp(USER_ID, '123456', 'email'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException when TOTP user submits email method', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: new Date(),
          emailTwoFactorEnabledAt: null,
        });

        await expect(
          service.verifyOtp(USER_ID, '123456', 'email'),
        ).rejects.toThrow(UnauthorizedException);

        expect(emailTwoFactorServiceMock.verifyCode).not.toHaveBeenCalled();
      });

      it('throws UnauthorizedException when email code is invalid', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          emailTwoFactorEnabledAt: new Date(),
        });
        (emailTwoFactorServiceMock.verifyCode as jest.Mock).mockResolvedValue(
          false,
        );

        await expect(
          service.verifyOtp(USER_ID, '000000', 'email'),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('recovery method', () => {
      it('marks the matching code used and returns accessToken', async () => {
        const codeId = 'rc-1';

        const bcrypt = await import('bcryptjs');
        const realHash = await bcrypt.hash(RECOVERY_CODE_STUB, 1);

        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: new Date(),
          emailTwoFactorEnabledAt: null,
        });
        (
          usersServiceMock.findUnusedRecoveryCodes as jest.Mock
        ).mockResolvedValue([{ id: codeId, codeHash: realHash }]);
        (usersServiceMock.markRecoveryCodeUsed as jest.Mock).mockResolvedValue(
          undefined,
        );

        const result = await service.verifyOtp(
          USER_ID,
          RECOVERY_CODE_STUB,
          'recovery',
        );

        expect(usersServiceMock.markRecoveryCodeUsed).toHaveBeenCalledWith(
          codeId,
        );
        expect(result).toHaveProperty('accessToken');
      });

      it('throws UnauthorizedException when no code matches', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: new Date(),
          emailTwoFactorEnabledAt: null,
        });
        (
          usersServiceMock.findUnusedRecoveryCodes as jest.Mock
        ).mockResolvedValue([]);

        await expect(
          service.verifyOtp(USER_ID, RECOVERY_CODE_STUB, 'recovery'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException when code does not match any hash', async () => {
        const bcrypt = await import('bcryptjs');
        const differentHash = await bcrypt.hash('zzzzz-zzzzz', 1);
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: new Date(),
          emailTwoFactorEnabledAt: null,
        });
        (
          usersServiceMock.findUnusedRecoveryCodes as jest.Mock
        ).mockResolvedValue([{ id: 'rc-1', codeHash: differentHash }]);

        await expect(
          service.verifyOtp(USER_ID, RECOVERY_CODE_STUB, 'recovery'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException when no 2FA method is enrolled', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: null,
          emailTwoFactorEnabledAt: null,
        });

        await expect(
          service.verifyOtp(USER_ID, RECOVERY_CODE_STUB, 'recovery'),
        ).rejects.toThrow(UnauthorizedException);
      });
    });
  });

  describe('disable2fa', () => {
    it('disables 2FA when currentPassword is valid', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        hasPassword: true,
        passwordHash: KNOWN_PASSWORD_HASH,
        totpEnabledAt: null,
        emailTwoFactorEnabledAt: null,
      });
      (usersServiceMock.disableTwoFactor as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.disable2fa(USER_ID, KNOWN_PASSWORD);

      expect(usersServiceMock.disableTwoFactor).toHaveBeenCalledWith(USER_ID);
    });

    it('disables 2FA when TOTP code is valid', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
        emailTwoFactorEnabledAt: null,
      });
      (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(true);
      (usersServiceMock.disableTwoFactor as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.disable2fa(USER_ID, undefined, '123456');

      expect(totpServiceMock.verifyCode).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID }),
        '123456',
      );
      expect(usersServiceMock.disableTwoFactor).toHaveBeenCalledWith(USER_ID);
    });

    it('disables 2FA using a recovery code', async () => {
      const REAUTH_RECOVERY_CODE = 'aaaaa-bbbbb-ccccc';
      const realHash = await bcrypt.hash(REAUTH_RECOVERY_CODE, 1);
      const codeId = 'rc-reauth-1';

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
        emailTwoFactorEnabledAt: null,
      });
      (usersServiceMock.findUnusedRecoveryCodes as jest.Mock).mockResolvedValue(
        [{ id: codeId, codeHash: realHash }],
      );
      (usersServiceMock.markRecoveryCodeUsed as jest.Mock).mockResolvedValue(
        undefined,
      );
      (usersServiceMock.disableTwoFactor as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.disable2fa(USER_ID, undefined, REAUTH_RECOVERY_CODE);

      expect(usersServiceMock.markRecoveryCodeUsed).toHaveBeenCalledWith(
        codeId,
      );
      expect(usersServiceMock.disableTwoFactor).toHaveBeenCalledWith(USER_ID);
    });

    it('throws BadRequestException when neither credential is provided', async () => {
      await expect(service.disable2fa(USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        hasPassword: true,
        passwordHash: KNOWN_PASSWORD_HASH,
        totpEnabledAt: null,
        emailTwoFactorEnabledAt: null,
      });

      await expect(
        service.disable2fa(USER_ID, UNKNOWN_PASSWORD),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the account has no password', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: null,
        emailTwoFactorEnabledAt: null,
      });

      await expect(service.disable2fa(USER_ID, KNOWN_PASSWORD)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
        emailTwoFactorEnabledAt: null,
      });
      (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(false);

      await expect(
        service.disable2fa(USER_ID, undefined, '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when recovery code does not match', async () => {
      const REAUTH_RECOVERY_CODE = 'aaaaa-bbbbb-ccccc';
      const differentHash = await bcrypt.hash('zzzzz-zzzzz-zzzzz', 1);

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
        emailTwoFactorEnabledAt: null,
      });
      (usersServiceMock.findUnusedRecoveryCodes as jest.Mock).mockResolvedValue(
        [{ id: 'rc-1', codeHash: differentHash }],
      );

      await expect(
        service.disable2fa(USER_ID, undefined, REAUTH_RECOVERY_CODE),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('regenerateRecoveryCodes', () => {
    it('returns new recovery codes when password is valid', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        hasPassword: true,
        passwordHash: KNOWN_PASSWORD_HASH,
        totpEnabledAt: null,
        emailTwoFactorEnabledAt: null,
      });
      (usersServiceMock.reissueRecoveryCodes as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.regenerateRecoveryCodes(
        USER_ID,
        KNOWN_PASSWORD,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(10);
      expect(usersServiceMock.reissueRecoveryCodes).toHaveBeenCalledWith(
        USER_ID,
        expect.arrayContaining([expect.any(String)]),
      );
    });

    it('throws BadRequestException when neither credential is provided', async () => {
      await expect(service.regenerateRecoveryCodes(USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        hasPassword: true,
        passwordHash: KNOWN_PASSWORD_HASH,
        totpEnabledAt: null,
        emailTwoFactorEnabledAt: null,
      });

      await expect(
        service.regenerateRecoveryCodes(USER_ID, UNKNOWN_PASSWORD),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('sendReauthEmailCode', () => {
    it('sends email code to the enrolled email address', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailTwoFactorEnabledAt: new Date(),
      });

      await service.sendReauthEmailCode(USER_ID);

      expect(emailTwoFactorServiceMock.sendCode).toHaveBeenCalledWith(
        expect.objectContaining({ email: USER_EMAIL }),
      );
    });

    it('throws BadRequestException when Email 2FA is not enabled', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailTwoFactorEnabledAt: null,
      });

      await expect(service.sendReauthEmailCode(USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
