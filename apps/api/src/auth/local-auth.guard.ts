import { AuthGuard } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

/**
 * Guards a route using Passport's local strategy, which validates a plain
 * email/password pair against the stored bcrypt hash. Used exclusively on
 * the POST /auth/login endpoint. On failure it throws a 401 Unauthorized.
 *
 * After success, Passport sets `request.user` to the object returned by
 * `LocalStrategy.validate`, which should be `{ userId, email }`.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
