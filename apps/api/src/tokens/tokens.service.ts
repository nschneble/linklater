import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { sha256Hex } from '../common/index.js';
import { Prisma, TokenKind } from '../prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { mintRawToken } from './mint-raw-token.js';

export { TOKEN_PREFIX } from './mint-raw-token.js';

/**
 * Manages the lifecycle of personal access tokens (PATs).
 *
 * Only the SHA-256 hash of each token is stored in the database.
 * The raw token is returned once at creation and never again.
 * `validateToken` is called on every API request that presents an
 * `ltk_`-prefixed bearer token.
 *
 * The raw-token minting primitive lives in `./mint-raw-token` so that
 * `BookmarkletTokensService` can share it without exposing the primitive
 * through the barrel-exported `TokensService` class surface.
 */
@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a new PAT, stores only its hash, and returns the raw token
   * to the caller. The raw token is never stored and cannot be retrieved
   * later – the user must copy it immediately.
   *
   * @param userId - The UUID of the owning user.
   * @param name - A user-provided label (e.g. "Chrome Extension").
   * @returns The stored token record plus the one-time `rawToken`.
   */
  async create(userId: string, name: string) {
    const { rawToken, tokenHash, prefix } = mintRawToken();

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
   * Bookmarklet tokens (`kind = BOOKMARKLET`) are excluded – they are
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
   * Only standard user tokens (`kind = USER`) can be revoked here. The
   * retrievable secret-backed kinds are protected: a BOOKMARKLET is rotated
   * through `BookmarkletTokensService.regenerate` so the user always has a
   * working bookmarklet, and the API_DOCS token is auto-provisioned and never
   * surfaced for deletion – revoking either via this endpoint would silently
   * invalidate a raw token the user may have pasted elsewhere.
   *
   * @param userId - The UUID of the owning user (scope guard).
   * @param tokenId - The UUID of the token to delete.
   * @throws {NotFoundException} When no matching token exists for this user.
   * @throws {BadRequestException} When the token is a non-USER (protected) kind.
   */
  async revoke(userId: string, tokenId: string) {
    const existing = await this.prisma.apiToken.findUnique({
      where: { id: tokenId },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('API token not found');
    }

    if (existing.kind !== TokenKind.USER) {
      const message =
        existing.kind === TokenKind.BOOKMARKLET
          ? 'Use the Regenerate button to revoke the bookmarklet token'
          : 'This token is managed automatically and cannot be revoked';
      throw new BadRequestException(message);
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
   * The token `kind` and `tokenHash` ride along so the auth layer can scope
   * what the special retrievable kinds (BOOKMARKLET, API_DOCS) are allowed to
   * do and rate-limit them per token – see `TokenScopeService`.
   *
   * @param rawToken - The full raw token string (including `ltk_` prefix).
   * @returns The owning user plus the token's `kind` and `tokenHash`, or
   *   `null` if no token matches.
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

    return { user: stored.user, kind: stored.kind, tokenHash };
  }
}
