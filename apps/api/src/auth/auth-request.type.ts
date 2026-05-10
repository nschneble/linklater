import { Request } from 'express';

/**
 * The user payload Passport attaches to `request.user` after a successful
 * validation. Contains only the minimum fields needed to identify the
 * authenticated user.
 */
export interface AuthUser {
  /** The email address of the authenticated user. */
  email: string;
  /** The UUID of the authenticated user. */
  userId: string;
}

/**
 * Extends the Express `Request` type so that controllers protected by
 * `JwtAuthGuard` or `LocalAuthGuard` can access `request.user` with
 * proper TypeScript typing instead of casting through `unknown`.
 */
export interface AuthRequest extends Request {
  user: AuthUser;
}
