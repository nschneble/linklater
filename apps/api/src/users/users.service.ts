import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { Prisma, PrismaService } from '../prisma/index.js';
import { assertValidCustomTheme } from './custom-theme.js';
import { withoutPasswordHash } from './users.utils.js';
import { VALID_MODES, VALID_THEMES } from './users.constants.js';
import * as bcrypt from 'bcryptjs';

export { VALID_MODES, VALID_THEMES };

/**
 * Inputs accepted by `UsersService.updateMe`. All fields are optional; only
 * provided keys are written to the database.
 */
export interface UpdateMeInput {
  /** Toggles the color-vision-deficient mode flag. */
  cvdMode?: boolean;
  /**
   * The user's editable Custom theme: a per-mode map of bundle token names to
   * CSS color strings. Persisted verbatim to the `customTheme` JSON column.
   */
  customTheme?: CustomTheme;
  /** Whether the Custom theme is shown in the theme picker. */
  customThemeEnabled?: boolean;
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
 * A user's editable Custom theme as stored in the `customTheme` JSON column: a
 * per-mode map of bundle token names (e.g. `--mount-border`) to CSS color
 * strings. Both modes are optional. The exact token set is enforced
 * client-side, so this stays a free-form record.
 */
export interface CustomTheme {
  dark?: Record<string, string>;
  light?: Record<string, string>;
}

/**
 * Manages user accounts – creation, lookup, update, and deletion. All methods
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
   * `password`, `theme`, `mode`, `cvdMode`, and `customTheme` may be changed in
   * a single call.
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
      customTheme?: Prisma.InputJsonValue;
      customThemeEnabled?: boolean;
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
          'Use the set-password endpoint to add a password to a passwordless account',
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

    if (data.customTheme !== undefined) {
      // The DTO only guarantees the broad `{ dark?, light? }` string-map shape.
      // Guard against an oversized blob or unknown token keys before persisting
      // (defense-in-depth; the editor already constrains what it sends).
      assertValidCustomTheme(data.customTheme);
      // The DTO guarantees a `{ dark?, light? }` map of string→string, which is
      // JSON-safe, but its named-key interface lacks the index signature
      // Prisma's `InputJsonValue` requires — assert across that structural gap.
      updateData.customTheme = data.customTheme as Prisma.InputJsonValue;
    }

    if (data.customThemeEnabled !== undefined) {
      updateData.customThemeEnabled = data.customThemeEnabled;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return withoutPasswordHash(user);
  }

  /**
   * Finds a user by email address. Returns the full Prisma User record
   * *including* `passwordHash` – callers that expose user data must call
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

  /**
   * Finds a user by UUID and returns the full record including the password
   * hash. Used by auth flows that must validate credentials (e.g. password
   * change, reauthentication). Unlike `findById`, this intentionally exposes
   * `passwordHash` – callers must not forward the result to the client.
   *
   * @param id - The UUID of the user.
   * @returns The full user record with `passwordHash` included.
   * @throws {NotFoundException} When no user exists with the given ID.
   */
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

  /**
   * Sets the user's password for the first time. Intended for OAuth-registered
   * accounts that choose to add a password after initial sign-up. Rejects if
   * the account already has a password (use `resetPasswordWithToken` instead).
   *
   * @param userId - The UUID of the user.
   * @param password - The new plaintext password to hash and store.
   * @throws {NotFoundException} When no user exists with the given ID.
   * @throws {BadRequestException} When the account already has a password.
   */
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

  /**
   * Marks the user's email address as verified by setting `emailVerifiedAt`.
   * Called during initial registration verification and when a magic-link
   * user later adds a password via the reset flow.
   *
   * @param id - The UUID of the user.
   */
  async markEmailVerified(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /**
   * Records that the user has dismissed the welcome modal. Uses `updateMany`
   * so a repeated dismissal (button + Escape + backdrop racing on close) is
   * idempotent – only sets `welcomedAt` when it is still `null`.
   */
  async markWelcomed(id: string) {
    await this.prisma.user.updateMany({
      where: { id, welcomedAt: null },
      data: { welcomedAt: new Date() },
    });
  }
}
