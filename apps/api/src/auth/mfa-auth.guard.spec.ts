import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';

import { JwtService } from '@nestjs/jwt';
import { MfaAuthGuard } from './mfa-auth.guard.js';

function makeGuard() {
  const jwtService = new JwtService({ secret: 'test-secret-for-unit-tests' });
  return new MfaAuthGuard(jwtService);
}

function makeRequest(body: Record<string, unknown>) {
  return {
    body,
    user: undefined as unknown,
  };
}

function makeContext(request: ReturnType<typeof makeRequest>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('MfaAuthGuard', () => {
  let guard: MfaAuthGuard;

  beforeEach(() => {
    guard = makeGuard();
    jest.clearAllMocks();
  });

  it('populates request.user for a valid mfaPending token', async () => {
    const jwtService = new JwtService({ secret: 'test-secret-for-unit-tests' });
    const mfaToken = jwtService.sign(
      { subject: 'user-1', mfaPending: true },
      { expiresIn: '5m' },
    );
    const request = makeRequest({ mfaToken });
    const context = makeContext(request);

    await guard.canActivate(context);

    expect(request.user).toMatchObject({ userId: 'user-1', mfaPending: true });
  });

  it('throws UnauthorizedException when mfaToken is absent', async () => {
    const request = makeRequest({});
    const context = makeContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when token lacks mfaPending: true', async () => {
    const jwtService = new JwtService({ secret: 'test-secret-for-unit-tests' });
    const fullToken = jwtService.sign({ subject: 'user-1', email: 'u@x.com' });
    const request = makeRequest({ mfaToken: fullToken });
    const context = makeContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when token is expired', async () => {
    const jwtService = new JwtService({ secret: 'test-secret-for-unit-tests' });
    const expiredToken = jwtService.sign(
      { subject: 'user-1', mfaPending: true },
      { expiresIn: '0s' },
    );
    const request = makeRequest({ mfaToken: expiredToken });
    const context = makeContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when token is signed with wrong secret', async () => {
    const wrongService = new JwtService({ secret: 'wrong-secret' });
    const wrongToken = wrongService.sign(
      { subject: 'user-1', mfaPending: true },
      { expiresIn: '5m' },
    );
    const request = makeRequest({ mfaToken: wrongToken });
    const context = makeContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
