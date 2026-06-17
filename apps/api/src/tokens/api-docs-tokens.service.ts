import { Injectable } from '@nestjs/common';

import { Prisma, TokenKind } from '../prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { mintRawToken } from './mint-raw-token.js';

const API_DOCS_TOKEN_NAME = 'API Docs';

/**
 * Manages the single, hidden API-docs token per user.
 *
 * Mirrors `BookmarkletTokensService.getOrCreate`: the raw value is stored in
 * `secretValue` so the API docs page can pre-fill the live "try it out" panel
 * on every load — including from a new device. The token is auto-provisioned
 * on first request, never expires, and is never shown in the user's token
 * list (`TokensService.findAll` filters to `kind = USER`).
 *
 * Unlike the bookmarklet token there is intentionally NO regenerate path: the
 * user decided this token is invisible plumbing, so it is only ever minted
 * once (or transparently self-healed if its `secretValue` goes missing).
 *
 * The raw-token minting primitive is imported directly from `./mint-raw-token`
 * rather than reached through `TokensService`, keeping the primitive out of any
 * injected service surface so accidental reuse stays auditable.
 */
@Injectable()
export class ApiDocsTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the user's API-docs token, minting one if none exists.
   *
   * @param userId - The id of the owning user.
   * @returns Token summary including the raw token value.
   */
  async getOrCreate(userId: string) {
    const existing = await this.prisma.apiToken.findFirst({
      where: { userId, kind: TokenKind.API_DOCS },
    });

    if (existing && existing.secretValue) {
      return this.toSummary(existing);
    }

    // Row exists but secretValue is missing (data-integrity glitch, manual
    // patch, partial restore). Self-heal by re-minting instead of 500ing
    // every docs-page load.
    if (existing) {
      return this.reMint(userId);
    }

    const { rawToken, tokenHash, prefix } = mintRawToken();

    try {
      const stored = await this.prisma.apiToken.create({
        data: this.buildTokenData(userId, rawToken, tokenHash, prefix),
      });
      return this.toSummary(stored);
    } catch (error) {
      // Two tabs opened simultaneously can both hit the create branch; the
      // partial unique index on (userId) WHERE kind = 'API_DOCS' wins one
      // and rejects the other with P2002. Re-fetch the row the winning tab
      // inserted and return its raw value.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.apiToken.findFirst({
          where: { userId, kind: TokenKind.API_DOCS },
        });
        if (raced) {
          return this.toSummary(raced);
        }
      }
      throw error;
    }
  }

  /**
   * Replaces a corrupted API-docs row (missing `secretValue`) with a freshly
   * minted one in a single transaction. This is the self-heal path only — it
   * is never exposed to the user, because the API-docs token has no
   * regenerate affordance by design.
   */
  private async reMint(userId: string) {
    const { rawToken, tokenHash, prefix } = mintRawToken();

    const stored = await this.prisma.$transaction(async (transaction) => {
      await transaction.apiToken.deleteMany({
        where: { userId, kind: TokenKind.API_DOCS },
      });
      return transaction.apiToken.create({
        data: this.buildTokenData(userId, rawToken, tokenHash, prefix),
      });
    });

    return this.toSummary(stored);
  }

  /**
   * Builds the Prisma `data` payload for creating an API-docs token row.
   * Extracted to avoid repeating the identical field set in `getOrCreate`
   * and `reMint`.
   */
  private buildTokenData(
    userId: string,
    rawToken: string,
    tokenHash: string,
    prefix: string,
  ) {
    return {
      name: API_DOCS_TOKEN_NAME,
      prefix,
      tokenHash,
      kind: TokenKind.API_DOCS,
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
      // Every API_DOCS row must have a secretValue populated at creation. A
      // null here means a data-integrity violation — throw so it produces a
      // visible 500 rather than silently returning an empty token that leaves
      // the docs "try it out" panel unauthenticated with no error shown.
      throw new Error(
        `API docs token ${stored.id} is missing secretValue — data integrity violation`,
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
