import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { generateHexToken } from '../common/crypto-tokens.js';
import {
  RECOVERY_CODE_REGEX,
  findMatchingRecoveryCode,
} from '../common/recovery-codes.js';
import { EmailService } from '../email/index.js';
import { UsersService } from '../users/index.js';
import { TotpService } from './totp.service.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

function expiresInMs(ms: number) {
  return new Date(Date.now() + ms);
}

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly totpService: TotpService,
  ) {}

  async sendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);
    const token = generateHexToken();
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);
    await this.usersService.updateVerificationToken(userId, token, expiresAt);
    await this.emailService.sendVerification(user.email, token, user.theme);
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByVerificationToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    if (
      !user.verificationTokenExpiresAt ||
      user.verificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Verification link has expired');
    }

    await this.usersService.clearVerificationToken(user.id);
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    const token = generateHexToken();
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);
    await this.usersService.updateVerificationToken(userId, token, expiresAt);
    await this.emailService.sendVerification(user.email, token, user.theme);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const token = generateHexToken();
    const expiresAt = expiresInMs(ONE_HOUR_MS);
    await this.usersService.updateResetToken(user.id, token, expiresAt);
    await this.emailService.sendPasswordReset(email, token, user.theme);
  }

  async resetPassword(token: string, newPassword: string) {
    const bcrypt = await import('bcryptjs');
    const user = await this.usersService.findByResetToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Password reset link has expired');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.resetPasswordWithToken(
      user.id,
      newPasswordHash,
      !user.emailVerifiedAt,
    );
  }

  async requestEmailChange(userId: string, newEmail: string, code?: string) {
    const user = await this.usersService.findById(userId);

    const existing = await this.usersService.findByEmail(newEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email already in use');
    }

    if (user.totpEnabledAt) {
      if (!code) {
        throw new ForbiddenException(
          '2FA is enabled — provide a verification code to change your email',
        );
      }

      const isRecoveryCode = RECOVERY_CODE_REGEX.test(code);

      if (isRecoveryCode) {
        const recoveryCodes =
          await this.usersService.findUnusedRecoveryCodes(userId);
        const hashes = recoveryCodes.map(
          (recoveryCode) => recoveryCode.codeHash,
        );
        const matchIndex = await findMatchingRecoveryCode(code, hashes);
        if (matchIndex === null) {
          throw new UnauthorizedException('Invalid OTP code');
        }
        await this.usersService.markRecoveryCodeUsed(
          recoveryCodes[matchIndex].id,
        );
      } else {
        const isValid = await this.totpService.verifyCode(user, code);
        if (!isValid) {
          throw new UnauthorizedException('Invalid OTP code');
        }
      }
    }

    const token = generateHexToken();
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);
    await this.usersService.updatePendingEmail(
      userId,
      newEmail,
      token,
      expiresAt,
    );
    await this.emailService.sendEmailChangeVerification(
      newEmail,
      token,
      user.theme,
    );
  }

  async confirmEmailChange(token: string) {
    const user = await this.usersService.findByPendingEmailToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired email change link');
    }

    if (
      !user.pendingEmailTokenExpiresAt ||
      user.pendingEmailTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Email change link has expired');
    }

    if (!user.pendingEmail) {
      throw new BadRequestException('Invalid or expired email change link');
    }

    await this.usersService.confirmPendingEmail(user.id, user.pendingEmail);
  }
}
