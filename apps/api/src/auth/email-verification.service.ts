import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { generateHexToken, sha256Hex } from '../common/crypto-tokens.js';
import { expiresInMs } from '../common/dates.js';
import {
  RECOVERY_CODE_REGEX,
  findMatchingRecoveryCode,
} from '../common/recovery-codes.js';
import { EmailService } from '../email/index.js';
import { UserTokensService, UsersService } from '../users/index.js';
import { Prisma } from '../prisma/index.js';
import { TotpService } from './totp.service.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userTokensService: UserTokensService,
    private readonly emailService: EmailService,
    private readonly totpService: TotpService,
  ) {}

  async sendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);
    const rawToken = generateHexToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);
    await this.userTokensService.updateVerificationToken(
      userId,
      tokenHash,
      expiresAt,
    );
    await this.emailService.sendVerification(user.email, rawToken, user.theme);
  }

  async verifyEmail(rawToken: string) {
    const user = await this.userTokensService.findByVerificationToken(
      sha256Hex(rawToken),
    );

    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    if (
      !user.verificationTokenExpiresAt ||
      user.verificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Verification link has expired');
    }

    await this.userTokensService.clearVerificationToken(user.id);
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    const rawToken = generateHexToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);
    await this.userTokensService.updateVerificationToken(
      userId,
      tokenHash,
      expiresAt,
    );
    await this.emailService.sendVerification(user.email, rawToken, user.theme);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const rawToken = generateHexToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = expiresInMs(ONE_HOUR_MS);
    await this.userTokensService.updateResetToken(
      user.id,
      tokenHash,
      expiresAt,
    );
    await this.emailService.sendPasswordReset(email, rawToken, user.theme);
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const bcrypt = await import('bcryptjs');
    const user = await this.userTokensService.findByResetToken(
      sha256Hex(rawToken),
    );

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
        // Atomic compare-and-swap — see UsersService.markRecoveryCodeUsed.
        const consumed = await this.usersService.markRecoveryCodeUsed(
          recoveryCodes[matchIndex].id,
        );
        if (!consumed) {
          throw new UnauthorizedException('Invalid OTP code');
        }
      } else {
        const isValid = await this.totpService.verifyCode(user, code);
        if (!isValid) {
          throw new UnauthorizedException('Invalid OTP code');
        }
      }
    }

    const rawToken = generateHexToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);
    await this.userTokensService.updatePendingEmail(
      userId,
      newEmail,
      tokenHash,
      expiresAt,
    );
    await this.emailService.sendEmailChangeVerification(
      newEmail,
      rawToken,
      user.theme,
    );
  }

  async confirmEmailChange(rawToken: string) {
    const user = await this.userTokensService.findByPendingEmailToken(
      sha256Hex(rawToken),
    );

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

    // The pendingEmail uniqueness check at request time is racy with another
    // user claiming the same address between request and confirm. Catch the
    // unique-constraint violation here and surface it as a clean 409 rather
    // than letting Prisma's P2002 escape as a 500.
    try {
      await this.usersService.confirmPendingEmail(user.id, user.pendingEmail);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'That email address is no longer available — request the change again with a different address',
        );
      }
      throw error;
    }
  }
}
