import { Injectable } from '@nestjs/common';

import { TokensService } from '../tokens/tokens.service.js';

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
   * Looks up the raw token in the database and returns a minimal auth
   * user object if the token is valid.
   *
   * @param rawToken - The full raw PAT string (including `ltk_` prefix).
   * @returns `{ userId, email }` on success, or `null` when the token
   *   does not exist or has been revoked.
   */
  async validate(
    rawToken: string,
  ): Promise<{ userId: string; email: string } | null> {
    const user = await this.tokensService.validateToken(rawToken);
    if (!user) {
      return null;
    }
    return { userId: user.id, email: user.email };
  }
}
