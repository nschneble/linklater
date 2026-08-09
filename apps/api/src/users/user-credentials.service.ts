import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as bcrypt from 'bcryptjs';
import { Prisma, PrismaService } from '../prisma/index.js';

/**
 * Owns what an account can still log in with: setting a first password,
 * replacing one behind a reset token, reading whether any login path survives,
 * and holding the row lock that makes that reading safe to act on.
 *
 * `AuthService` and `OAuthLinkService` decide whether a credential change is
 * allowed; this service performs the persistence half.
 */
@Injectable()
export class UserCredentialsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
