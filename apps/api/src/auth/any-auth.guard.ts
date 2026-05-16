import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { ApiKeyStrategy } from './api-key.strategy.js';
import { TOKEN_PREFIX } from '../tokens/tokens.service.js';

/**
 * Accepts either a standard JWT (web app) or a personal access token (PAT)
 * prefixed with `ltk_` (browser extensions and other API clients).
 *
 * PAT path: if the Bearer token starts with `ltk_`, it is validated by
 * `ApiKeyStrategy` and `request.user` is populated directly.
 *
 * JWT path: all other tokens fall through to the standard Passport JWT flow,
 * preserving the `mfaPending` guard inherited from `JwtAuthGuard`.
 */
@Injectable()
export class AnyAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly apiKeyStrategy: ApiKeyStrategy) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      throw new UnauthorizedException();
    }

    if (token.startsWith(TOKEN_PREFIX)) {
      const user = await this.apiKeyStrategy.validate(token);
      if (!user) {
        throw new UnauthorizedException();
      }
      (request as Request & { user: unknown }).user = user;
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  override handleRequest<TUser extends { mfaPending?: boolean }>(
    error: Error | null,
    user: TUser | null,
    _info: unknown,
  ): TUser {
    if (error) throw error;
    if (!user) throw new UnauthorizedException();
    if (user.mfaPending)
      throw new UnauthorizedException('MFA challenge required');
    return user;
  }
}
