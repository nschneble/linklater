import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

import { Reflector } from '@nestjs/core';
import { TokenScopeService } from './token-scope.service';
import { TokenKind } from '../prisma/index';
import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

const TOKEN_HASH = 'abc123hash';

function makeContext() {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeStorageRecord(isBlocked: boolean) {
  return { totalHits: 1, timeToExpire: 60, isBlocked, timeToBlockExpire: 0 };
}

describe('TokenScopeService', () => {
  const originalTestingUi = process.env.TESTING_UI;

  let reflector: Reflector;
  let storage: ThrottlerStorage;
  let service: TokenScopeService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TESTING_UI;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    storage = {
      increment: jest.fn(() => Promise.resolve(makeStorageRecord(false))),
    } as unknown as ThrottlerStorage;
    service = new TokenScopeService(reflector, storage);
  });

  afterAll(() => {
    process.env.TESTING_UI = originalTestingUi;
  });

  describe('USER tokens', () => {
    it('passes through without any scope check or rate limit', async () => {
      await service.enforce({
        kind: TokenKind.USER,
        tokenHash: TOKEN_HASH,
        context: makeContext(),
      });

      expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
      expect(storage.increment).not.toHaveBeenCalled();
    });
  });

  describe('BOOKMARKLET tokens', () => {
    it('allows a route marked @AllowsBookmarkletToken()', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      await expect(
        service.enforce({
          kind: TokenKind.BOOKMARKLET,
          tokenHash: TOKEN_HASH,
          context: makeContext(),
        }),
      ).resolves.toBeUndefined();

      expect(storage.increment).toHaveBeenCalledTimes(1);
    });

    it('rejects an unmarked route with ForbiddenException', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      await expect(
        service.enforce({
          kind: TokenKind.BOOKMARKLET,
          tokenHash: TOKEN_HASH,
          context: makeContext(),
        }),
      ).rejects.toThrow(ForbiddenException);

      // out-of-scope requests never reach the rate limiter
      expect(storage.increment).not.toHaveBeenCalled();
    });
  });

  // API_DOCS authorizes no route; Origin spoofs (CWE-346), so reject all
  describe('API_DOCS tokens', () => {
    it('rejects every request with ForbiddenException, regardless of Origin', async () => {
      await expect(
        service.enforce({
          kind: TokenKind.API_DOCS,
          tokenHash: TOKEN_HASH,
          context: makeContext(),
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(storage.increment).not.toHaveBeenCalled();
    });

    it('never consults the reflector – there is no route to be scoped to', async () => {
      await expect(
        service.enforce({
          kind: TokenKind.API_DOCS,
          tokenHash: TOKEN_HASH,
          context: makeContext(),
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    it('throws ThrottlerException when the storage reports the token is blocked', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      (storage.increment as jest.Mock).mockReturnValue(
        Promise.resolve(makeStorageRecord(true)),
      );

      await expect(
        service.enforce({
          kind: TokenKind.BOOKMARKLET,
          tokenHash: TOKEN_HASH,
          context: makeContext(),
        }),
      ).rejects.toThrow(ThrottlerException);
    });

    it('keys the limit by token kind and hash', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      await service.enforce({
        kind: TokenKind.BOOKMARKLET,
        tokenHash: TOKEN_HASH,
        context: makeContext(),
      });

      const key = (storage.increment as jest.Mock).mock.calls[0][0];
      expect(key).toBe(`token-scope:BOOKMARKLET:${TOKEN_HASH}`);
    });

    it('is bypassed under TESTING_UI but scope checks still run', async () => {
      process.env.TESTING_UI = '1';
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      await service.enforce({
        kind: TokenKind.BOOKMARKLET,
        tokenHash: TOKEN_HASH,
        context: makeContext(),
      });

      expect(storage.increment).not.toHaveBeenCalled();
    });
  });
});
