import { jest } from '@jest/globals';

import { ApiDocsTokensService } from './api-docs-tokens.service.js';
import { BookmarkletTokensService } from './bookmarklet-tokens.service.js';
import { CustomThrottlerGuard } from '../auth/custom-throttler.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Test, type TestingModule } from '@nestjs/testing';
import { TokensController } from './tokens.controller.js';
import { TokensService } from './tokens.service.js';
import type { AuthRequest } from '../auth/index.js';

const TOKEN_ID = 'token-1';
const USER_ID = 'user-1';
const TOKEN_NAME = 'My Extension';
const RAW_TOKEN = 'ltk_aBcDeFgHiJkLmNoPqRsTuVwXyZ12';

const makeApiToken = (overrides = {}) => ({
  id: TOKEN_ID,
  name: TOKEN_NAME,
  prefix: 'ltk_aBcDeFgH',
  createdAt: new Date('2026-01-01'),
  lastUsedAt: null,
  ...overrides,
});

const makeRequest = (userId = USER_ID) => ({ user: { userId } }) as AuthRequest;

describe('TokensController', () => {
  let controller: TokensController;

  const tokensServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    revoke: jest.fn(),
  } as unknown as TokensService;

  const bookmarkletTokensServiceMock = {
    getOrCreate: jest.fn(),
    regenerate: jest.fn(),
  } as unknown as BookmarkletTokensService;

  const apiDocsTokensServiceMock = {
    getOrCreate: jest.fn(),
  } as unknown as ApiDocsTokensService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TokensController],
      providers: [
        { provide: TokensService, useValue: tokensServiceMock },
        {
          provide: BookmarkletTokensService,
          useValue: bookmarkletTokensServiceMock,
        },
        {
          provide: ApiDocsTokensService,
          useValue: apiDocsTokensServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TokensController>(TokensController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('delegates to TokensService.create with userId and name', async () => {
      const created = { ...makeApiToken(), rawToken: RAW_TOKEN };
      (tokensServiceMock.create as jest.Mock).mockResolvedValue(created);

      const result = await controller.create(makeRequest(), {
        name: TOKEN_NAME,
      });

      expect(tokensServiceMock.create).toHaveBeenCalledWith(
        USER_ID,
        TOKEN_NAME,
      );
      expect(result).toBe(created);
    });

    it('applies CustomThrottlerGuard to cap token-creation spam', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        TokensController.prototype.create,
      );
      expect(guards).toContain(CustomThrottlerGuard);
    });

    it('overrides the default bucket with 20 requests per hour', () => {
      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLdefault',
        TokensController.prototype.create,
      );
      const limit = Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        TokensController.prototype.create,
      );
      expect(ttl).toBe(3600000);
      expect(limit).toBe(20);
    });
  });

  describe('findAll', () => {
    it('is not throttled (reads should not consume the create bucket)', () => {
      const guards: unknown[] =
        Reflect.getMetadata('__guards__', TokensController.prototype.findAll) ??
        [];
      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLdefault',
        TokensController.prototype.findAll,
      );
      expect(guards).not.toContain(CustomThrottlerGuard);
      expect(ttl).toBeUndefined();
    });
  });
});
