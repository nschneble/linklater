import { Injectable } from '@nestjs/common';

import { Prisma, TokenKind } from '../prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { mintRawToken } from './mint-raw-token.js';

const BOOKMARKLET_TOKEN_NAME = 'Bookmarklet';

/**
 * Manages the single bookmarklet token per user.
 *
 * Unlike regular PATs, the bookmarklet token's raw value is stored in
 * `secretValue` so the settings page can embed it in the `javascript:`
 * URL on every load - including from a new device.
 *
 * The raw-token minting primitive is imported directly from
 * `./mint-raw-token` rather than reached through `TokensService`. Keeping
 * the primitive out of any injected service surface makes accidental reuse
 * less likely.
 */
@Injectable()
export class BookmarkletTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the user's bookmarklet token, minting one if none exists.
   *
   * @param userId - The UUID of the owning user.
   * @returns Token summary including the raw token value.
   */
  async getOrCreate(userId: string) {
    const existing = await this.prisma.apiToken.findFirst({
      where: { userId, kind: TokenKind.BOOKMARKLET },
    });

    if (existing && existing.secretValue) {
      return this.toSummary(existing);
    }

    // missing secretValue: self-heal by regenerating, don't 500 the page
    if (existing) {
      return this.regenerate(userId);
    }

    const { rawToken, tokenHash, prefix } = mintRawToken();

    try {
      const stored = await this.prisma.apiToken.create({
        data: this.buildTokenData(userId, rawToken, tokenHash, prefix),
      });
      return this.toSummary(stored);
    } catch (error) {
      // concurrent create: partial unique index rejects the loser with P2002
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.apiToken.findFirst({
          where: { userId, kind: TokenKind.BOOKMARKLET },
        });
        if (raced) {
          return this.toSummary(raced);
        }
      }
      throw error;
    }
  }

  /**
   * Replaces the user's bookmarklet token with a freshly minted one in a
   * single transaction. Used when the user clicks "Regenerate" to invalidate
   * any bookmarklet they previously dragged to their bookmarks bar.
   *
   * @param userId - The UUID of the owning user.
   * @returns Token summary including the new raw token value.
   */
  async regenerate(userId: string) {
    const { rawToken, tokenHash, prefix } = mintRawToken();

    const stored = await this.prisma.$transaction(async (transaction) => {
      await transaction.apiToken.deleteMany({
        where: { userId, kind: TokenKind.BOOKMARKLET },
      });
      return transaction.apiToken.create({
        data: this.buildTokenData(userId, rawToken, tokenHash, prefix),
      });
    });

    return this.toSummary(stored);
  }

  /**
   * Builds the Prisma `data` payload for creating a bookmarklet token row.
   * Extracted to avoid repeating the identical field set in `getOrCreate`
   * and `regenerate`.
   */
  private buildTokenData(
    userId: string,
    rawToken: string,
    tokenHash: string,
    prefix: string,
  ) {
    return {
      name: BOOKMARKLET_TOKEN_NAME,
      prefix,
      tokenHash,
      kind: TokenKind.BOOKMARKLET,
      secretValue: rawToken,
      userId,
    };
  }

  private toSummary(stored: {
    id: string;
    name: string;
    prefix: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    secretValue: string | null;
  }) {
    if (!stored.secretValue) {
      // null secretValue: fail loud vs a silently broken bookmarklet
      throw new Error(
        `Bookmarklet token ${stored.id} is missing secretValue – data integrity violation`,
      );
    }
    return {
      id: stored.id,
      name: stored.name,
      prefix: stored.prefix,
      createdAt: stored.createdAt,
      lastUsedAt: stored.lastUsedAt,
      rawToken: stored.secretValue,
    };
  }
}
