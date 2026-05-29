import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { MagicLinkService } from './magic-link.service';
import { RefreshTokenService } from './refresh-token.service';
import { TotpService } from './totp.service';
import { UsersService } from '../users/users.service';

const KNOWN_PASSWORD = 'open-sesame';
const KNOWN_PASSWORD_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);
const NEW_PASSWORD = 'new-secure-password-123';
const SIGNED_TOKEN = 'signed-token';
const UNKNOWN_PASSWORD = 'open-poppy-seed';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const MFA_NONCE = 'test-mfa-nonce';

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    clearVerificationToken: jest.fn(),
    confirmPendingEmail: jest.fn(),
    create: jest.fn(),
    createOAuthUser: jest.fn(),
    createOAuthUserAndLink: jest.fn(),
    disableMultiFactor: jest.fn(),
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
    setMfaNonce: jest.fn(),
    clearMfaNonce: jest.fn(),
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

  const refreshTokenServiceMock = {
    issueTokenPair: jest.fn().mockResolvedValue({
      accessToken: SIGNED_TOKEN,
      refreshToken: 'raw-refresh-token',
    }),
    refresh: jest.fn(),
    revokeAllRefreshTokens: jest.fn().mockResolvedValue(undefined),
  } as unknown as RefreshTokenService;

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
        { provide: RefreshTokenService, useValue: refreshTokenServiceMock },
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

    it('returns user with id remapped to userId and MFA status fields', async () => {
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
      expect(result.multiFactorMethod).toBeNull();
      expect(result.multiFactorPending).toBe(false);
      expect(result).not.toHaveProperty('totpSecret');
      expect(result).not.toHaveProperty('magicLinkToken');
    });

    it('returns multiFactorMethod totp when totpEnabledAt is set', async () => {
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

      expect(result.multiFactorMethod).toBe('totp');
      expect(result.multiFactorPending).toBe(false);
    });

    it('returns multiFactorPending true when totpSecret is set but totpEnabledAt is null', async () => {
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

      expect(result.multiFactorMethod).toBeNull();
      expect(result.multiFactorPending).toBe(true);
    });

    it('includes connectedProviders (with providerEmail) from listOAuthAccounts', async () => {
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
        { provider: 'google', providerEmail: USER_EMAIL, connectedAt },
      ]);

      const result = await service.me(USER_ID);

      expect(result.connectedProviders).toEqual([
        { provider: 'google', providerEmail: USER_EMAIL, connectedAt },
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
    it('returns an accessToken and refreshToken when MFA is not enabled', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: null,
      });
      (refreshTokenServiceMock.issueTokenPair as jest.Mock).mockResolvedValue({
        accessToken: SIGNED_TOKEN,
        refreshToken: 'raw-refresh-token',
      });

      const result = await service.login(USER_ID);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
      expect(refreshTokenServiceMock.issueTokenPair).toHaveBeenCalledWith(
        USER_ID,
        USER_EMAIL,
      );
      expect(result).toHaveProperty('accessToken', SIGNED_TOKEN);
      expect(result).toHaveProperty('refreshToken');
    });

    it('returns mfaToken and mfaMethod totp when totpEnabledAt is set, binding a fresh nonce', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: new Date(),
      });

      const result = await service.login(USER_ID);

      expect(usersServiceMock.setMfaNonce).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
      );
      const nonceWritten = (usersServiceMock.setMfaNonce as jest.Mock).mock
        .calls[0][1] as string;
      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        { subject: USER_ID, mfaPending: true, nonce: nonceWritten },
        { expiresIn: '5m' },
      );
      expect(result).toEqual({ mfaToken: SIGNED_TOKEN, mfaMethod: 'totp' });
      expect(refreshTokenServiceMock.issueTokenPair).not.toHaveBeenCalled();
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
      expect(refreshTokenServiceMock.issueTokenPair).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('delegates to RefreshTokenService.refresh', async () => {
      const tokenPair = {
        accessToken: SIGNED_TOKEN,
        refreshToken: 'new-raw-token',
      };
      (refreshTokenServiceMock.refresh as jest.Mock).mockResolvedValue(
        tokenPair,
      );

      const result = await service.refresh('old-raw-token');

      expect(refreshTokenServiceMock.refresh).toHaveBeenCalledWith(
        'old-raw-token',
      );
      expect(result).toBe(tokenPair);
    });
  });

  describe('revokeAllRefreshTokens', () => {
    it('delegates to RefreshTokenService.revokeAllRefreshTokens', async () => {
      await service.revokeAllRefreshTokens(USER_ID);

      expect(
        refreshTokenServiceMock.revokeAllRefreshTokens,
      ).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('verifyOtp', () => {
    const RECOVERY_CODE_STUB = 'aaaaa-bbbbb';

    describe('totp method', () => {
      it('returns accessToken and refreshToken when TOTP code is valid', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          mfaNonce: MFA_NONCE,
          totpEnabledAt: new Date(),
        });
        (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(true);

        const result = await service.verifyOtp(
          USER_ID,
          '123456',
          'totp',
          MFA_NONCE,
        );

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
          mfaNonce: MFA_NONCE,
          totpEnabledAt: new Date(),
        });
        (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(false);

        await expect(
          service.verifyOtp(USER_ID, '000000', 'totp', MFA_NONCE),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException when the MFA token nonce does not match the user row', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          mfaNonce: 'fresh-nonce',
          totpEnabledAt: new Date(),
        });

        await expect(
          service.verifyOtp(USER_ID, '123456', 'totp', 'stale-nonce'),
        ).rejects.toThrow(UnauthorizedException);
        expect(totpServiceMock.verifyCode).not.toHaveBeenCalled();
      });

      it('throws UnauthorizedException when the MFA token nonce is missing entirely', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          mfaNonce: MFA_NONCE,
          totpEnabledAt: new Date(),
        });

        await expect(
          service.verifyOtp(USER_ID, '123456', 'totp'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('clears mfaNonce after a successful TOTP verification', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          mfaNonce: MFA_NONCE,
          totpEnabledAt: new Date(),
        });
        (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(true);

        await service.verifyOtp(USER_ID, '123456', 'totp', MFA_NONCE);

        expect(usersServiceMock.clearMfaNonce).toHaveBeenCalledWith(USER_ID);
      });

      it('throws UnauthorizedException when no MFA is enrolled and totp method is submitted', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          mfaNonce: MFA_NONCE,
          totpEnabledAt: null,
        });

        await expect(
          service.verifyOtp(USER_ID, '123456', 'totp', MFA_NONCE),
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
          mfaNonce: MFA_NONCE,
          totpEnabledAt: new Date(),
        });
        (
          usersServiceMock.findUnusedRecoveryCodes as jest.Mock
        ).mockResolvedValue([{ id: codeId, codeHash: realHash }]);
        (usersServiceMock.markRecoveryCodeUsed as jest.Mock).mockResolvedValue(
          true,
        );

        const result = await service.verifyOtp(
          USER_ID,
          RECOVERY_CODE_STUB,
          'recovery',
          MFA_NONCE,
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
          mfaNonce: MFA_NONCE,
          totpEnabledAt: new Date(),
        });
        (
          usersServiceMock.findUnusedRecoveryCodes as jest.Mock
        ).mockResolvedValue([]);

        await expect(
          service.verifyOtp(USER_ID, RECOVERY_CODE_STUB, 'recovery', MFA_NONCE),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException when code does not match any hash', async () => {
        const bcryptModule = await import('bcryptjs');
        const differentHash = await bcryptModule.hash('zzzzz-zzzzz', 1);
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          mfaNonce: MFA_NONCE,
          totpEnabledAt: new Date(),
        });
        (
          usersServiceMock.findUnusedRecoveryCodes as jest.Mock
        ).mockResolvedValue([{ id: 'rc-1', codeHash: differentHash }]);

        await expect(
          service.verifyOtp(USER_ID, RECOVERY_CODE_STUB, 'recovery', MFA_NONCE),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException when no MFA method is enrolled', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          mfaNonce: MFA_NONCE,
          totpEnabledAt: null,
        });

        await expect(
          service.verifyOtp(USER_ID, RECOVERY_CODE_STUB, 'recovery', MFA_NONCE),
        ).rejects.toThrow(UnauthorizedException);
      });
    });
  });

  describe('disableMfa', () => {
    it('disables MFA when currentPassword is valid', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        hasPassword: true,
        passwordHash: KNOWN_PASSWORD_HASH,
        totpEnabledAt: null,
      });
      (usersServiceMock.disableMultiFactor as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.disableMfa(USER_ID, KNOWN_PASSWORD);

      expect(usersServiceMock.disableMultiFactor).toHaveBeenCalledWith(USER_ID);
    });

    it('disables MFA when TOTP code is valid', async () => {
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
      (usersServiceMock.disableMultiFactor as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.disableMfa(USER_ID, undefined, '123456');

      expect(totpServiceMock.verifyCode).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID }),
        '123456',
      );
      expect(usersServiceMock.disableMultiFactor).toHaveBeenCalledWith(USER_ID);
    });

    it('disables MFA using a recovery code', async () => {
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
        true,
      );
      (usersServiceMock.disableMultiFactor as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.disableMfa(USER_ID, undefined, REAUTH_RECOVERY_CODE);

      expect(usersServiceMock.markRecoveryCodeUsed).toHaveBeenCalledWith(
        codeId,
      );
      expect(usersServiceMock.disableMultiFactor).toHaveBeenCalledWith(USER_ID);
    });

    it('throws BadRequestException when neither credential is provided', async () => {
      await expect(service.disableMfa(USER_ID)).rejects.toThrow(
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
        service.disableMfa(USER_ID, UNKNOWN_PASSWORD),
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

      await expect(service.disableMfa(USER_ID, KNOWN_PASSWORD)).rejects.toThrow(
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
        service.disableMfa(USER_ID, undefined, '000000'),
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
        service.disableMfa(USER_ID, undefined, REAUTH_RECOVERY_CODE),
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
        true,
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

  describe('reauthenticate (via disableMfa / regenerateRecoveryCodes)', () => {
    it('throws UnauthorizedException when a recovery-code-shaped string is provided but no MFA is enrolled', async () => {
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
        service.disableMfa(USER_ID, undefined, RECOVERY_CODE_STUB),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when a plain OTP code is provided but no MFA is enrolled', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: null,
      });

      await expect(
        service.disableMfa(USER_ID, undefined, '123456'),
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
    it('returns accessToken and refreshToken when the token is valid and MFA is not enabled', async () => {
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

    it('returns an MFA challenge instead of a full session when MFA is enabled', async () => {
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
