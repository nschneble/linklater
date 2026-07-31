import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

import { isTestingUi } from '../common/index.js';
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
 * - API_DOCS: usable on NO route. The in-page "try it out" explorer that
 *   used to spend it against the live API was removed; nothing on the docs
 *   page consumes or displays it either (the cURL example there hardcodes a
 *   `YOUR_API_TOKEN` placeholder, never the real value – see
 *   `CurlExample.tsx`). The token is retained purely as auto-provisioned
 *   server-side plumbing whose teardown is a separate, deferred decision
 *   (see `ApiDocsTokensService`'s docstring). This used to be gated by an
 *   `Origin` header equality check, but `Origin`
 *   is a plain request header any non-browser client (curl, a script) can
 *   set to whatever value it likes – it enforced nothing, and once past it
 *   the token authenticated exactly like a full-access USER token (CWE-346).
 *   Rejecting unconditionally is the honest version of the same route-scope
 *   shape BOOKMARKLET already uses, just with an allowed-route set that's
 *   currently empty because nothing needs this token to call a real API
 *   route today. If a future feature needs scoped API_DOCS access, extend
 *   it the same way BOOKMARKLET is scoped – a route-level decorator +
 *   reflector check – not another header check.
 *
 * Both kinds are additionally rate-limited per token (the API_DOCS limit is
 * unreachable today since the token is rejected before rate limiting runs,
 * but stays correct if route-scoping is ever added for it). The standard
 * USER token is unaffected and passes straight through.
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
  }): Promise<void> {
    const { kind, tokenHash, context } = input;

    if (kind === TokenKind.BOOKMARKLET) {
      this.assertBookmarkletRoute(context);
    } else if (kind === TokenKind.API_DOCS) {
      this.rejectApiDocsToken();
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

  /**
   * The API_DOCS token has no route to be scoped to (see the class
   * docstring) – always rejects. `never` return type so a future call site
   * that expects this to sometimes pass fails to compile instead of
   * silently no-op-ing.
   */
  private rejectApiDocsToken(): never {
    throw new ForbiddenException(
      'The API docs token cannot be used to call the API',
    );
  }

  private async assertWithinRateLimit(
    kind: SpecialTokenKind,
    tokenHash: string,
  ): Promise<void> {
    // tuffgal hammers tokens; skip the limit (not scope) in test mode
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
