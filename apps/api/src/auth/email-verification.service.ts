import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EmailQueueService } from '../email/index.js';
import {
  expiresInMs,
  generateHexToken,
  normalizeRecoveryCode,
  sha256Hex,
} from '../common/index.js';
import { Prisma } from '../prisma/index.js';
import { TotpService } from './totp.service.js';
import {
  UserCredentialsService,
  UserEmailVerificationService,
  UserMfaService,
  UsersService,
  UserTokensService,
} from '../users/index.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userCredentialsService: UserCredentialsService,
    private readonly userEmailVerificationService: UserEmailVerificationService,
    private readonly userMfaService: UserMfaService,
    private readonly userTokensService: UserTokensService,
    private readonly emailQueueService: EmailQueueService,
    private readonly totpService: TotpService,
  ) {}

  async sendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);
    await this.issueVerificationEmail(userId, user.email, user.theme);
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

    await this.issueVerificationEmail(userId, user.email, user.theme);
  }

  async resendEmailChange(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user.pendingEmail) {
      throw new BadRequestException('No email change is pending');
    }

    // MFA already enforced at request time; token rotation needs no fresh OTP
    const rawToken = generateHexToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);
    await this.userTokensService.updatePendingEmail(
      userId,
      user.pendingEmail,
      tokenHash,
      expiresAt,
    );
    await this.emailQueueService.enqueueEmailChangeVerification(
      user.pendingEmail,
      rawToken,
      user.theme,
    );
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
    await this.emailQueueService.enqueuePasswordReset(
      email,
      rawToken,
      user.theme,
    );
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ userId: string }> {
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
    await this.userCredentialsService.resetPasswordWithToken(
      user.id,
      newPasswordHash,
      !user.emailVerifiedAt,
    );

    return { userId: user.id };
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
          'MFA is enabled – provide a verification code to change your email',
        );
      }

      if (normalizeRecoveryCode(code) !== null) {
        await this.userMfaService.verifyAndConsumeRecoveryCode(userId, code);
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
    await this.emailQueueService.enqueueEmailChangeVerification(
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

    // request-time uniqueness check is racy; map P2002 to a clean 409 here
    try {
      await this.userEmailVerificationService.confirmPendingEmail(
        user.id,
        user.pendingEmail,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'That email address is no longer available – request the change again with a different address',
        );
      }
      throw error;
    }
  }

  private async issueVerificationEmail(
    userId: string,
    email: string,
    theme: string,
  ) {
    const rawToken = generateHexToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);
    await this.userTokensService.updateVerificationToken(
      userId,
      tokenHash,
      expiresAt,
    );
    await this.emailQueueService.enqueueVerification(email, rawToken, theme);
  }
}
