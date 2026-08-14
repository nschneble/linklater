/**
 * The bootstrap both extension-authorize HTTP specs run against: the real
 * `JwtAuthGuard`, the real JWT strategy, and the real validation pipe.
 *
 * Shared rather than copied because it is the larger half of either file.
 * The two specs ask different questions of the same stack, one about who
 * is turned away before the handler and one about which bodies the pipe
 * refuses after, and neither is worth seventy lines of setup to ask.
 *
 * The secret is assigned at import time, above everything that reads it.
 * Nest reads it when it builds the strategy, which happens inside
 * `bootExtensionAuthorizeApp`, so the ordering that matters is this
 * module being imported before that call rather than anything about the
 * file it is called from.
 */

import { jest } from '@jest/globals';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

process.env.JWT_SECRET = 'test-secret-for-extension-guard';

import { CustomThrottlerGuard } from './custom-throttler.guard.js';
import { ExtensionAuthController } from './extension-auth.controller.js';
import { ExtensionAuthService } from './extension-auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const CODE = 'auth-code-123';
export const CODE_CHALLENGE = 'sha256-challenge-abc';
export const REDIRECT_URI = 'chrome-extension://abc/callback';
export const USER_EMAIL = 'alice@example.com';
export const USER_ID = 'user-1';

export interface ExtensionAuthorizeHarness {
  app: INestApplication;
  extensionAuthServiceMock: ExtensionAuthService;
  prismaServiceMock: PrismaService;
}

export function signToken(
  payload: Record<string, unknown>,
  secret: string,
): string {
  return new JwtService({ secret }).sign(payload);
}

/** A bearer the strategy accepts, so any refusal is somebody else's. */
export function acceptedToken(): string {
  return signToken(
    { subject: USER_ID, email: USER_EMAIL, tokenVersion: 0 },
    process.env.JWT_SECRET as string,
  );
}

/**
 * Boots the controller with `JwtAuthGuard` left real. The throttler on the
 * sibling token route is overridden only because Nest instantiates every
 * guard on the controller and that one needs a module these tests do not
 * import.
 */
export async function bootExtensionAuthorizeApp(): Promise<ExtensionAuthorizeHarness> {
  const extensionAuthServiceMock = {
    authorizeExtension: jest.fn(),
  } as unknown as ExtensionAuthService;

  const prismaServiceMock = {
    user: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  const moduleReference = await Test.createTestingModule({
    controllers: [ExtensionAuthController],
    providers: [
      JwtStrategy,
      { provide: ExtensionAuthService, useValue: extensionAuthServiceMock },
      { provide: PrismaService, useValue: prismaServiceMock },
    ],
  })
    .overrideGuard(CustomThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleReference.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return { app, extensionAuthServiceMock, prismaServiceMock };
}

/** The mock state every case starts from: a live user, a granting service. */
export function resetHarnessMocks(harness: ExtensionAuthorizeHarness): void {
  jest.clearAllMocks();
  (harness.prismaServiceMock.user.findUnique as jest.Mock).mockResolvedValue({
    tokenVersion: 0,
  });
  (
    harness.extensionAuthServiceMock.authorizeExtension as jest.Mock
  ).mockResolvedValue({ code: CODE, callbackUrl: REDIRECT_URI });
}
