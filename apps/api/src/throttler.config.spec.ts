import { AuthController } from './auth/auth.controller.js';
import { CustomThrottlerGuard } from './auth/custom-throttler.guard.js';
import { jest } from '@jest/globals';
import { LinksController } from './links/links.controller.js';
import { Reflector } from '@nestjs/core';
import { THROTTLER_CONFIG } from './throttler.config.js';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Runtime composition test for the rate limiter.
 *
 * This boots the real `CustomThrottlerGuard` against the real
 * `THROTTLER_CONFIG` and the real controller handlers, then drives repeated
 * requests through `canActivate` to prove that each route binds only its own
 * declared limit. Under the previous multi-bucket config the guard applied
 * every declared bucket to every route, so the tightest bucket (3 / minute)
 * capped even routes whose own limit was far higher (POST /links at 60 / minute
 * was really capped at 3). This test locks in the single-bucket design where a
 * route enforces precisely the ttl/limit in its own `@Throttle` decorator.
 */

const CLIENT_IP = '203.0.113.7';

function makeExecutionContext(
  controllerClass: unknown,
  handler: (...unknownArguments: unknown[]) => unknown,
): ExecutionContext {
  const request = { ip: CLIENT_IP, ips: [] as string[], headers: {} };
  const response = { header: () => undefined };
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

async function makeGuard(): Promise<CustomThrottlerGuard> {
  const storage = new ThrottlerStorageService();
  const guard = new CustomThrottlerGuard(
    THROTTLER_CONFIG,
    storage,
    new Reflector(),
  );
  await guard.onModuleInit();
  return guard;
}

/**
 * Sends requests through the guard until it throws a `ThrottlerException`,
 * returning how many were allowed through before the block. `cap` bounds the
 * loop so a route that never blocks cannot hang the suite.
 */
async function countAllowedBeforeBlock(
  guard: CustomThrottlerGuard,
  context: ExecutionContext,
  cap = 500,
): Promise<number> {
  let allowed = 0;
  for (let attempt = 0; attempt < cap; attempt++) {
    try {
      await guard.canActivate(context);
      allowed++;
    } catch (error) {
      if (error instanceof ThrottlerException) {
        return allowed;
      }
      throw error;
    }
  }
  return allowed;
}

describe('throttler runtime composition', () => {
  const originalTestingUi = process.env.TESTING_UI;

  beforeEach(() => {
    // guard skips throttling under TESTING_UI, which would hide the limits
    delete process.env.TESTING_UI;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalTestingUi === undefined) {
      delete process.env.TESTING_UI;
    } else {
      process.env.TESTING_UI = originalTestingUi;
    }
  });

  it('declares exactly one throttler bucket named default', () => {
    expect(THROTTLER_CONFIG).toHaveLength(1);
    expect(THROTTLER_CONFIG[0].name).toBe('default');
  });

  it('caps POST /links at its own 60 / minute limit, not the tightest bucket', async () => {
    const guard = await makeGuard();
    const context = makeExecutionContext(
      LinksController,
      LinksController.prototype.create,
    );

    const allowed = await countAllowedBeforeBlock(guard, context);

    // core regression: must allow far more than the old 3 / minute union cap
    expect(allowed).toBeGreaterThan(3);
    expect(allowed).toBe(60);
  });

  it('caps login at its own 10 / minute limit', async () => {
    const guard = await makeGuard();
    const context = makeExecutionContext(
      AuthController,
      AuthController.prototype.login,
    );

    const allowed = await countAllowedBeforeBlock(guard, context);

    expect(allowed).toBe(10);
  });

  it('caps forgot-password at its own tight 3 / minute limit', async () => {
    const guard = await makeGuard();
    const context = makeExecutionContext(
      AuthController,
      AuthController.prototype.forgotPassword,
    );

    const allowed = await countAllowedBeforeBlock(guard, context);

    expect(allowed).toBe(3);
  });

  it('gives each route an independent counter so one does not exhaust another', async () => {
    const guard = await makeGuard();
    const forgotPasswordContext = makeExecutionContext(
      AuthController,
      AuthController.prototype.forgotPassword,
    );
    const loginContext = makeExecutionContext(
      AuthController,
      AuthController.prototype.login,
    );

    // exhaust forgot-password (3 / minute)
    await countAllowedBeforeBlock(guard, forgotPasswordContext);

    // login still enforces its own 10 / minute, untouched by forgot-password
    const loginAllowed = await countAllowedBeforeBlock(guard, loginContext);
    expect(loginAllowed).toBe(10);
  });
});
