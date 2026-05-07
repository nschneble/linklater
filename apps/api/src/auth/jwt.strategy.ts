import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * The decoded contents of a Linklater JWT. The `subject` field stores the
 * user UUID — this intentionally mirrors the JWT standard "sub" claim name
 * while keeping it explicit.
 *
 * NOTE: The JWT is signed with `JWT_SECRET` and expires after 90 days. The
 * 90-day TTL was chosen to match the bookmarklet token lifetime so users
 * rarely need to reinstall the bookmarklet.
 */
interface JwtPayload {
  email: string;
  subject: string;
}

/**
 * Passport strategy that validates JWTs sent as `Authorization: Bearer` tokens.
 * Registered under the name `'jwt'` so that `JwtAuthGuard` can reference it.
 *
 * `JWT_SECRET` is read from the environment at startup and throws immediately
 * if missing — this prevents the server from silently accepting unsigned tokens.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
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
   * @param payload - The decoded JWT payload.
   * @returns An `AuthUser` object with `userId` and `email`.
   */
  async validate(payload: JwtPayload) {
    return { userId: payload.subject, email: payload.email };
  }
}
