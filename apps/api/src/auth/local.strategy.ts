import { AuthService } from './auth.service.js';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

/**
 * Passport strategy for email/password authentication. Registered under
 * the name `'local'` so that `LocalAuthGuard` can reference it.
 *
 * `usernameField` is overridden to `'email'` because passport-local
 * defaults to `'username'`. Without this override the login body would
 * need a `username` field instead of `email`.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  /**
   * Validates an email/password pair by delegating to
   * `AuthService.validateUser`. Passport calls this before the route
   * handler and attaches the return value to `request.user`.
   *
   * Returns only `{ userId, email }` — the MFA gate is enforced inside
   * `AuthService.login`, which fetches the user by ID. Returning extra
   * fields here historically tempted callers to short-circuit that gate.
   *
   * @param email - The email address submitted in the request body.
   * @param password - The plain-text password submitted in the request body.
   *
   * @returns A minimal user object `{ userId, email }` on success.
   *
   * @throws {UnauthorizedException} When the credentials are invalid.
   */
  async validate(email: string, password: string) {
    const user = await this.authService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    return {
      userId: user.id,
      email: user.email,
    };
  }
}
