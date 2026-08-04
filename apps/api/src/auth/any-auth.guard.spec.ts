import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';

import { AnyAuthGuard } from './any-auth.guard';
import { ApiKeyStrategy, type ValidatedToken } from './api-key.strategy';
import { TokenScopeService } from './token-scope.service';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';

function makeApiKeyStrategy(resolved: ValidatedToken | null) {
  return {
    validate: jest.fn().mockResolvedValue(resolved),
  } as unknown as ApiKeyStrategy;
}

function makeTokenScope(enforce?: () => Promise<void>) {
  return {
    enforce: jest.fn(enforce ?? (() => Promise.resolve())),
  } as unknown as TokenScopeService;
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
      const guard = new AnyAuthGuard(strategy, makeTokenScope());
      const user = { userId: USER_ID, email: USER_EMAIL };

      expect(guard.handleRequest(null, user, null)).toBe(user);
    });

    it('throws UnauthorizedException when token has mfaPending: true', () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy, makeTokenScope());
      const user = { userId: USER_ID, email: USER_EMAIL, mfaPending: true };

      expect(() => guard.handleRequest(null, user, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('throws when no user is present', () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy, makeTokenScope());

      expect(() => guard.handleRequest(null, null, null)).toThrow(
        UnauthorizedException,
      );
    });

    it('re-throws an existing error', () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy, makeTokenScope());
      const error = new Error('Token expired');

      expect(() => guard.handleRequest(error, null, null)).toThrow(error);
    });
  });

  describe('canActivate (PAT path)', () => {
    const validated: ValidatedToken = {
      userId: USER_ID,
      email: USER_EMAIL,
      kind: 'USER' as ValidatedToken['kind'],
      tokenHash: 'abc123hash',
    };

    it('accepts a ltk_ token, enforces scope, and sets request.user to just userId + email', async () => {
      const strategy = makeApiKeyStrategy(validated);
      const scope = makeTokenScope();
      const guard = new AnyAuthGuard(strategy, scope);
      const request = makeRequest(`Bearer ltk_somerawtoken`);
      const context = makeContext(request);

      const result = await guard.canActivate(context);

      expect(strategy.validate).toHaveBeenCalledWith('ltk_somerawtoken');
      expect(scope.enforce).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'USER',
          tokenHash: 'abc123hash',
          context,
        }),
      );
      expect(result).toBe(true);
      expect(request.user).toEqual({ userId: USER_ID, email: USER_EMAIL });
      // kind/tokenHash must NOT leak onto request.user
      expect(request.user).not.toHaveProperty('tokenHash');
    });

    it('propagates a scope rejection (e.g. bookmarklet on a forbidden route)', async () => {
      const strategy = makeApiKeyStrategy(validated);
      const scope = makeTokenScope(() =>
        Promise.reject(new ForbiddenException('out of scope')),
      );
      const guard = new AnyAuthGuard(strategy, scope);
      const request = makeRequest('Bearer ltk_somerawtoken');
      const context = makeContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      expect(request.user).toBeUndefined();
    });

    it('throws UnauthorizedException when ltk_ token is invalid', async () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy, makeTokenScope());
      const request = makeRequest('Bearer ltk_badtoken');
      const context = makeContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when Authorization header is missing', async () => {
      const strategy = makeApiKeyStrategy(null);
      const guard = new AnyAuthGuard(strategy, makeTokenScope());
      const request = makeRequest(undefined);
      const context = makeContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
