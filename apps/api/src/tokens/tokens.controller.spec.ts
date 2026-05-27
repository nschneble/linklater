import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';
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
    getOrCreateBookmarkletToken: jest.fn(),
    regenerateBookmarkletToken: jest.fn(),
    revoke: jest.fn(),
  } as unknown as TokensService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TokensController],
      providers: [{ provide: TokensService, useValue: tokensServiceMock }],
    }).compile();

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
  });

  describe('findAll', () => {
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
    it('delegates to TokensService.getOrCreateBookmarkletToken with userId', async () => {
      const bookmarklet = { ...makeApiToken(), rawToken: RAW_TOKEN };
      (
        tokensServiceMock.getOrCreateBookmarkletToken as jest.Mock
      ).mockResolvedValue(bookmarklet);

      const result = await controller.getBookmarklet(makeRequest());

      expect(
        tokensServiceMock.getOrCreateBookmarkletToken,
      ).toHaveBeenCalledWith(USER_ID);
      expect(result).toBe(bookmarklet);
    });
  });

  describe('regenerateBookmarklet', () => {
    it('delegates to TokensService.regenerateBookmarkletToken with userId', async () => {
      const bookmarklet = { ...makeApiToken(), rawToken: RAW_TOKEN };
      (
        tokensServiceMock.regenerateBookmarkletToken as jest.Mock
      ).mockResolvedValue(bookmarklet);

      const result = await controller.regenerateBookmarklet(makeRequest());

      expect(tokensServiceMock.regenerateBookmarkletToken).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result).toBe(bookmarklet);
    });
  });
});
