import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guards a route by validating the `Authorization: Bearer <token>` header
 * against the JWT secret. On success, Passport populates `request.user`
 * with the payload returned by `JwtStrategy.validate`. On failure it
 * throws a 401 Unauthorized.
 *
 * Explicitly rejects short-lived MFA challenge tokens (those carrying
 * `mfaPending: true`) so they cannot be used to access protected routes.
 *
 * Apply at controller class level to protect every route in that controller,
 * or at individual method level for finer-grained control.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser extends { mfaPending?: boolean }>(
    error: Error | null,
    user: TUser | null,
    info: unknown,
  ): TUser {
    if (error) throw error;
    if (!user) throw new UnauthorizedException();
    if (user.mfaPending) throw new UnauthorizedException('MFA challenge required');
    return user;
  }
}
