import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/index.js';
import { withoutPasswordHash } from './users.utils.js';
import { VALID_MODES, VALID_THEMES } from './users.constants.js';
import * as bcrypt from 'bcryptjs';

export { VALID_MODES, VALID_THEMES };

/**
 * Manages user accounts — creation, lookup, update, and deletion. All methods
 * that return user data call `withoutPasswordHash` before returning so that
 * password hashes are never exposed to callers.
 *
 * Token management methods (verification, reset, pending email) are kept here
 * rather than in `AuthService` so that Prisma operations remain in one place.
 * `AuthService` is responsible for the *logic* (generating tokens, sending
 * emails, checking expiry); `UsersService` is responsible for *persistence*.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new user account. Hashes the password with bcrypt at cost 12
   * before storing it.
   *
   * @param email - The email address for the new account.
   * @param password - The plain-text password (hashed internally).
   * @returns The newly created user without the password hash.
   * @throws {ConflictException} When the email is already registered.
   */
  async create(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    return withoutPasswordHash(user);
  }

  /**
   * Updates the current user's account settings. Any combination of
   * `password`, `theme`, and `mode` may be changed in a single call.
   *
   * Changing the password requires `currentPassword` for verification.
   * Theme and mode values are validated against their respective allow-lists.
   *
   * @param id - The UUID of the user to update.
   * @param data - The fields to update (all optional).
   * @returns The updated user without the password hash.
   * @throws {BadRequestException} When `currentPassword` is missing, the theme or mode is invalid.
   * @throws {NotFoundException} When no user exists with the given ID.
   * @throws {UnauthorizedException} When `currentPassword` does not match the stored hash.
   */
  async updateMe(
    id: string,
    data: {
      password?: string;
      currentPassword?: string;
      theme?: string;
      mode?: string;
    },
  ) {
    const updateData: {
      passwordHash?: string;
      theme?: string;
      mode?: string;
    } = {};

    if (data.password) {
      if (!data.currentPassword) {
        throw new BadRequestException(
          'Current password is required to set a new password',
        );
      }
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('User not found');
      if (!user.passwordHash) {
        throw new BadRequestException(
          'Password cannot be changed for accounts created via social login',
        );
      }
      const isValid = await bcrypt.compare(
        data.currentPassword,
        user.passwordHash,
      );
      if (!isValid)
        throw new UnauthorizedException('Current password is incorrect');
      const passwordHash = await bcrypt.hash(data.password, 12);
      updateData.passwordHash = passwordHash;
    }

    if (data.theme !== undefined) {
      if (!(VALID_THEMES as readonly string[]).includes(data.theme)) {
        throw new BadRequestException('Invalid theme');
      }
      updateData.theme = data.theme;
    }

    if (data.mode !== undefined) {
      if (!(VALID_MODES as readonly string[]).includes(data.mode)) {
        throw new BadRequestException('Invalid mode');
      }
      updateData.mode = data.mode;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return withoutPasswordHash(user);
  }

  /**
   * Finds a user by email address. Returns the full Prisma User record
   * *including* `passwordHash` — callers that expose user data must call
   * `withoutPasswordHash` themselves (or use `findById` instead).
   *
   * NOTE: This method intentionally returns `null` when no user is found
   * rather than throwing, because `AuthService.validateUser` uses the null
   * signal to avoid user enumeration.
   *
   * @param email - The email address to look up.
   * @returns The full user record (with hash), or `null` if not found.
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Finds a user by UUID and returns the profile without the password hash.
   *
   * @param id - The UUID of the user.
   * @returns The user record without `passwordHash`.
   * @throws {NotFoundException} When no user exists with the given ID.
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user;
    return { ...safe, hasPassword: passwordHash !== null };
  }

  async findByIdWithPasswordHash(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return { ...user, hasPassword: user.passwordHash !== null };
  }

  /**
   * Permanently deletes a user account and all associated records (links,
   * metadata) via database cascades.
   *
   * @param id - The UUID of the user to delete.
   */
  async deleteById(id: string) {
    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * Stores a new email verification token and its expiry on the user record.
   * Overwrites any previously stored token.
   *
   * @param id - The UUID of the user.
   * @param token - The 64-character hex token to store.
   * @param expiresAt - When the token should be considered expired.
   */
  async updateVerificationToken(id: string, token: string, expiresAt: Date) {
    await this.prisma.user.update({
      where: { id },
      data: { verificationToken: token, verificationTokenExpiresAt: expiresAt },
    });
  }

  /**
   * Looks up a user by their email verification token. Returns the full user
   * record so the caller can inspect the expiry date.
   *
   * @param token - The token string from the verification link.
   * @returns The full user record, or `null` if no match.
   */
  async findByVerificationToken(token: string) {
    return this.prisma.user.findUnique({ where: { verificationToken: token } });
  }

  /**
   * Marks the user's email as verified and clears the verification token
   * so it cannot be used again.
   *
   * @param id - The UUID of the user.
   */
  async clearVerificationToken(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: {
        emailVerifiedAt: new Date(),
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });
  }

  /**
   * Stores a new password reset token and its expiry on the user record.
   * Overwrites any previously stored reset token.
   *
   * @param id - The UUID of the user.
   * @param token - The 64-character hex token to store.
   * @param expiresAt - When the token should be considered expired.
   */
  async updateResetToken(id: string, token: string, expiresAt: Date) {
    await this.prisma.user.update({
      where: { id },
      data: { resetToken: token, resetTokenExpiresAt: expiresAt },
    });
  }

  /**
   * Looks up a user by their password reset token. Returns the full user
   * record so the caller can inspect the expiry date.
   *
   * @param token - The token string from the reset link.
   * @returns The full user record, or `null` if no match.
   */
  async findByResetToken(token: string) {
    return this.prisma.user.findUnique({ where: { resetToken: token } });
  }

  /**
   * Replaces the user's password hash and clears the reset token. Called
   * after `AuthService` has validated the token and its expiry.
   *
   * @param id - The UUID of the user.
   * @param newPasswordHash - The bcrypt hash of the new password.
   */
  async resetPasswordWithToken(id: string, newPasswordHash: string) {
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: newPasswordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });
  }

  /**
   * Stores the pending new email address along with its verification token
   * and expiry. The user's primary email is unchanged until `confirmPendingEmail`
   * is called.
   *
   * @param id - The UUID of the user.
   * @param pendingEmail - The new email address to store temporarily.
   * @param token - The 64-character hex token sent to the new address.
   * @param expiresAt - When the token should be considered expired.
   */
  async updatePendingEmail(
    id: string,
    pendingEmail: string,
    token: string,
    expiresAt: Date,
  ) {
    await this.prisma.user.update({
      where: { id },
      data: {
        pendingEmail,
        pendingEmailToken: token,
        pendingEmailTokenExpiresAt: expiresAt,
      },
    });
  }

  /**
   * Looks up a user by the token stored for a pending email change.
   *
   * @param token - The token string from the email change verification link.
   * @returns The full user record (including `pendingEmail`), or `null` if no match.
   */
  async findByPendingEmailToken(token: string) {
    return this.prisma.user.findUnique({ where: { pendingEmailToken: token } });
  }

  /**
   * Promotes `pendingEmail` to the user's primary email address, marks the
   * email as verified, and clears all pending-email and verification token
   * fields. This is the final step of the email change flow.
   *
   * @param id - The UUID of the user.
   * @param newEmail - The confirmed new email address to apply.
   */
  async confirmPendingEmail(id: string, newEmail: string) {
    await this.prisma.user.update({
      where: { id },
      data: {
        email: newEmail,
        emailVerifiedAt: new Date(),
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailTokenExpiresAt: null,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });
  }

  async createOAuthUser(email: string) {
    const user = await this.prisma.user.create({
      data: { email, passwordHash: null, emailVerifiedAt: new Date() },
    });
    return withoutPasswordHash(user);
  }

  async findOAuthAccount(provider: string, providerId: string) {
    return this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { user: true },
    });
  }

  async linkOAuthAccount(userId: string, provider: string, providerId: string) {
    await this.prisma.oAuthAccount.create({
      data: { userId, provider, providerId },
    });
  }

  async markEmailVerified(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async saveEmailTwoFactorCode(id: string, codeHash: string, expiresAt: Date) {
    await this.prisma.user.update({
      where: { id },
      data: {
        emailTwoFactorCodeHash: codeHash,
        emailTwoFactorExpiresAt: expiresAt,
      },
    });
  }

  async clearEmailTwoFactorCode(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { emailTwoFactorCodeHash: null, emailTwoFactorExpiresAt: null },
    });
  }

  /**
   * Atomically enables Email 2FA and replaces any existing recovery codes
   * with the provided set.
   */
  async enableEmailTwoFactorWithRecoveryCodes(
    userId: string,
    codeHashes: string[],
  ) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          emailTwoFactorEnabledAt: new Date(),
          emailTwoFactorCodeHash: null,
          emailTwoFactorExpiresAt: null,
        },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
  }

  async saveTotpSecret(userId: string, encryptedSecret: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: encryptedSecret,
        totpEnabledAt: null,
        totpVerifiedAt: null,
      },
    });
  }

  async updateTotpLastUsedStep(id: string, step: number) {
    await this.prisma.user.update({
      where: { id },
      data: { totpLastUsedStep: step },
    });
  }

  /**
   * Atomically enables TOTP, records the verified time step (replay prevention),
   * and replaces any existing recovery codes with the provided set.
   */
  async enableTotpWithRecoveryCodes(
    userId: string,
    codeHashes: string[],
    lastUsedStep: number,
  ) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          totpEnabledAt: new Date(),
          totpVerifiedAt: new Date(),
          totpLastUsedStep: lastUsedStep,
        },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
  }

  /**
   * Atomically invalidates all existing recovery codes and stores a fresh set.
   */
  async reissueRecoveryCodes(userId: string, codeHashes: string[]) {
    await this.prisma.$transaction([
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
  }

  async findUnusedRecoveryCodes(userId: string) {
    return this.prisma.recoveryCode.findMany({
      where: { userId, usedAt: null },
    });
  }

  async markRecoveryCodeUsed(id: string) {
    await this.prisma.recoveryCode.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async disableTwoFactor(id: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          totpSecret: null,
          totpEnabledAt: null,
          totpVerifiedAt: null,
          totpLastUsedStep: null,
          emailTwoFactorCodeHash: null,
          emailTwoFactorExpiresAt: null,
          emailTwoFactorEnabledAt: null,
        },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId: id } }),
    ]);
  }
}
