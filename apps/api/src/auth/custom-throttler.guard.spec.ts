import { CustomThrottlerGuard } from './custom-throttler.guard.js';
import { jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import {
  THROTTLE_MESSAGE_KEY,
  ThrottleMessage,
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
  const originalTestingUi = process.env.TESTING_UI;

  beforeEach(() => {
    reflector = new Reflector();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalTestingUi === undefined) {
      delete process.env.TESTING_UI;
    } else {
      process.env.TESTING_UI = originalTestingUi;
    }
  });

  describe('shouldSkip', () => {
    function callShouldSkip(): Promise<boolean> {
      const guard = makeGuard(reflector);
      const context = makeContext(() => undefined);
      return (
        guard as unknown as {
          shouldSkip: (context: ExecutionContext) => Promise<boolean>;
        }
      ).shouldSkip(context);
    }

    it('returns true when TESTING_UI=1 so the harness bypasses rate-limits', async () => {
      process.env.TESTING_UI = '1';
      await expect(callShouldSkip()).resolves.toBe(true);
    });

    it('returns false when TESTING_UI is unset', async () => {
      delete process.env.TESTING_UI;
      await expect(callShouldSkip()).resolves.toBe(false);
    });

    it('returns false when TESTING_UI is any value other than the literal "1"', async () => {
      process.env.TESTING_UI = 'true';
      await expect(callShouldSkip()).resolves.toBe(false);
    });
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
