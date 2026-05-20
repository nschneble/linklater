import { jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { CustomThrottlerGuard } from './custom-throttler.guard.js';
import {
  ThrottleMessage,
  THROTTLE_MESSAGE_KEY,
} from './throttle-message.decorator.js';
import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';

function makeGuard(reflector: Reflector) {
  const guard = Object.create(
    CustomThrottlerGuard.prototype,
  ) as CustomThrottlerGuard;
  Object.defineProperty(guard, 'reflector', { value: reflector });
  return guard;
}

function makeContext(
  handler: (...args: unknown[]) => unknown,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => null,
  } as unknown as ExecutionContext;
}

describe('CustomThrottlerGuard', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    jest.clearAllMocks();
  });

  it('returns the custom message when @ThrottleMessage is set on the handler', async () => {
    class FakeController {
      @ThrottleMessage('Too many login attempts')
      login() {}
    }

    const guard = makeGuard(reflector);
    const context = makeContext(FakeController.prototype.login);
    const message = await (
      guard as unknown as {
        getErrorMessage: (
          context: ExecutionContext,
          detail: ThrottlerLimitDetail,
        ) => Promise<string>;
      }
    ).getErrorMessage(context, {} as ThrottlerLimitDetail);

    expect(message).toBe('Too many login attempts');
  });

  it('falls back to "Too many requests" when no @ThrottleMessage decorator is present', async () => {
    class FakeController {
      undecorated() {}
    }

    const guard = makeGuard(reflector);
    const context = makeContext(FakeController.prototype.undecorated);
    const message = await (
      guard as unknown as {
        getErrorMessage: (
          context: ExecutionContext,
          detail: ThrottlerLimitDetail,
        ) => Promise<string>;
      }
    ).getErrorMessage(context, {} as ThrottlerLimitDetail);

    expect(message).toBe('Too many requests');
  });

  it('@ThrottleMessage decorator stores the message under THROTTLE_MESSAGE_KEY', () => {
    class FakeController {
      @ThrottleMessage('Rate limited')
      action() {}
    }

    const stored = Reflect.getMetadata(
      THROTTLE_MESSAGE_KEY,
      FakeController.prototype.action,
    );
    expect(stored).toBe('Rate limited');
  });
});
