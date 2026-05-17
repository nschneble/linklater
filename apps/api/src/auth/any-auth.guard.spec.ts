import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';

import { ApiKeyStrategy } from './api-key.strategy';
import { AnyAuthGuard } from './any-auth.guard';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';

function makeApiKeyStrategy(
  resolvedUser: { userId: string; email: string } | null,
) {
  return {
    validate: jest.fn().mockResolvedValue(resolvedUser),
  } as unknown as ApiKeyStrategy;
}

function makeRequest(authHeader?: string) {
  return {
    headers: { authorization: authHeader },
    user: undefined as unknown,
  };
}

function makeContext(request: ReturnType<typeof makeRequest>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getClass: () => ({}),
    getHandler: () => ({}),
  } as never;
}

describe('AnyAuthGuard', () => {
  describe('handleRequest', () => {
    it('passes a normal user through unchanged', () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy);
      const user = { userId: USER_ID, email: USER_EMAIL };

      expect(guard.handleRequest(null, user, null)).toBe(user);
    });

    it('throws UnauthorizedException when token has mfaPending: true', () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy);
      const user = { userId: USER_ID, email: USER_EMAIL, mfaPending: true };

      expect(() => guard.handleRequest(null, user, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('throws when no user is present', () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy);

      expect(() => guard.handleRequest(null, null, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('re-throws an existing error', () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy);
      const error = new Error('Token expired');

      expect(() => guard.handleRequest(error, null, null)).toThrow(error);
    });
  });

  describe('canActivate (PAT path)', () => {
    it('accepts a ltk_ token via ApiKeyStrategy and sets request.user', async () => {
      const authUser = { userId: USER_ID, email: USER_EMAIL };
      const strategy = makeApiKeyStrategy(authUser);
      const guard = new AnyAuthGuard(strategy);
      const request = makeRequest(`Bearer ltk_somerawtoken`);
      const context = makeContext(request);

      const result = await guard.canActivate(context);

      expect(strategy.validate).toHaveBeenCalledWith('ltk_somerawtoken');
      expect(result).toBe(true);
      expect(request.user).toBe(authUser);
    });

    it('throws UnauthorizedException when ltk_ token is invalid', async () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy);
      const request = makeRequest('Bearer ltk_badtoken');
      const context = makeContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when Authorization header is missing', async () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy);
      const request = makeRequest(undefined);
      const context = makeContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
