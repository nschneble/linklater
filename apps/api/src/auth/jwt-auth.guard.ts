import { AuthGuard } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

/**
 * Guards a route by validating the `Authorization: Bearer <token>` header
 * against the JWT secret. On success, Passport populates `request.user`
 * with the payload returned by `JwtStrategy.validate`. On failure it
 * throws a 401 Unauthorized.
 *
 * Apply at controller class level to protect every route in that controller,
 * or at individual method level for finer-grained control.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
