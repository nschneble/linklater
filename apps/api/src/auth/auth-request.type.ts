import { Request } from 'express';

/**
 * The user payload that Passport attaches to `request.user` after a
 * successful JWT or local strategy validation. Contains only the
 * minimum fields needed to identify the authenticated principal.
 */
export interface AuthUser {
  /** The UUID of the authenticated user. */
  email: string;
  /** The email address of the authenticated user. */
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
