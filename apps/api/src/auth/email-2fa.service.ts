import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
} from '../common/recovery-codes.js';
import { EmailService } from '../email/index.js';
import { UsersService } from '../users/users.service.js';

const TEN_MINUTES_MS = 10 * 60 * 1000;

/** Generates a cryptographically random 6-digit numeric code as a zero-padded string. */
function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Manages Email 2FA setup, code delivery, and verification. Codes are
 * bcrypt-hashed before storage (cost 8 — lower than passwords but sufficient
 * for short-lived 6-digit codes) and expire after 10 minutes.
 */
@Injectable()
export class EmailTwoFactorService {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generates a fresh 6-digit code, stores its bcrypt hash with a 10-minute
   * expiry on the user record, and sends the code to the user's email.
   *
   * @param user - The target user object (must include `id`, `email`, `theme`).
   */
  async sendCode(user: {
    id: string;
    email: string;
    theme?: string;
  }): Promise<void> {
    const code = generateSixDigitCode();
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + TEN_MINUTES_MS);

    await this.usersService.saveEmailTwoFactorCode(
      user.id,
      codeHash,
      expiresAt,
    );
    await this.emailService.sendTwoFactorCode(user.email, code, user.theme);
  }

  /**
   * Validates prerequisites and sends the initial setup code to the user's email.
   *
   * @param userId - The UUID of the authenticated user initiating setup.
   * @throws {ForbiddenException} When the account has no password or unverified email.
   * @throws {ConflictException} When another 2FA method is already enabled.
   */
  async initiateSetup(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user.hasPassword) {
      throw new ForbiddenException(
        '2FA is not available for accounts created via social login',
      );
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Email must be verified before enabling Email 2FA',
      );
    }

    if (user.totpEnabledAt) {
      throw new ConflictException(
        'TOTP 2FA is already enabled — disable it before enrolling Email 2FA',
      );
    }

    if (user.emailTwoFactorEnabledAt) {
      throw new ConflictException('Email 2FA is already enabled');
    }

    await this.sendCode(user);
  }

  /**
   * Verifies the setup code and enables Email 2FA on the account.
   *
   * @param userId - The UUID of the authenticated user.
   * @param code - The 6-digit code entered by the user.
   * @returns 10 plaintext recovery codes (shown once, then discarded).
   * @throws {BadRequestException} When no code is pending, or the code is wrong/expired.
   */
  async verifySetup(userId: string, code: string): Promise<string[]> {
    const user = await this.usersService.findById(userId);

    if (
      !user.emailTwoFactorCodeHash ||
      !user.emailTwoFactorExpiresAt ||
      user.emailTwoFactorEnabledAt
    ) {
      throw new BadRequestException('No pending Email 2FA setup found');
    }

    if (user.emailTwoFactorExpiresAt < new Date()) {
      throw new BadRequestException('Code has expired — request a new one');
    }

    const isValid = await bcrypt.compare(code, user.emailTwoFactorCodeHash);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired code');
    }

    const plainCodes = generateRecoveryCodes();
    const codeHashes = await hashRecoveryCodes(plainCodes);
    await this.usersService.enableEmailTwoFactorWithRecoveryCodes(
      userId,
      codeHashes,
    );

    return plainCodes;
  }

  /**
   * Verifies a 6-digit code against the stored hash and expiry. Clears the
   * stored code on success to prevent reuse.
   *
   * @param user - The user object including hash and expiry fields.
   * @param code - The 6-digit code to verify.
   * @returns `true` when the code matches and is not expired, `false` otherwise.
   */
  async verifyCode(
    user: {
      id: string;
      emailTwoFactorCodeHash: string | null;
      emailTwoFactorExpiresAt: Date | null;
    },
    code: string,
  ): Promise<boolean> {
    if (!user.emailTwoFactorCodeHash || !user.emailTwoFactorExpiresAt) {
      return false;
    }

    if (user.emailTwoFactorExpiresAt < new Date()) {
      return false;
    }

    const isValid = await bcrypt.compare(code, user.emailTwoFactorCodeHash);

    if (isValid) {
      await this.usersService.clearEmailTwoFactorCode(user.id);
    }

    return isValid;
  }
}
