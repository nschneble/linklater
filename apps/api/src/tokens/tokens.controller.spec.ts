import { jest } from '@jest/globals';

import { Test, type TestingModule } from '@nestjs/testing';
import { CustomThrottlerGuard } from '../auth/custom-throttler.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ApiDocsTokensService } from './api-docs-tokens.service.js';
import { BookmarkletTokensService } from './bookmarklet-tokens.service.js';
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

    it('uses the token-create throttle bucket (20 / hour)', () => {
      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLtoken-create',
        TokensController.prototype.create,
      );
      const limit = Reflect.getMetadata(
        'THROTTLER:LIMITtoken-create',
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
        'THROTTLER:TTLtoken-create',
        TokensController.prototype.findAll,
      );
      expect(guards).not.toContain(CustomThrottlerGuard);
      expect(ttl).toBeUndefined();
    });

    it('delegates to TokensService.findAll with userId', async () => {
      const tokens = [makeApiToken()];
      (tokensServiceMock.findAll as jest.Mock).mockResolvedValue(tokens);

      const result = await controller.findAll(makeRequest());

      expect(tokensServiceMock.findAll).toHaveBeenCalledWith(USER_ID);
      expect(result).toBe(tokens);
    });
  });

  describe('revoke', () => {
    it('delegates to TokensService.revoke with userId and tokenId', async () => {
      (tokensServiceMock.revoke as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.revoke(makeRequest(), TOKEN_ID);

      expect(tokensServiceMock.revoke).toHaveBeenCalledWith(USER_ID, TOKEN_ID);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getBookmarklet', () => {
    it('delegates to BookmarkletTokensService.getOrCreate with userId', async () => {
      const bookmarklet = { ...makeApiToken(), rawToken: RAW_TOKEN };
      (bookmarkletTokensServiceMock.getOrCreate as jest.Mock).mockResolvedValue(
        bookmarklet,
      );

      const result = await controller.getBookmarklet(makeRequest());

      expect(bookmarkletTokensServiceMock.getOrCreate).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result).toBe(bookmarklet);
    });
  });

  describe('regenerateBookmarklet', () => {
    it('delegates to BookmarkletTokensService.regenerate with userId', async () => {
      const bookmarklet = { ...makeApiToken(), rawToken: RAW_TOKEN };
      (bookmarkletTokensServiceMock.regenerate as jest.Mock).mockResolvedValue(
        bookmarklet,
      );

      const result = await controller.regenerateBookmarklet(makeRequest());

      expect(bookmarkletTokensServiceMock.regenerate).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result).toBe(bookmarklet);
    });
  });

  describe('getApiDocs', () => {
    it('delegates to ApiDocsTokensService.getOrCreate with userId', async () => {
      const apiDocs = { ...makeApiToken(), rawToken: RAW_TOKEN };
      (apiDocsTokensServiceMock.getOrCreate as jest.Mock).mockResolvedValue(
        apiDocs,
      );

      const result = await controller.getApiDocs(makeRequest());

      expect(apiDocsTokensServiceMock.getOrCreate).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result).toBe(apiDocs);
    });
  });
});
