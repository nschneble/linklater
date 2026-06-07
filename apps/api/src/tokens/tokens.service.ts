import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { sha256Hex } from '../common/crypto-tokens.js';
import { Prisma, TokenKind } from '../prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The prefix prepended to every personal access token. Used by `AnyAuthGuard`
 * to distinguish PATs from JWTs without decoding the token. */
export const TOKEN_PREFIX = 'ltk_';

/**
 * Number of characters from the raw token preserved as `prefix`.
 * Stored so the user can visually identify which token is which
 * in the token list without exposing the full secret.
 */
const DISPLAY_PREFIX_LENGTH = 12;

/**
 * Manages the lifecycle of personal access tokens (PATs).
 *
 * Only the SHA-256 hash of each token is stored in the database.
 * The raw token is returned once at creation and never again.
 * `validateToken` is called on every API request that presents an
 * `ltk_`-prefixed bearer token.
 *
 * `mintRawToken` is public so that `BookmarkletTokensService` can share the
 * same low-level minting primitive without duplicating the crypto logic.
 */
@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a new PAT, stores only its hash, and returns the raw token
   * to the caller. The raw token is never stored and cannot be retrieved
   * later — the user must copy it immediately.
   *
   * @param userId - The UUID of the owning user.
   * @param name - A user-provided label (e.g. "Chrome Extension").
   * @returns The stored token record plus the one-time `rawToken`.
   */
  async create(userId: string, name: string) {
    const { rawToken, tokenHash, prefix } = this.mintRawToken();

    const stored = await this.prisma.apiToken.create({
      data: { name, prefix, tokenHash, userId },
    });

    return {
      id: stored.id,
      name: stored.name,
      prefix: stored.prefix,
      createdAt: stored.createdAt,
      lastUsedAt: stored.lastUsedAt,
      rawToken,
    };
  }

  /**
   * Returns all PAT summaries for the given user, ordered newest-first.
   * The `tokenHash` field is never included in the response.
   *
   * Bookmarklet tokens (`kind = BOOKMARKLET`) are excluded — they are
   * managed through the dedicated bookmarklet endpoints, not the regular
   * token list, because their lifecycle is "always one, never shown in the
   * list".
   *
   * @param userId - The UUID of the owning user.
   * @returns Array of token summaries without `rawToken` or `tokenHash`.
   */
  async findAll(userId: string) {
    const tokens = await this.prisma.apiToken.findMany({
      where: { userId, kind: TokenKind.USER },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map(({ id, name, prefix, createdAt, lastUsedAt }) => ({
      id,
      name,
      prefix,
      createdAt,
      lastUsedAt,
    }));
  }

  /**
   * Permanently deletes a token, preventing any further API access with it.
   * The `userId` scope ensures users can only revoke their own tokens.
   *
   * Bookmarklet tokens cannot be revoked through this method — users must
   * use `regenerateBookmarkletToken` instead so they always have a working
   * bookmarklet to drag to their bookmarks bar.
   *
   * @param userId - The UUID of the owning user (scope guard).
   * @param tokenId - The UUID of the token to delete.
   * @throws {NotFoundException} When no matching token exists for this user.
   * @throws {BadRequestException} When the token is a bookmarklet token.
   */
  async revoke(userId: string, tokenId: string) {
    const existing = await this.prisma.apiToken.findUnique({
      where: { id: tokenId },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('API token not found');
    }

    if (existing.kind === TokenKind.BOOKMARKLET) {
      throw new BadRequestException(
        'Use the Regenerate button to revoke the bookmarklet token',
      );
    }

    try {
      await this.prisma.apiToken.delete({
        where: { id: tokenId, userId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('API token not found');
      }
      throw error;
    }
  }

  /**
   * Looks up a token by its SHA-256 hash and, on a match, updates
   * `lastUsedAt` to the current time before returning the owning user.
   * Used by `ApiKeyStrategy` on every request that presents an `ltk_` token.
   *
   * @param rawToken - The full raw token string (including `ltk_` prefix).
   * @returns The owning `User` record, or `null` if no token matches.
   */
  async validateToken(rawToken: string) {
    const tokenHash = sha256Hex(rawToken);

    const stored = await this.prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      return null;
    }

    void this.prisma.apiToken
      .update({ where: { tokenHash }, data: { lastUsedAt: new Date() } })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to update lastUsedAt for token: ${String(error)}`,
        );
      });

    return stored.user;
  }

  mintRawToken() {
    const rawToken = TOKEN_PREFIX + randomBytes(24).toString('base64url');
    const tokenHash = sha256Hex(rawToken);
    const prefix = rawToken.slice(0, DISPLAY_PREFIX_LENGTH);
    return { rawToken, tokenHash, prefix };
  }
}
