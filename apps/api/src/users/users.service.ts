import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { Prisma, PrismaService } from '../prisma/index.js';
import { withoutPasswordHash } from './users.utils.js';
import { VALID_MODES, VALID_THEMES } from './users.constants.js';
import { UserMfaService } from './user-mfa.service.js';
import { UserOAuthService } from './user-oauth.service.js';
import * as bcrypt from 'bcryptjs';

export { VALID_MODES, VALID_THEMES };

/**
 * Inputs accepted by `UsersService.updateMe`. All fields are optional; only
 * provided keys are written to the database.
 */
export interface UpdateMeInput {
  /** Toggles the color-vision-deficient mode flag. */
  cvdMode?: boolean;
  /** New password (plaintext) to hash and store. Requires `currentPassword`. */
  password?: string;
  /** Existing password used to authorize a password change. */
  currentPassword?: string;
  /** Theme identifier from the `VALID_THEMES` allow-list. */
  theme?: string;
  /** Color mode identifier from the `VALID_MODES` allow-list. */
  mode?: string;
}

/**
 * Manages user accounts — creation, lookup, update, and deletion. All methods
 * that return user data call `withoutPasswordHash` before returning so that
 * password hashes are never exposed to callers.
 *
 * OAuth-account persistence is delegated to `UserOAuthService`; MFA/TOTP and
 * recovery-code persistence is delegated to `UserMfaService`. This service
 * retains a stable public surface so all 9 consumer call sites remain
 * unmodified.
 *
 * Token management methods (verification, reset, pending email) are kept here
 * rather than in `AuthService` so that Prisma operations remain in one place.
 * `AuthService` is responsible for the *logic* (generating tokens, sending
 * emails, checking expiry); `UsersService` is responsible for *persistence*.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userOAuthService: UserOAuthService,
    private readonly userMfaService: UserMfaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Core user CRUD
  // ---------------------------------------------------------------------------

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
    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash },
      });
      return withoutPasswordHash(user);
    } catch (error) {
      // Surface the unique-constraint race as a proper 409 instead of letting
      // Prisma's P2002 escape as a 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
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
  async updateMe(id: string, data: UpdateMeInput) {
    const updateData: {
      cvdMode?: boolean;
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
          'Use the set-password endpoint to add a password to an IdP account',
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

    if (data.cvdMode !== undefined) {
      updateData.cvdMode = data.cvdMode;
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
    return {
      ...withoutPasswordHash(user),
      hasPassword: user.passwordHash !== null,
    };
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

  // ---------------------------------------------------------------------------
  // Password / email persistence
  // ---------------------------------------------------------------------------

  /**
   * Replaces the user's password hash and clears the reset token. Called
   * after `AuthService` has validated the token and its expiry.
   *
   * @param id - The UUID of the user.
   * @param newPasswordHash - The bcrypt hash of the new password.
   */
  async resetPasswordWithToken(
    id: string,
    newPasswordHash: string,
    markVerified = false,
  ) {
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: newPasswordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        ...(markVerified ? { emailVerifiedAt: new Date() } : {}),
      },
    });
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

  /**
   * Creates a new user without a password (for magic-link sign-ups).
   * Returns `null` when the email is already registered so callers can
   * still send a login magic link to the existing account.
   *
   * @param email - The email address for the new account.
   * @returns The newly created user without the password hash, or `null` if the email is already taken.
   */
  async createWithoutPassword(email: string) {
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash: null },
      });
      return withoutPasswordHash(user);
    } catch (error) {
      // Magic-link signup path uses the null return to fall back to a login
      // link when the address is already registered (race or otherwise).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async setFirstPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.passwordHash !== null) {
      throw new BadRequestException('Account already has a password');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async markEmailVerified(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /**
   * Records that the user has dismissed the welcome modal. Uses `updateMany`
   * so a repeated dismissal (button + Escape + backdrop racing on close) is
   * idempotent — only sets `welcomedAt` when it is still `null`.
   */
  async markWelcomed(id: string) {
    await this.prisma.user.updateMany({
      where: { id, welcomedAt: null },
      data: { welcomedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // OAuth-account delegation (thin pass-throughs to UserOAuthService)
  // ---------------------------------------------------------------------------

  async createOAuthUser(email: string) {
    return this.userOAuthService.createOAuthUser(email);
  }

  async createOAuthUserAndLink(
    email: string,
    provider: string,
    providerId: string,
    providerEmail: string,
  ) {
    return this.userOAuthService.createOAuthUserAndLink(
      email,
      provider,
      providerId,
      providerEmail,
    );
  }

  async findOAuthAccount(provider: string, providerId: string) {
    return this.userOAuthService.findOAuthAccount(provider, providerId);
  }

  async linkOAuthAccount(
    userId: string,
    provider: string,
    providerId: string,
    providerEmail: string,
  ) {
    return this.userOAuthService.linkOAuthAccount(
      userId,
      provider,
      providerId,
      providerEmail,
    );
  }

  async updateOAuthProviderEmail(
    userId: string,
    provider: string,
    providerId: string,
    providerEmail: string,
  ): Promise<void> {
    return this.userOAuthService.updateOAuthProviderEmail(
      userId,
      provider,
      providerId,
      providerEmail,
    );
  }

  async listOAuthAccounts(userId: string) {
    return this.userOAuthService.listOAuthAccounts(userId);
  }

  async unlinkOAuthAccount(userId: string, provider: string): Promise<void> {
    return this.userOAuthService.unlinkOAuthAccount(userId, provider);
  }

  // ---------------------------------------------------------------------------
  // MFA / TOTP / recovery-code delegation (thin pass-throughs to UserMfaService)
  // ---------------------------------------------------------------------------

  async saveTotpSecret(userId: string, encryptedSecret: string) {
    return this.userMfaService.saveTotpSecret(userId, encryptedSecret);
  }

  async clearPendingTotpSecret(userId: string): Promise<void> {
    return this.userMfaService.clearPendingTotpSecret(userId);
  }

  async setMfaNonce(id: string, nonce: string): Promise<void> {
    return this.userMfaService.setMfaNonce(id, nonce);
  }

  async clearMfaNonce(id: string): Promise<void> {
    return this.userMfaService.clearMfaNonce(id);
  }

  async updateTotpLastUsedStep(id: string, step: number): Promise<boolean> {
    return this.userMfaService.updateTotpLastUsedStep(id, step);
  }

  async enableTotpWithRecoveryCodes(
    userId: string,
    codeHashes: string[],
    lastUsedStep: number,
  ) {
    return this.userMfaService.enableTotpWithRecoveryCodes(
      userId,
      codeHashes,
      lastUsedStep,
    );
  }

  async reissueRecoveryCodes(userId: string, codeHashes: string[]) {
    return this.userMfaService.reissueRecoveryCodes(userId, codeHashes);
  }

  async findUnusedRecoveryCodes(userId: string) {
    return this.userMfaService.findUnusedRecoveryCodes(userId);
  }

  async markRecoveryCodeUsed(id: string): Promise<boolean> {
    return this.userMfaService.markRecoveryCodeUsed(id);
  }

  async disableTwoFactor(id: string) {
    return this.userMfaService.disableTwoFactor(id);
  }
}
