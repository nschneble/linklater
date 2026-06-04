import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { THROTTLE_MESSAGE_KEY } from './throttle-message.decorator.js';
import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';

/**
 * Extends ThrottlerGuard to surface per-route 429 messages set via
 * @ThrottleMessage(). Falls back to the default 'Too Many Requests' when no
 * message is configured for the route.
 *
 * When `TESTING_UI=1` (set by `npm run dev:test`), every throttled route is
 * bypassed so the testing-ui harness can hammer auth endpoints across many
 * stories without tripping production rate-limits.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected override shouldSkip(_context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(process.env.TESTING_UI === '1');
  }

  protected override async getErrorMessage(
    context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    return (
      this.reflector.get<string>(THROTTLE_MESSAGE_KEY, context.getHandler()) ??
      'Too many requests'
    );
  }
}
