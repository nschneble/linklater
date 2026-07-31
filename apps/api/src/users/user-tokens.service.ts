import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/index.js';

/**
 * Persistence for all per-user one-time tokens: email verification, password
 * reset, magic-link login, and pending-email-change. Each method takes the
 * SHA-256 hash of the raw token (callers are responsible for hashing the
 * value sent to the user).
 */
@Injectable()
export class UserTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stores a new email verification token hash and its expiry on the user
   * record. Overwrites any previously stored token. The raw token is sent
   * via email; only its SHA-256 hash is persisted.
   *
   * @param id - The UUID of the user.
   * @param tokenHash - The SHA-256 hash (hex) of the raw token.
   * @param expiresAt - When the token should be considered expired.
   */
  async updateVerificationToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    await this.prisma.user.update({
      where: { id },
      data: {
        verificationToken: tokenHash,
        verificationTokenExpiresAt: expiresAt,
      },
    });
  }

  /**
   * Looks up a user by the hash of their email verification token. Callers
   * must hash the raw token from the URL before invoking this method.
   *
   * @param tokenHash - The SHA-256 hash (hex) of the token from the link.
   * @returns The full user record, or `null` if no match.
   */
  async findByVerificationToken(tokenHash: string) {
    return this.prisma.user.findUnique({
      where: { verificationToken: tokenHash },
    });
  }

  /**
   * Marks the user's email as verified and clears the verification token
   * so it cannot be used again.
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
   * Stores a new password reset token hash and its expiry on the user
   * record. Overwrites any previously stored reset token. The raw token is
   * sent via email; only its SHA-256 hash is persisted.
   */
  async updateResetToken(id: string, tokenHash: string, expiresAt: Date) {
    await this.prisma.user.update({
      where: { id },
      data: { resetToken: tokenHash, resetTokenExpiresAt: expiresAt },
    });
  }

  /**
   * Looks up a user by the hash of their password reset token. Callers must
   * hash the raw token from the URL before invoking this method.
   */
  async findByResetToken(tokenHash: string) {
    return this.prisma.user.findUnique({ where: { resetToken: tokenHash } });
  }

  /**
   * Looks up a user by the hash of their magic-link token. Callers must hash
   * the raw token from the URL before invoking this method.
   */
  async findByMagicLinkToken(tokenHash: string) {
    return this.prisma.user.findUnique({
      where: { magicLinkToken: tokenHash },
    });
  }

  /**
   * Persists the hash of a magic-link token alongside its expiry. The raw
   * token is sent via email; only its SHA-256 hash is stored.
   */
  async updateMagicLinkToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { magicLinkToken: tokenHash, magicLinkTokenExpiresAt: expiresAt },
    });
  }

  async clearMagicLinkToken(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { magicLinkToken: null, magicLinkTokenExpiresAt: null },
    });
  }

  /**
   * Atomic compare-and-swap: clears the magic-link token only if it still
   * matches `tokenHash`. Prevents a parallel second click from consuming an
   * already-used token. Returns `true` when the token was cleared.
   */
  async consumeMagicLinkToken(
    userId: string,
    tokenHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, magicLinkToken: tokenHash },
      data: { magicLinkToken: null, magicLinkTokenExpiresAt: null },
    });
    return result.count === 1;
  }

  /**
   * Stores the pending new email address along with the hash of its
   * verification token and its expiry. The user's primary email is unchanged
   * until `UsersService.confirmPendingEmail` is called. The raw token is
   * sent via email; only its SHA-256 hash is persisted.
   */
  async updatePendingEmail(
    id: string,
    pendingEmail: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    await this.prisma.user.update({
      where: { id },
      data: {
        pendingEmail,
        pendingEmailToken: tokenHash,
        pendingEmailTokenExpiresAt: expiresAt,
      },
    });
  }

  /**
   * Looks up a user by the hash of the token stored for a pending email
   * change. Callers must hash the raw token from the URL before invoking
   * this method.
   */
  async findByPendingEmailToken(tokenHash: string) {
    return this.prisma.user.findUnique({
      where: { pendingEmailToken: tokenHash },
    });
  }

  /**
   * Persists the hash of an account-deletion confirmation token alongside its
   * expiry. The raw token is sent via email; only its SHA-256 hash is stored.
   * Used by `AuthService.deleteAccount` for accounts that have no password
   * and no MFA - those accounts cannot supply step-up credentials inline, so
   * deletion is gated behind an email-link confirmation instead.
   */
  async updateAccountDeletionToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountDeletionToken: tokenHash,
        accountDeletionTokenExpiresAt: expiresAt,
      },
    });
  }

  /**
   * Looks up a user by the hash of their account-deletion token. Callers must
   * hash the raw token from the URL before invoking this method.
   */
  async findByAccountDeletionToken(tokenHash: string) {
    return this.prisma.user.findUnique({
      where: { accountDeletionToken: tokenHash },
    });
  }

  /**
   * Atomic compare-and-swap: clears the account-deletion token only if it
   * still matches `tokenHash`. Prevents a parallel second click from
   * consuming an already-used token (the user could then be deleted twice
   * if the consumer races against itself). Returns `true` when the token
   * was cleared.
   */
  async consumeAccountDeletionToken(
    userId: string,
    tokenHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, accountDeletionToken: tokenHash },
      data: {
        accountDeletionToken: null,
        accountDeletionTokenExpiresAt: null,
      },
    });
    return result.count === 1;
  }

  /**
   * Clears any pending account-deletion token on the user. Used by the
   * "Never mind, keep my account" cancel flow and as a safety net for other
   * paths that should invalidate outstanding deletion tokens. Idempotent -
   * clearing already-null columns is a no-op.
   */
  async clearAccountDeletionToken(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountDeletionToken: null,
        accountDeletionTokenExpiresAt: null,
      },
    });
  }
}
