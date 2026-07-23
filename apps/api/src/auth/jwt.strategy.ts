import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * The decoded contents of a Linklater JWT. The `subject` field stores the
 * user UUID – this intentionally mirrors the JWT standard "sub" claim name
 * while keeping it explicit.
 *
 * NOTE: The JWT is signed with `JWT_SECRET` and is short-lived. It expires
 * after 1 hour (see `signOptions.expiresIn` in `auth.module.ts`). Sessions
 * outlive that hour via the longer-lived refresh token, which is rotated on
 * every use (see `RefreshTokenService`), so a leaked access token is only
 * usable for a short window – except that a stale-but-unexpired token can be
 * force-revoked early via `tokenVersion` (see `validate` below).
 */
interface JwtPayload {
  email: string;
  subject: string;
  mfaPending?: boolean;
  tokenVersion?: number;
}

/**
 * Passport strategy that validates JWTs sent as `Authorization: Bearer` tokens.
 * Registered under the name `'jwt'` so that `JwtAuthGuard` can reference it.
 *
 * `JWT_SECRET` is read from the environment at startup and throws immediately
 * if missing – this prevents the server from silently accepting unsigned tokens.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set');
        return process.env.JWT_SECRET;
      })(),
    });
  }

  /**
   * Called by Passport after the token signature is verified. The return value
   * is attached to `request.user` for the rest of the request lifecycle.
   *
   * Also re-checks the token's embedded `tokenVersion` against the user row's
   * current value. A signed-but-not-yet-expired access token is otherwise
   * unrevokable (the JWT itself carries no server-side state); bumping
   * `tokenVersion` is the one place that forces an outstanding access token to
   * stop working before its natural 1h expiry (see
   * `UsersService.verifyEmailAndInvalidateStalePassword`). A token signed
   * before this check existed carries no `tokenVersion` claim, which is
   * treated as `0` to match the column's default so already-issued tokens
   * keep working until they next rotate.
   *
   * @param payload - The decoded JWT payload.
   * @returns An `AuthUser` object with `userId` and `email`, or `null` to
   *   reject the token (mapped to a 401 by `JwtAuthGuard`).
   */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.subject },
      select: { tokenVersion: true },
    });
    if (!user || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
      return null;
    }

    return {
      userId: payload.subject,
      email: payload.email,
      mfaPending: payload.mfaPending,
    };
  }
}
