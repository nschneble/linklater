import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import { THROTTLE_MESSAGE_KEY } from './throttle-message.decorator.js';

/**
 * Extends ThrottlerGuard to surface per-route 429 messages set via
 * @ThrottleMessage(). Falls back to the default 'Too Many Requests' when no
 * message is configured for the route.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
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
