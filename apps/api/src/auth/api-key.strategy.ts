import { Injectable } from '@nestjs/common';

import { TokenKind } from '../prisma/index.js';
import { TokensService } from '../tokens/tokens.service.js';

/**
 * The auth payload produced by a successful PAT validation. Beyond the
 * `request.user` fields, it carries the token's `kind` and `tokenHash` so
 * `AnyAuthGuard` can hand them to `TokenScopeService` for scope + rate-limit
 * enforcement before populating `request.user`.
 */
export interface ValidatedToken {
  userId: string;
  email: string;
  kind: TokenKind;
  tokenHash: string;
}

/**
 * Validates personal access tokens (PATs) for non-browser API clients.
 * This is not a Passport strategy in the traditional sense – it is a
 * plain injectable service invoked directly by `AnyAuthGuard` when the
 * bearer token starts with the `ltk_` prefix.
 *
 * The separation keeps the PAT validation path decoupled from Passport's
 * strategy pipeline while still integrating with `AnyAuthGuard`.
 */
@Injectable()
export class ApiKeyStrategy {
  constructor(private readonly tokensService: TokensService) {}

  /**
   * Looks up the raw token in the database and returns the auth payload if
   * the token is valid.
   *
   * @param rawToken - The full raw PAT string (including `ltk_` prefix).
   * @returns The validated token payload on success, or `null` when the token
   *   does not exist or has been revoked.
   */
  async validate(rawToken: string): Promise<ValidatedToken | null> {
    const result = await this.tokensService.validateToken(rawToken);
    if (!result) {
      return null;
    }
    return {
      userId: result.user.id,
      email: result.user.email,
      kind: result.kind,
      tokenHash: result.tokenHash,
    };
  }
}
