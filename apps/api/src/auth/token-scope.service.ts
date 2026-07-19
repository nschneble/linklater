import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { isTestingUi } from '../common/testing-ui.js';
import { TokenKind } from '../prisma/index.js';
import { BOOKMARKLET_SCOPE_KEY } from './token-scope.decorator.js';

/** The two retrievable kinds that carry scope + rate-limit restrictions. */
type SpecialTokenKind =
  typeof TokenKind.BOOKMARKLET | typeof TokenKind.API_DOCS;

interface RateLimit {
  /** Sliding window length, in milliseconds. */
  ttl: number;
  /** Maximum requests allowed within the window. */
  limit: number;
}

/**
 * Per-token-kind rate limits, deliberately tighter than a normal user token
 * (which is unthrottled at the route level). A human clicking the bookmarklet
 * stays well under these; an attacker holding a leaked token cannot
 * bulk-saturate the API. The API_DOCS limit is retained even though the
 * in-page explorer that used to spend it was removed – the token is still
 * auto-provisioned server-side, so its scope stays defined.
 */
const SCOPE_RATE_LIMITS: Record<SpecialTokenKind, RateLimit> = {
  [TokenKind.BOOKMARKLET]: { ttl: 60_000, limit: 20 },
  [TokenKind.API_DOCS]: { ttl: 60_000, limit: 30 },
};

/**
 * Confines the two special retrievable tokens to their single purpose so a
 * leaked-and-never-rotated token can do little harm:
 *
 * - BOOKMARKLET: usable only on routes marked `@AllowsBookmarkletToken()`
 *   (just `POST /links`). Anything else is a 403.
 * - API_DOCS: usable only from the app's own origin (the docs page is the one
 *   place that embeds it), so a copy pasted into curl or another site is inert.
 *
 * Both kinds are additionally rate-limited per token. The standard USER token
 * is unaffected and passes straight through.
 */
@Injectable()
export class TokenScopeService {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
  ) {}

  /**
   * Enforces scope and rate limits for a validated PAT. A no-op for USER
   * tokens; throws `ForbiddenException` (out-of-scope) or `ThrottlerException`
   * (429) for the special kinds.
   */
  async enforce(input: {
    kind: TokenKind;
    tokenHash: string;
    context: ExecutionContext;
    request: Request;
  }): Promise<void> {
    const { kind, tokenHash, context, request } = input;

    if (kind === TokenKind.BOOKMARKLET) {
      this.assertBookmarkletRoute(context);
    } else if (kind === TokenKind.API_DOCS) {
      this.assertDocsOrigin(request);
    } else {
      return;
    }

    await this.assertWithinRateLimit(kind, tokenHash);
  }

  private assertBookmarkletRoute(context: ExecutionContext): void {
    const allowed = this.reflector.getAllAndOverride<boolean>(
      BOOKMARKLET_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed) {
      throw new ForbiddenException(
        'The bookmarklet token can only be used to save new links',
      );
    }
  }

  private assertDocsOrigin(request: Request): void {
    const appOrigin = this.appOrigin();
    if (!appOrigin || request.headers.origin !== appOrigin) {
      throw new ForbiddenException(
        'The API docs token only works from the documentation page',
      );
    }
  }

  /**
   * The app's frontend origin (scheme + host + port), derived from `APP_URL`.
   * Returns `null` when `APP_URL` is unset or unparseable so the docs-origin
   * check fails closed rather than letting the token through unguarded.
   */
  private appOrigin(): string | null {
    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      return null;
    }
    try {
      return new URL(appUrl).origin;
    } catch {
      return null;
    }
  }

  private async assertWithinRateLimit(
    kind: SpecialTokenKind,
    tokenHash: string,
  ): Promise<void> {
    // Mirror CustomThrottlerGuard: the tuffgal harness hammers these tokens
    // across many stories, so skip the limit (not the scope checks) in test mode.
    if (isTestingUi()) {
      return;
    }

    const { ttl, limit } = SCOPE_RATE_LIMITS[kind];
    const key = `token-scope:${kind}:${tokenHash}`;
    const record = await this.storage.increment(key, ttl, limit, ttl, kind);

    if (record.isBlocked) {
      throw new ThrottlerException(
        'Too many requests for this token. Try again shortly.',
      );
    }
  }
}
