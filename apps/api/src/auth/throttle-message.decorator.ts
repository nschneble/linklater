import { SetMetadata } from '@nestjs/common';

/** Metadata key used by `CustomThrottlerGuard.getErrorMessage` to look up the route-level message. */
export const THROTTLE_MESSAGE_KEY = 'throttleMessage';

/**
 * Attaches a custom 429 error message to a route handler so that
 * `CustomThrottlerGuard` can return something more meaningful than the
 * generic "Too many requests" when the rate limit is hit.
 *
 * @example
 * @ThrottleMessage('Too many login attempts')
 * @Post('login')
 * async login(@Req() request: AuthRequest) { … }
 */
export const ThrottleMessage = (message: string) =>
  SetMetadata(THROTTLE_MESSAGE_KEY, message);
