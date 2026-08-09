import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { assertValidCustomTheme } from './custom-theme.js';
import * as bcrypt from 'bcryptjs';
import { Prisma, PrismaService } from '../prisma/index.js';
import { VALID_MODES, VALID_THEMES } from './users.constants.js';
import { withoutPasswordHash } from './users.utils.js';

export { VALID_MODES, VALID_THEMES };

/**
 * Inputs accepted by `UsersService.updateMe`. All fields are optional; only
 * provided keys are written to the database.
 */
export interface UpdateMeInput {
  /** Toggles the color-vision-deficient mode flag. */
  cvdMode?: boolean;
  /** Toggles the dyslexia-friendly font flag. */
  dyslexicFont?: boolean;
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
      // surface the unique-constraint race as a 409, not a leaked P2002 500
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
   * `password`, `theme`, `mode`, `cvdMode`, `dyslexicFont`, and `customTheme`
   * may be changed in a single call.
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
      dyslexicFont?: boolean;
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

    if (data.dyslexicFont !== undefined) {
      updateData.dyslexicFont = data.dyslexicFont;
    }

    if (data.customTheme !== undefined) {
      // defense-in-depth: reject oversized blobs or unknown token keys
      assertValidCustomTheme(data.customTheme);
      // DTO's named keys lack the index signature InputJsonValue needs
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
   * Reports the account's login-credential state: whether it has a password
   * and which OAuth providers it still has linked. Resolves both from a single
   * primary-key lookup with a nested account select so the OAuth unlink guard
   * never needs a second round-trip.
   *
   * @param id - The UUID of the user.
   * @param client - Transaction client to read through; defaults to the shared
   *   Prisma client for standalone, non-transactional callers.
   * @returns `hasPassword` and the list of linked OAuth provider names.
   * @throws {NotFoundException} When no user exists with the given ID.
   */
  async getCredentialState(
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<{ hasPassword: boolean; oauthProviders: string[] }> {
    const user = await client.user.findUnique({
      where: { id },
      select: {
        passwordHash: true,
        oauthAccounts: { select: { provider: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      hasPassword: user.passwordHash !== null,
      oauthProviders: user.oauthAccounts.map((account) => account.provider),
    };
  }

  /**
   * Takes a row-level write lock on the user's row for the lifetime of the
   * surrounding transaction. Two transactions that lock the same row are
   * serialized: the second blocks until the first commits, so it reads the
   * first's committed writes before continuing. The OAuth unlink guard uses
   * this so two concurrent unlinks of different providers cannot both pass the
   * "a login path must survive" check against a stale provider set and strand
   * a passwordless account.
   *
   * Only meaningful inside an interactive transaction: pass that transaction's
   * client so the lock is held until the transaction commits or rolls back.
   *
   * @param id - The UUID of the user row to lock.
   * @param client - The active transaction client that holds the lock.
   */
  async lockUserRow(
    id: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
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
      // null return lets magic-link signup fall back to a login link
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
   * Marks the user's email verified via an externally-controlled channel
   * (OAuth provider assertion, or a magic-link token delivered to the
   * user's inbox) whose row was not necessarily created by the same person.
   * A password set on the row before this moment was never proven to belong
   * to the email's real owner – closing an account-pre-hijacking window – so
   * it is invalidated here, alongside every outstanding session that could
   * have been minted against it: `tokenVersion` is bumped (forces out any
   * live access token – see `JwtStrategy.validate`) and every refresh token
   * / extension auth code for the user is deleted (forces out anything that
   * could otherwise mint a *new* access token from the stale session).
   *
   * All three writes run in one transaction. Splitting the `tokenVersion`
   * bump from the refresh-token deletion into two separate awaits reopens
   * the exact window this method exists to close: a request racing in
   * between would read the just-bumped `tokenVersion` via
   * `RefreshTokenService.refresh` (still-valid refresh token, not yet
   * deleted) and mint a fresh access token carrying the *new* version –
   * one `JwtStrategy.validate` would accept for a full further hour,
   * with which `POST /auth/set-password` could re-establish a credential.
   *
   * Only call this from the FIRST verification of a row (guard on
   * `!emailVerifiedAt` at the call site); calling it on an already-verified
   * account would wipe a legitimately-set password on every subsequent
   * OAuth/magic-link sign-in.
   *
   * @param id - The UUID of the user.
   */
  async verifyEmailAndInvalidateStalePassword(id: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          emailVerifiedAt: new Date(),
          passwordHash: null,
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.extensionAuthCode.deleteMany({ where: { userId: id } }),
    ]);
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
