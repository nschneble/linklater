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
import { EmailService } from '../email/email.service';
import { UserMfaService } from '../users/user-mfa.service';
import { UserOAuthService } from '../users/user-oauth.service';
import { UserTokensService } from '../users/user-tokens.service';
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
    create: jest.fn(),
    deleteById: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByIdWithPasswordHash: jest.fn(),
    markWelcomed: jest.fn(),
    setFirstPassword: jest.fn(),
  } as unknown as UsersService;

  const userMfaServiceMock = {
    clearMfaNonce: jest.fn(),
    disableMultiFactor: jest.fn(),
    reissueRecoveryCodes: jest.fn(),
    setMfaNonce: jest.fn(),
    verifyAndConsumeRecoveryCode: jest.fn(),
  } as unknown as UserMfaService;

  const userOAuthServiceMock = {
    listOAuthAccounts: jest.fn(),
  } as unknown as UserOAuthService;

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue(SIGNED_TOKEN),
  } as unknown as JwtService;

  const emailVerificationServiceMock = {
    resetPassword: jest.fn(),
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

  const userTokensServiceMock = {
    updateAccountDeletionToken: jest.fn(),
    findByAccountDeletionToken: jest.fn(),
    consumeAccountDeletionToken: jest.fn(),
    clearAccountDeletionToken: jest.fn(),
  } as unknown as UserTokensService;

  const emailServiceMock = {
    sendAccountDeletionConfirmation: jest.fn(),
  } as unknown as EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: UserMfaService, useValue: userMfaServiceMock },
        { provide: UserOAuthService, useValue: userOAuthServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        {
          provide: EmailVerificationService,
          useValue: emailVerificationServiceMock,
        },
        { provide: MagicLinkService, useValue: magicLinkServiceMock },
        { provide: TotpService, useValue: totpServiceMock },
        { provide: RefreshTokenService, useValue: refreshTokenServiceMock },
        { provide: UserTokensService, useValue: userTokensServiceMock },
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
      (userOAuthServiceMock.listOAuthAccounts as jest.Mock).mockResolvedValue(
        [],
      );
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
        accountDeletionToken: null,
        accountDeletionTokenExpiresAt: null,
      });

      const result = await service.me(USER_ID);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
      expect(result).not.toHaveProperty('id');
      expect(result.userId).toBe(USER_ID);
      expect(result.email).toBe(USER_EMAIL);
      expect(result.multiFactorMethod).toBeNull();
      expect(result.multiFactorPending).toBe(false);
      expect(result.accountDeletionPending).toBe(false);
      expect(result).not.toHaveProperty('totpSecret');
      expect(result).not.toHaveProperty('magicLinkToken');
      expect(result).not.toHaveProperty('accountDeletionToken');
      expect(result).not.toHaveProperty('accountDeletionTokenExpiresAt');
    });

    it('returns accountDeletionPending true when an unexpired deletion token is set', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpSecret: null,
        totpEnabledAt: null,
        totpVerifiedAt: null,
        magicLinkToken: null,
        magicLinkTokenExpiresAt: null,
        accountDeletionToken: 'hashed-token',
        accountDeletionTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const result = await service.me(USER_ID);

      expect(result.accountDeletionPending).toBe(true);
      expect(result).not.toHaveProperty('accountDeletionToken');
    });

    it('returns accountDeletionPending false when the deletion token has expired', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpSecret: null,
        totpEnabledAt: null,
        totpVerifiedAt: null,
        magicLinkToken: null,
        magicLinkTokenExpiresAt: null,
        accountDeletionToken: 'hashed-token',
        accountDeletionTokenExpiresAt: new Date(Date.now() - 1000),
      });

      const result = await service.me(USER_ID);

      expect(result.accountDeletionPending).toBe(false);
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
      (userOAuthServiceMock.listOAuthAccounts as jest.Mock).mockResolvedValue([
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
      (userOAuthServiceMock.listOAuthAccounts as jest.Mock).mockResolvedValue(
        [],
      );

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

    it('returns null when user has no password (passwordless account – SSO or magic link)', async () => {
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

      expect(userMfaServiceMock.setMfaNonce).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
      );
      const nonceWritten = (userMfaServiceMock.setMfaNonce as jest.Mock).mock
        .calls[0][1] as string;
      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        { subject: USER_ID, mfaPending: true, nonce: nonceWritten },
        { expiresIn: '5m' },
      );
      expect(result).toEqual({ mfaToken: SIGNED_TOKEN, mfaMethod: 'totp' });
      expect(refreshTokenServiceMock.issueTokenPair).not.toHaveBeenCalled();
    });

    it('forces MFA even when the caller supplies only a userId – closing the OAuth-strategy bypass', async () => {
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

  describe('resetPassword', () => {
    it('delegates to EmailVerificationService.resetPassword then issues a session via login', async () => {
      (
        emailVerificationServiceMock.resetPassword as jest.Mock
      ).mockResolvedValue({ userId: USER_ID });
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: null,
      });

      const result = await service.resetPassword('reset-token', NEW_PASSWORD);

      expect(emailVerificationServiceMock.resetPassword).toHaveBeenCalledWith(
        'reset-token',
        NEW_PASSWORD,
      );
      expect(refreshTokenServiceMock.issueTokenPair).toHaveBeenCalledWith(
        USER_ID,
        USER_EMAIL,
      );
      expect(result).toHaveProperty('accessToken', SIGNED_TOKEN);
    });

    it('routes through the MFA gate when the user has TOTP enrolled', async () => {
      (
        emailVerificationServiceMock.resetPassword as jest.Mock
      ).mockResolvedValue({ userId: USER_ID });
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        totpEnabledAt: new Date(),
      });

      const result = await service.resetPassword('reset-token', NEW_PASSWORD);

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
    const RECOVERY_CODE_STUB = 'aaaaa-bbbbb-ccccc';

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

        expect(userMfaServiceMock.clearMfaNonce).toHaveBeenCalledWith(USER_ID);
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
      it('delegates to UserMfaService and returns a token pair', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          mfaNonce: MFA_NONCE,
          totpEnabledAt: new Date(),
        });
        (
          userMfaServiceMock.verifyAndConsumeRecoveryCode as jest.Mock
        ).mockResolvedValue(undefined);

        const result = await service.verifyOtp(
          USER_ID,
          RECOVERY_CODE_STUB,
          'recovery',
          MFA_NONCE,
        );

        expect(
          userMfaServiceMock.verifyAndConsumeRecoveryCode,
        ).toHaveBeenCalledWith(USER_ID, RECOVERY_CODE_STUB);
        expect(userMfaServiceMock.clearMfaNonce).toHaveBeenCalledWith(USER_ID);
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
      });

      it('propagates UnauthorizedException when verify-and-consume rejects', async () => {
        (usersServiceMock.findById as jest.Mock).mockResolvedValue({
          id: USER_ID,
          email: USER_EMAIL,
          mfaNonce: MFA_NONCE,
          totpEnabledAt: new Date(),
        });
        (
          userMfaServiceMock.verifyAndConsumeRecoveryCode as jest.Mock
        ).mockRejectedValue(new UnauthorizedException('Invalid recovery code'));

        await expect(
          service.verifyOtp(USER_ID, RECOVERY_CODE_STUB, 'recovery', MFA_NONCE),
        ).rejects.toThrow(UnauthorizedException);
        expect(userMfaServiceMock.clearMfaNonce).not.toHaveBeenCalled();
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
      (userMfaServiceMock.disableMultiFactor as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.disableMfa(USER_ID, KNOWN_PASSWORD);

      expect(userMfaServiceMock.disableMultiFactor).toHaveBeenCalledWith(
        USER_ID,
      );
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
      (userMfaServiceMock.disableMultiFactor as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.disableMfa(USER_ID, undefined, '123456');

      expect(totpServiceMock.verifyCode).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID }),
        '123456',
      );
      expect(userMfaServiceMock.disableMultiFactor).toHaveBeenCalledWith(
        USER_ID,
      );
    });

    it('disables MFA using a recovery code', async () => {
      const REAUTH_RECOVERY_CODE = 'aaaaa-bbbbb-ccccc';

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
      });
      (
        userMfaServiceMock.verifyAndConsumeRecoveryCode as jest.Mock
      ).mockResolvedValue(undefined);
      (userMfaServiceMock.disableMultiFactor as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.disableMfa(USER_ID, undefined, REAUTH_RECOVERY_CODE);

      expect(
        userMfaServiceMock.verifyAndConsumeRecoveryCode,
      ).toHaveBeenCalledWith(USER_ID, REAUTH_RECOVERY_CODE);
      expect(userMfaServiceMock.disableMultiFactor).toHaveBeenCalledWith(
        USER_ID,
      );
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

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
      });
      (
        userMfaServiceMock.verifyAndConsumeRecoveryCode as jest.Mock
      ).mockRejectedValue(new UnauthorizedException('Invalid recovery code'));

      await expect(
        service.disableMfa(USER_ID, undefined, REAUTH_RECOVERY_CODE),
      ).rejects.toThrow(UnauthorizedException);
      expect(userMfaServiceMock.disableMultiFactor).not.toHaveBeenCalled();
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
      (userMfaServiceMock.reissueRecoveryCodes as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.regenerateRecoveryCodes(
        USER_ID,
        KNOWN_PASSWORD,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(10);
      expect(userMfaServiceMock.reissueRecoveryCodes).toHaveBeenCalledWith(
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
      (userMfaServiceMock.reissueRecoveryCodes as jest.Mock).mockResolvedValue(
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

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
      });
      (
        userMfaServiceMock.verifyAndConsumeRecoveryCode as jest.Mock
      ).mockResolvedValue(undefined);
      (userMfaServiceMock.reissueRecoveryCodes as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.regenerateRecoveryCodes(
        USER_ID,
        undefined,
        REAUTH_RECOVERY_CODE,
      );

      expect(
        userMfaServiceMock.verifyAndConsumeRecoveryCode,
      ).toHaveBeenCalledWith(USER_ID, REAUTH_RECOVERY_CODE);
      expect(result).toHaveLength(10);
    });

    it('throws UnauthorizedException when the recovery code does not match', async () => {
      const REAUTH_RECOVERY_CODE = 'aaaaa-bbbbb-ccccc';

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
      });
      (
        userMfaServiceMock.verifyAndConsumeRecoveryCode as jest.Mock
      ).mockRejectedValue(new UnauthorizedException('Invalid recovery code'));

      await expect(
        service.regenerateRecoveryCodes(
          USER_ID,
          undefined,
          REAUTH_RECOVERY_CODE,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(userMfaServiceMock.reissueRecoveryCodes).not.toHaveBeenCalled();
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
      expect(result).toHaveProperty('userId', USER_ID);
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

  describe('deleteAccount', () => {
    it('deletes when currentPassword is valid (credentialed branch)', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
        hasPassword: true,
        passwordHash: KNOWN_PASSWORD_HASH,
        totpEnabledAt: null,
      });
      (usersServiceMock.deleteById as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deleteAccount(USER_ID, KNOWN_PASSWORD);

      expect(usersServiceMock.deleteById).toHaveBeenCalledWith(USER_ID);
      expect(
        userTokensServiceMock.updateAccountDeletionToken,
      ).not.toHaveBeenCalled();
      expect(
        emailServiceMock.sendAccountDeletionConfirmation,
      ).not.toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });

    it('deletes when a valid TOTP code is provided', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
      });
      (totpServiceMock.verifyCode as jest.Mock).mockResolvedValue(true);
      (usersServiceMock.deleteById as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deleteAccount(USER_ID, undefined, '123456');

      expect(totpServiceMock.verifyCode).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID }),
        '123456',
      );
      expect(usersServiceMock.deleteById).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ deleted: true });
    });

    it('deletes when a valid recovery code is provided', async () => {
      const recoveryCode = 'aaaaa-bbbbb-ccccc';

      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: new Date(),
      });
      (
        userMfaServiceMock.verifyAndConsumeRecoveryCode as jest.Mock
      ).mockResolvedValue(undefined);
      (usersServiceMock.deleteById as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deleteAccount(
        USER_ID,
        undefined,
        recoveryCode,
      );

      expect(
        userMfaServiceMock.verifyAndConsumeRecoveryCode,
      ).toHaveBeenCalledWith(USER_ID, recoveryCode);
      expect(usersServiceMock.deleteById).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ deleted: true });
    });

    it('throws BadRequestException when credentialed account provides no creds', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
        hasPassword: true,
        passwordHash: KNOWN_PASSWORD_HASH,
        totpEnabledAt: null,
      });

      await expect(service.deleteAccount(USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(usersServiceMock.deleteById).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
        hasPassword: true,
        passwordHash: KNOWN_PASSWORD_HASH,
        totpEnabledAt: null,
      });

      await expect(
        service.deleteAccount(USER_ID, UNKNOWN_PASSWORD),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersServiceMock.deleteById).not.toHaveBeenCalled();
    });

    it('issues an email confirmation token and skips delete on magic-link-only-no-MFA accounts', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: null,
      });
      (
        userTokensServiceMock.updateAccountDeletionToken as jest.Mock
      ).mockResolvedValue(undefined);
      (
        emailServiceMock.sendAccountDeletionConfirmation as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.deleteAccount(USER_ID);

      expect(
        userTokensServiceMock.updateAccountDeletionToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        userTokensServiceMock.updateAccountDeletionToken,
      ).toHaveBeenCalledWith(USER_ID, expect.any(String), expect.any(Date));
      expect(
        emailServiceMock.sendAccountDeletionConfirmation,
      ).toHaveBeenCalledTimes(1);
      expect(
        emailServiceMock.sendAccountDeletionConfirmation,
      ).toHaveBeenCalledWith(USER_EMAIL, expect.any(String), 'scanner-darkly');
      expect(usersServiceMock.deleteById).not.toHaveBeenCalled();
      expect(result).toEqual({ requiresEmailConfirmation: true });
    });

    it('ignores creds passed on the email-confirm path (no throw, no use)', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: null,
      });
      (
        userTokensServiceMock.updateAccountDeletionToken as jest.Mock
      ).mockResolvedValue(undefined);
      (
        emailServiceMock.sendAccountDeletionConfirmation as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.deleteAccount(USER_ID, KNOWN_PASSWORD);

      expect(usersServiceMock.deleteById).not.toHaveBeenCalled();
      expect(
        emailServiceMock.sendAccountDeletionConfirmation,
      ).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ requiresEmailConfirmation: true });
    });

    it('persists the SHA-256 hash of the emailed token, not the raw value', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
        hasPassword: false,
        passwordHash: null,
        totpEnabledAt: null,
      });
      (
        userTokensServiceMock.updateAccountDeletionToken as jest.Mock
      ).mockResolvedValue(undefined);
      (
        emailServiceMock.sendAccountDeletionConfirmation as jest.Mock
      ).mockResolvedValue(undefined);

      await service.deleteAccount(USER_ID);

      const persistedHash = (
        userTokensServiceMock.updateAccountDeletionToken as jest.Mock
      ).mock.calls[0][1] as string;
      const emailedRaw = (
        emailServiceMock.sendAccountDeletionConfirmation as jest.Mock
      ).mock.calls[0][1] as string;
      expect(persistedHash).not.toEqual(emailedRaw);
      expect(persistedHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('confirmAccountDeletion', () => {
    const RAW_TOKEN = 'a'.repeat(64);

    it('deletes the user when the token is valid and unexpired', async () => {
      (
        userTokensServiceMock.findByAccountDeletionToken as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        accountDeletionTokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      (
        userTokensServiceMock.consumeAccountDeletionToken as jest.Mock
      ).mockResolvedValue(true);
      (usersServiceMock.deleteById as jest.Mock).mockResolvedValue(undefined);

      await service.confirmAccountDeletion(RAW_TOKEN);

      expect(
        userTokensServiceMock.consumeAccountDeletionToken,
      ).toHaveBeenCalledWith(USER_ID, expect.any(String));
      expect(usersServiceMock.deleteById).toHaveBeenCalledWith(USER_ID);
    });

    it('throws UnauthorizedException when the token is unknown', async () => {
      (
        userTokensServiceMock.findByAccountDeletionToken as jest.Mock
      ).mockResolvedValue(null);

      await expect(service.confirmAccountDeletion(RAW_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersServiceMock.deleteById).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token is expired', async () => {
      (
        userTokensServiceMock.findByAccountDeletionToken as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        accountDeletionTokenExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.confirmAccountDeletion(RAW_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersServiceMock.deleteById).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when CAS loses (parallel consume already won)', async () => {
      (
        userTokensServiceMock.findByAccountDeletionToken as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        accountDeletionTokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      (
        userTokensServiceMock.consumeAccountDeletionToken as jest.Mock
      ).mockResolvedValue(false);

      await expect(service.confirmAccountDeletion(RAW_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersServiceMock.deleteById).not.toHaveBeenCalled();
    });
  });

  describe('cancelPendingAccountDeletion', () => {
    it('clears any pending account-deletion token for the user', async () => {
      (
        userTokensServiceMock.clearAccountDeletionToken as jest.Mock
      ).mockResolvedValue(undefined);

      await service.cancelPendingAccountDeletion(USER_ID);

      expect(
        userTokensServiceMock.clearAccountDeletionToken,
      ).toHaveBeenCalledWith(USER_ID);
    });

    it('is idempotent – does not throw when no pending token exists', async () => {
      (
        userTokensServiceMock.clearAccountDeletionToken as jest.Mock
      ).mockResolvedValue(undefined);

      await expect(
        service.cancelPendingAccountDeletion(USER_ID),
      ).resolves.toBeUndefined();
    });
  });
});
