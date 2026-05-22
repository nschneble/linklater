import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { MagicLinkService } from './magic-link.service';
import { TotpService } from './totp.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

const KNOWN_PASSWORD = 'open-sesame';
const KNOWN_PASSWORD_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);
const NEW_PASSWORD = 'new-secure-password-123';
const SIGNED_TOKEN = 'signed-token';
const UNKNOWN_PASSWORD = 'open-poppy-seed';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    clearVerificationToken: jest.fn(),
    confirmPendingEmail: jest.fn(),
    create: jest.fn(),
    createOAuthUser: jest.fn(),
    createOAuthUserAndLink: jest.fn(),
    disableTwoFactor: jest.fn(),
    findByEmail: jest.fn(),
    findByIdWithPasswordHash: jest.fn(),
    findByMagicLinkToken: jest.fn(),
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
    markWelcomed: jest.fn(),
    reissueRecoveryCodes: jest.fn(),
    resetPasswordWithToken: jest.fn(),
    saveTotpSecret: jest.fn(),
    setFirstPassword: jest.fn(),
    unlinkOAuthAccount: jest.fn(),
    updateMagicLinkToken: jest.fn(),
    updatePendingEmail: jest.fn(),
    updateResetToken: jest.fn(),
    updateTotpLastUsedStep: jest.fn(),
    updateVerificationToken: jest.fn(),
  } as unknown as UsersService;

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue(SIGNED_TOKEN),
  } as unknown as JwtService;

  const emailVerificationServiceMock = {
    sendVerificationEmail: jest.fn(),
  } as unknown as EmailVerificationService;

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
      deleteMany: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    // Invoke the transaction callback with the same mock client so existing
    // assertions on refreshToken.{delete,create} still match.
    $transaction: jest
      .fn()
      .mockImplementation(
        async (
          callback: (transaction: typeof prismaServiceMock) => Promise<unknown>,
        ) => callback(prismaServiceMock),
      ),
  } as unknown as PrismaService & {
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        {
          provide: EmailVerificationService,
          useValue: emailVerificationServiceMock,
        },
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
      (
        emailVerificationServiceMock.sendVerificationEmail as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.register(USER_EMAIL, KNOWN_PASSWORD);

      expect(usersServiceMock.create).toHaveBeenCalledWith(
        USER_EMAIL,
        KNOWN_PASSWORD,
      );
      expect(
        emailVerificationServiceMock.sendVerificationEmail,
      ).toHaveBeenCalledWith(USER_ID);
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
        { provider: 'google', connectedAt },
      ]);

      const result = await service.me(USER_ID);

      expect(result.connectedProviders).toEqual([
        { provider: 'google', connectedAt },
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

  describe('login', () => {
    it('returns an accessToken and refreshToken when 2FA is not enabled', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: null,
      });

      const result = await service.login(USER_ID);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
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
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: new Date(),
      });

      const result = await service.login(USER_ID);

      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        { subject: USER_ID, mfaPending: true },
        { expiresIn: '5m' },
      );
      expect(result).toEqual({ mfaToken: SIGNED_TOKEN, mfaMethod: 'totp' });
      expect(prismaServiceMock.refreshToken.create).not.toHaveBeenCalled();
    });

    it('forces MFA even when the caller supplies only a userId — closing the OAuth-strategy bypass', async () => {
      // Regression for the audit finding: previously the OAuth path called
      // login(request.user) where request.user lacked totpEnabledAt, so the
      // MFA branch never fired. login(userId) now fetches internally.
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: new Date('2024-01-01'),
      });

      const result = await service.login(USER_ID);

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

      expect(
        (prismaServiceMock as unknown as { $transaction: jest.Mock })
          .$transaction,
      ).toHaveBeenCalledTimes(1);
      expect(prismaServiceMock.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
      expect(prismaServiceMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_ID }),
        }),
      );
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

    it('propagates failure from the create half of the rotation so prisma rolls back the delete', async () => {
      // The delete + create live inside the same $transaction callback, so a
      // throw inside create bubbles out and the surrounding tx is rolled back.
      (
        prismaServiceMock.refreshToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'rt-1',
        userId: USER_ID,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { id: USER_ID, email: USER_EMAIL },
      });
      (
        prismaServiceMock.refreshToken.create as jest.Mock
      ).mockRejectedValueOnce(new Error('db down'));

      await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
        'db down',
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

        const bcryptModule = await import('bcryptjs');
        const realHash = await bcryptModule.hash(RECOVERY_CODE_STUB, 1);

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
        const bcryptModule = await import('bcryptjs');
        const differentHash = await bcryptModule.hash('zzzzz-zzzzz', 1);
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

  describe('verifyOtp (edge: exhaustion guard)', () => {
    it('throws UnauthorizedException when method bypasses both totp and recovery branches at runtime', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: null,
      });

      await expect(
        service.verifyOtp(
          USER_ID,
          '123456',
          null as unknown as 'totp' | 'recovery',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('reauthenticate (via disable2fa / regenerateRecoveryCodes)', () => {
    it('throws UnauthorizedException when a recovery-code-shaped string is provided but no 2FA is enrolled', async () => {
      const RECOVERY_CODE_STUB = 'aaaaa-bbbbb-ccccc';

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: null,
      });

      await expect(
        service.disable2fa(USER_ID, undefined, RECOVERY_CODE_STUB),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when a plain OTP code is provided but no 2FA is enrolled', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: null,
      });

      await expect(
        service.disable2fa(USER_ID, undefined, '123456'),
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
    it('returns accessToken and refreshToken when the token is valid and 2FA is not enabled', async () => {
      (magicLinkServiceMock.verifyToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: null,
      });

      const result = await service.verifyMagicLink('valid-token');

      expect(magicLinkServiceMock.verifyToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('returns an MFA challenge instead of a full session when 2FA is enabled', async () => {
      // Magic-link verification now routes through login(), so a TOTP-enrolled
      // user cannot bypass MFA simply by clicking a magic link.
      (magicLinkServiceMock.verifyToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: new Date('2024-01-01'),
      });

      const result = await service.verifyMagicLink('valid-token');

      expect(result).toEqual({ mfaToken: SIGNED_TOKEN, mfaMethod: 'totp' });
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

  describe('markWelcomed', () => {
    it('delegates to usersService.markWelcomed', async () => {
      (usersServiceMock.markWelcomed as jest.Mock).mockResolvedValue(undefined);

      await service.markWelcomed(USER_ID);

      expect(usersServiceMock.markWelcomed).toHaveBeenCalledWith(USER_ID);
    });
  });
});
