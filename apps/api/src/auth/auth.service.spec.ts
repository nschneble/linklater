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
import { MagicLinkService } from './magic-link.service';
import { TotpService } from './totp.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

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
    listOAuthAccounts: jest.fn(),
    markEmailVerified: jest.fn(),
    markRecoveryCodeUsed: jest.fn(),
    reissueRecoveryCodes: jest.fn(),
    resetPasswordWithToken: jest.fn(),
    setFirstPassword: jest.fn(),
    unlinkOAuthAccount: jest.fn(),
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

  const magicLinkServiceMock = {
    requestLogin: jest.fn().mockResolvedValue(undefined),
    requestSignup: jest.fn().mockResolvedValue(undefined),
    verifyToken: jest.fn(),
  } as unknown as MagicLinkService;

  const totpServiceMock = {
    verifyCode: jest.fn(),
  } as unknown as TotpService;

  const prismaServiceMock = {
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    extensionAuthCode: {
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: MagicLinkService, useValue: magicLinkServiceMock },
        { provide: TotpService, useValue: totpServiceMock },
        { provide: PrismaService, useValue: prismaServiceMock },
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
    beforeEach(() => {
      (usersServiceMock.listOAuthAccounts as jest.Mock).mockResolvedValue([]);
    });

    it('returns user with id remapped to userId and 2FA status fields', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        createdAt: new Date(),
        updatedAt: new Date(),
        totpSecret: null,
        totpEnabledAt: null,
        totpVerifiedAt: null,
        magicLinkToken: null,
        magicLinkTokenExpiresAt: null,
      });

      const result = await service.me(USER_ID);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
      expect(result).not.toHaveProperty('id');
      expect(result.userId).toBe(USER_ID);
      expect(result.email).toBe(USER_EMAIL);
      expect(result.twoFactorMethod).toBeNull();
      expect(result.twoFactorPending).toBe(false);
      expect(result).not.toHaveProperty('totpSecret');
      expect(result).not.toHaveProperty('magicLinkToken');
    });

    it('returns twoFactorMethod totp when totpEnabledAt is set', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpSecret: 'encrypted-secret',
        totpEnabledAt: new Date(),
        totpVerifiedAt: new Date(),
        magicLinkToken: null,
        magicLinkTokenExpiresAt: null,
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
        magicLinkToken: null,
        magicLinkTokenExpiresAt: null,
      });

      const result = await service.me(USER_ID);

      expect(result.twoFactorMethod).toBeNull();
      expect(result.twoFactorPending).toBe(true);
    });

    it('includes connectedProviders from listOAuthAccounts', async () => {
      const connectedAt = new Date();
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpSecret: null,
        totpEnabledAt: null,
        totpVerifiedAt: null,
        magicLinkToken: null,
        magicLinkTokenExpiresAt: null,
      });
      (usersServiceMock.listOAuthAccounts as jest.Mock).mockResolvedValue([
        { provider: OAUTH_PROVIDER, connectedAt },
      ]);

      const result = await service.me(USER_ID);

      expect(result.connectedProviders).toEqual([
        { provider: OAUTH_PROVIDER, connectedAt },
      ]);
    });

    it('returns empty connectedProviders when no OAuth accounts are linked', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpSecret: null,
        totpEnabledAt: null,
        totpVerifiedAt: null,
        magicLinkToken: null,
        magicLinkTokenExpiresAt: null,
      });
      (usersServiceMock.listOAuthAccounts as jest.Mock).mockResolvedValue([]);

      const result = await service.me(USER_ID);

      expect(result.connectedProviders).toEqual([]);
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
    it('returns an accessToken and refreshToken when 2FA is not enabled', async () => {
      const result = await service.login({
        email: USER_EMAIL,
        userId: USER_ID,
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        email: USER_EMAIL,
        subject: USER_ID,
      });
      expect(result).toHaveProperty('accessToken', SIGNED_TOKEN);
      expect(result).toHaveProperty('refreshToken');
      expect(typeof (result as { refreshToken: string }).refreshToken).toBe(
        'string',
      );
      expect(prismaServiceMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_ID }),
        }),
      );
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
      expect(prismaServiceMock.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const RAW_REFRESH_TOKEN = 'a'.repeat(64);

    it('returns a new token pair when the refresh token is valid', async () => {
      (
        prismaServiceMock.refreshToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'rt-1',
        userId: USER_ID,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { id: USER_ID, email: USER_EMAIL },
      });

      const result = await service.refresh(RAW_REFRESH_TOKEN);

      expect(prismaServiceMock.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
      expect(result).toHaveProperty('accessToken', SIGNED_TOKEN);
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws UnauthorizedException when the refresh token is not found', async () => {
      (
        prismaServiceMock.refreshToken.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the refresh token is expired', async () => {
      (
        prismaServiceMock.refreshToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'rt-1',
        userId: USER_ID,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: USER_ID, email: USER_EMAIL },
      });

      await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeAllRefreshTokens', () => {
    it('deletes all refresh tokens for the user', async () => {
      await service.revokeAllRefreshTokens(USER_ID);

      expect(prismaServiceMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
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

    it('calls markEmailVerified when the user email is not yet verified', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        emailVerifiedAt: null,
        resetToken: RESET_TOKEN,
        resetTokenExpiresAt: new Date(Date.now() + 3600000),
      });
      (usersServiceMock.resetPasswordWithToken as jest.Mock).mockResolvedValue(
        undefined,
      );
      (usersServiceMock.markEmailVerified as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.resetPassword(RESET_TOKEN, NEW_PASSWORD);

      expect(usersServiceMock.markEmailVerified).toHaveBeenCalledWith(USER_ID);
    });

    it('does not call markEmailVerified when the email is already verified', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        emailVerifiedAt: new Date(),
        resetToken: RESET_TOKEN,
        resetTokenExpiresAt: new Date(Date.now() + 3600000),
      });
      (usersServiceMock.resetPasswordWithToken as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.resetPassword(RESET_TOKEN, NEW_PASSWORD);

      expect(usersServiceMock.markEmailVerified).not.toHaveBeenCalled();
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

    it('throws ConflictException before consuming a 2FA credential when the new email is taken', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ totpEnabledAt: new Date() }),
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: 'other-user',
        email: NEW_EMAIL,
      });

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL, '123456'),
      ).rejects.toThrow(ConflictException);

      expect(totpServiceMock.verifyCode).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when 2FA is enabled and no code is provided', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ totpEnabledAt: new Date() }),
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

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
      it('returns accessToken and refreshToken when TOTP code is valid', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: new Date(),
        });
        (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(true);

        const result = await service.verifyOtp(USER_ID, '123456', 'totp');

        expect(totpServiceMock.verifyCode).toHaveBeenCalledWith(
          expect.objectContaining({ id: USER_ID }),
          '123456',
        );
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
      });

      it('throws UnauthorizedException when TOTP code is invalid', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: new Date(),
        });
        (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(false);

        await expect(
          service.verifyOtp(USER_ID, '000000', 'totp'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException when no 2FA is enrolled and totp method is submitted', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: null,
        });

        await expect(
          service.verifyOtp(USER_ID, '123456', 'totp'),
        ).rejects.toThrow(UnauthorizedException);

        expect(totpServiceMock.verifyCode).not.toHaveBeenCalled();
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
        expect(result).toHaveProperty('refreshToken');
      });

      it('throws UnauthorizedException when no code matches', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          totpEnabledAt: new Date(),
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
      });

      await expect(
        service.regenerateRecoveryCodes(USER_ID, UNKNOWN_PASSWORD),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns new recovery codes when TOTP code is valid', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
      });
      (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(true);
      (usersServiceMock.reissueRecoveryCodes as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.regenerateRecoveryCodes(
        USER_ID,
        undefined,
        '123456',
      );

      expect(totpServiceMock.verifyCode).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID }),
        '123456',
      );
      expect(result).toHaveLength(10);
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
      });
      (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(false);

      await expect(
        service.regenerateRecoveryCodes(USER_ID, undefined, '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns new recovery codes when a valid recovery code is provided', async () => {
      const REAUTH_RECOVERY_CODE = 'aaaaa-bbbbb-ccccc';
      const realHash = await bcrypt.hash(REAUTH_RECOVERY_CODE, 1);
      const codeId = 'rc-regen-1';

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
      });
      (usersServiceMock.findUnusedRecoveryCodes as jest.Mock).mockResolvedValue(
        [{ id: codeId, codeHash: realHash }],
      );
      (usersServiceMock.markRecoveryCodeUsed as jest.Mock).mockResolvedValue(
        undefined,
      );
      (usersServiceMock.reissueRecoveryCodes as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.regenerateRecoveryCodes(
        USER_ID,
        undefined,
        REAUTH_RECOVERY_CODE,
      );

      expect(usersServiceMock.markRecoveryCodeUsed).toHaveBeenCalledWith(
        codeId,
      );
      expect(result).toHaveLength(10);
    });

    it('throws UnauthorizedException when the recovery code does not match', async () => {
      const REAUTH_RECOVERY_CODE = 'aaaaa-bbbbb-ccccc';
      const differentHash = await bcrypt.hash('zzzzz-zzzzz-zzzzz', 1);

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
      });
      (usersServiceMock.findUnusedRecoveryCodes as jest.Mock).mockResolvedValue(
        [{ id: 'rc-1', codeHash: differentHash }],
      );

      await expect(
        service.regenerateRecoveryCodes(
          USER_ID,
          undefined,
          REAUTH_RECOVERY_CODE,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('requestMagicLink', () => {
    it('delegates to magicLinkService.requestLogin', async () => {
      await service.requestMagicLink(USER_EMAIL);

      expect(magicLinkServiceMock.requestLogin).toHaveBeenCalledWith(
        USER_EMAIL,
      );
    });
  });

  describe('registerMagicLink', () => {
    it('delegates to magicLinkService.requestSignup', async () => {
      await service.registerMagicLink(USER_EMAIL);

      expect(magicLinkServiceMock.requestSignup).toHaveBeenCalledWith(
        USER_EMAIL,
      );
    });
  });

  describe('verifyMagicLink', () => {
    it('returns accessToken and refreshToken when the token is valid', async () => {
      (magicLinkServiceMock.verifyToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });

      const result = await service.verifyMagicLink('valid-token');

      expect(magicLinkServiceMock.verifyToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws BadRequestException when the token is invalid', async () => {
      (magicLinkServiceMock.verifyToken as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid or expired login link'),
      );

      await expect(service.verifyMagicLink('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setFirstPassword', () => {
    it('delegates to usersService.setFirstPassword', async () => {
      (usersServiceMock.setFirstPassword as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.setFirstPassword(USER_ID, NEW_PASSWORD);

      expect(usersServiceMock.setFirstPassword).toHaveBeenCalledWith(
        USER_ID,
        NEW_PASSWORD,
      );
    });
  });

  describe('unlinkOAuthProvider', () => {
    it('throws BadRequestException when the user has no password', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        hasPassword: false,
        passwordHash: null,
      });

      await expect(
        service.unlinkOAuthProvider(USER_ID, OAUTH_PROVIDER),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls unlinkOAuthAccount when the user has a password', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        hasPassword: true,
        passwordHash: KNOWN_PASSWORD_HASH,
      });
      (usersServiceMock.unlinkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.unlinkOAuthProvider(USER_ID, OAUTH_PROVIDER);

      expect(usersServiceMock.unlinkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
      );
    });
  });

  describe('linkOAuthAccountToUser', () => {
    it('throws BadRequestException when the provider email does not match the user email', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: null,
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);

      await expect(
        service.linkOAuthAccountToUser(
          USER_ID,
          OAUTH_PROVIDER,
          OAUTH_PROVIDER_ID,
          'other@example.com',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('links the provider when no existing account is found', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.linkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
      );
    });

    it('marks email verified when linking and email was not yet verified', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: null,
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );
      (usersServiceMock.markEmailVerified as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.markEmailVerified).toHaveBeenCalledWith(USER_ID);
    });

    it('does not mark email verified when it is already verified', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.markEmailVerified).not.toHaveBeenCalled();
    });

    it('is idempotent when the provider is already linked to the same user', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        provider: OAUTH_PROVIDER,
        providerId: OAUTH_PROVIDER_ID,
      });

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.linkOAuthAccount).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the provider is linked to a different user', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
        userId: 'different-user-id',
        provider: OAUTH_PROVIDER,
        providerId: OAUTH_PROVIDER_ID,
      });

      await expect(
        service.linkOAuthAccountToUser(
          USER_ID,
          OAUTH_PROVIDER,
          OAUTH_PROVIDER_ID,
          USER_EMAIL,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createExtensionAuthCode', () => {
    it('stores a hashed code and returns the raw code', async () => {
      const rawCode = await service.createExtensionAuthCode(
        USER_ID,
        'abc_challenge',
      );

      expect(typeof rawCode).toBe('string');
      expect(rawCode.length).toBeGreaterThan(0);
      expect(prismaServiceMock.extensionAuthCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            codeChallenge: 'abc_challenge',
          }),
        }),
      );
    });
  });

  describe('exchangeExtensionCode', () => {
    it('issues a token pair when code and PKCE verifier are valid', async () => {
      const rawCode = 'a'.repeat(64);
      const codeVerifier = 'valid-verifier';

      const { createHash } = await import('node:crypto');
      const codeChallenge = createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      (
        prismaServiceMock.extensionAuthCode.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'eac-1',
        userId: USER_ID,
        codeChallenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        user: { id: USER_ID, email: USER_EMAIL },
      });

      const result = await service.exchangeExtensionCode(rawCode, codeVerifier);

      expect(prismaServiceMock.extensionAuthCode.delete).toHaveBeenCalledWith({
        where: { id: 'eac-1' },
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws UnauthorizedException when the code is not found', async () => {
      (
        prismaServiceMock.extensionAuthCode.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.exchangeExtensionCode('bad-code', 'verifier'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the code is expired', async () => {
      (
        prismaServiceMock.extensionAuthCode.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'eac-1',
        userId: USER_ID,
        codeChallenge: 'challenge',
        expiresAt: new Date(Date.now() - 1000),
        user: { id: USER_ID, email: USER_EMAIL },
      });

      await expect(
        service.exchangeExtensionCode('any-code', 'any-verifier'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the PKCE verifier does not match', async () => {
      const { createHash } = await import('node:crypto');
      const realChallenge = createHash('sha256')
        .update('correct-verifier')
        .digest('base64url');

      (
        prismaServiceMock.extensionAuthCode.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'eac-1',
        userId: USER_ID,
        codeChallenge: realChallenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        user: { id: USER_ID, email: USER_EMAIL },
      });

      await expect(
        service.exchangeExtensionCode('any-code', 'wrong-verifier'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
