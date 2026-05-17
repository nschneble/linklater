import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EmailVerificationService } from './email-verification.service';
import { TotpService } from './totp.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';

const NEW_EMAIL = 'new.email@addy.com';
const PENDING_EMAIL_TOKEN = 'pending-email-token-abc';
const RESET_TOKEN = 'reset-token-abc';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const VERIFICATION_TOKEN = 'verification-token-xyz';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;

  const usersServiceMock = {
    clearVerificationToken: jest.fn(),
    confirmPendingEmail: jest.fn(),
    findByEmail: jest.fn(),
    findByPendingEmailToken: jest.fn(),
    findByResetToken: jest.fn(),
    findByVerificationToken: jest.fn(),
    findById: jest.fn(),
    findUnusedRecoveryCodes: jest.fn(),
    markEmailVerified: jest.fn(),
    markRecoveryCodeUsed: jest.fn(),
    resetPasswordWithToken: jest.fn(),
    updatePendingEmail: jest.fn(),
    updateResetToken: jest.fn(),
    updateVerificationToken: jest.fn(),
  } as unknown as UsersService;

  const emailServiceMock = {
    sendEmailChangeVerification: jest.fn(),
    sendPasswordReset: jest.fn(),
    sendVerification: jest.fn(),
  } as unknown as EmailService;

  const totpServiceMock = {
    verifyCode: jest.fn(),
  } as unknown as TotpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: TotpService, useValue: totpServiceMock },
      ],
    }).compile();

    service = module.get<EmailVerificationService>(EmailVerificationService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

      await service.resetPassword(RESET_TOKEN, 'new-password-123');

      expect(usersServiceMock.resetPasswordWithToken).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.any(Boolean),
      );
    });

    it('throws BadRequestException when the reset token is not found', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetPassword('unknown-token', 'new-password-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the reset token has expired', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        resetToken: RESET_TOKEN,
        resetTokenExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword(RESET_TOKEN, 'new-password-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when resetTokenExpiresAt is null', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        resetToken: RESET_TOKEN,
        resetTokenExpiresAt: null,
      });

      await expect(
        service.resetPassword(RESET_TOKEN, 'new-password-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes markVerified=true to resetPasswordWithToken when email is not yet verified', async () => {
      (usersServiceMock.findByResetToken as jest.Mock).mockResolvedValue({
        id: USER_ID,
        emailVerifiedAt: null,
        resetToken: RESET_TOKEN,
        resetTokenExpiresAt: new Date(Date.now() + 3600000),
      });
      (usersServiceMock.resetPasswordWithToken as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.resetPassword(RESET_TOKEN, 'new-password-123');

      expect(usersServiceMock.resetPasswordWithToken).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        true,
      );
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

      await service.resetPassword(RESET_TOKEN, 'new-password-123');

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

    it('throws UnauthorizedException when recovery code does not match any stored hash', async () => {
      const REAUTH_RECOVERY_CODE = 'aaaaa-bbbbb-ccccc';
      const bcryptModule = await import('bcryptjs');
      const differentHash = await bcryptModule.hash('zzzzz-zzzzz-zzzzz', 1);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUserNoTwoFactor({ totpEnabledAt: new Date() }),
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.findUnusedRecoveryCodes as jest.Mock).mockResolvedValue(
        [{ id: 'rc-1', codeHash: differentHash }],
      );

      await expect(
        service.requestEmailChange(USER_ID, NEW_EMAIL, REAUTH_RECOVERY_CODE),
      ).rejects.toThrow(UnauthorizedException);
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
});
