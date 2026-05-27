import { jest } from '@jest/globals';

class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, { code }: { code: string }) {
    super(message);
    this.code = code;
  }
}

jest.mock('../prisma/generated/client', () => ({
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from './tokens.service';

const makeP2025 = () =>
  new (
    Prisma as {
      PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
    }
  ).PrismaClientKnownRequestError('Record not found', { code: 'P2025' });

const makeP2002 = () =>
  new (
    Prisma as {
      PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
    }
  ).PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
  });

const TOKEN_ID = 'token-1';
const USER_ID = 'user-1';
const TOKEN_NAME = 'My Extension';

const makeApiToken = (overrides = {}) => ({
  id: TOKEN_ID,
  name: TOKEN_NAME,
  prefix: 'ltk_aBcDeFgH',
  tokenHash: 'abc123hash',
  userId: USER_ID,
  lastUsedAt: null,
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

describe('TokensService', () => {
  let service: TokensService;

  const prismaMock = {
    apiToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('generates a token starting with ltk_', async () => {
      const stored = makeApiToken();
      (prismaMock.apiToken.create as jest.Mock).mockResolvedValue(stored);

      const result = await service.create(USER_ID, TOKEN_NAME);

      expect(result.rawToken).toMatch(/^ltk_/);
    });

    it('stores a hash that differs from the raw token', async () => {
      const stored = makeApiToken();
      (prismaMock.apiToken.create as jest.Mock).mockResolvedValue(stored);

      const result = await service.create(USER_ID, TOKEN_NAME);

      const callArgs = (prismaMock.apiToken.create as jest.Mock).mock
        .calls[0][0] as { data: { tokenHash: string } };
      expect(callArgs.data.tokenHash).not.toBe(result.rawToken);
    });

    it('stores the first 12 chars of the raw token as prefix', async () => {
      const stored = makeApiToken();
      (prismaMock.apiToken.create as jest.Mock).mockResolvedValue(stored);

      const result = await service.create(USER_ID, TOKEN_NAME);

      const callArgs = (prismaMock.apiToken.create as jest.Mock).mock
        .calls[0][0] as { data: { prefix: string } };
      expect(callArgs.data.prefix).toBe(result.rawToken.slice(0, 12));
    });

    it('returns the stored token fields plus rawToken', async () => {
      const stored = makeApiToken();
      (prismaMock.apiToken.create as jest.Mock).mockResolvedValue(stored);

      const result = await service.create(USER_ID, TOKEN_NAME);

      expect(result.id).toBe(stored.id);
      expect(result.name).toBe(stored.name);
      expect(result.prefix).toBe(stored.prefix);
      expect(result.createdAt).toBe(stored.createdAt);
      expect(result.lastUsedAt).toBe(stored.lastUsedAt);
      expect(result.rawToken).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('returns tokens without tokenHash', async () => {
      const tokens = [makeApiToken(), makeApiToken({ id: 'token-2' })];
      (prismaMock.apiToken.findMany as jest.Mock).mockResolvedValue(tokens);

      const result = await service.findAll(USER_ID);

      expect(result).toHaveLength(2);
      result.forEach((token) => {
        expect(token).not.toHaveProperty('tokenHash');
      });
    });

    it('queries by userId', async () => {
      (prismaMock.apiToken.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll(USER_ID);

      const callArgs = (prismaMock.apiToken.findMany as jest.Mock).mock
        .calls[0][0] as { where: { userId: string } };
      expect(callArgs.where.userId).toBe(USER_ID);
    });

    it('filters out BOOKMARKLET tokens by kind = USER', async () => {
      (prismaMock.apiToken.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll(USER_ID);

      const callArgs = (prismaMock.apiToken.findMany as jest.Mock).mock
        .calls[0][0] as { where: { userId: string; kind: string } };
      expect(callArgs.where.kind).toBe('USER');
    });
  });

  describe('revoke', () => {
    it('deletes by both id and userId', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ kind: 'USER' }),
      );
      (prismaMock.apiToken.delete as jest.Mock).mockResolvedValue(
        makeApiToken(),
      );

      await service.revoke(USER_ID, TOKEN_ID);

      expect(prismaMock.apiToken.delete).toHaveBeenCalledWith({
        where: { id: TOKEN_ID, userId: USER_ID },
      });
    });

    it('throws NotFoundException when token does not exist', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.revoke(USER_ID, 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when token belongs to another user', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ userId: 'someone-else', kind: 'USER' }),
      );

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when token is a BOOKMARKLET', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ kind: 'BOOKMARKLET' }),
      );

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.apiToken.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when delete races and row is gone', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ kind: 'USER' }),
      );
      (prismaMock.apiToken.delete as jest.Mock).mockRejectedValue(makeP2025());

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('re-throws non-P2025 errors from delete', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ kind: 'USER' }),
      );
      (prismaMock.apiToken.delete as jest.Mock).mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        'Connection timeout',
      );
    });
  });

  describe('getOrCreateBookmarkletToken', () => {
    it('returns the existing bookmarklet token without creating a new row', async () => {
      const existing = makeApiToken({
        id: 'bm-1',
        name: 'Bookmarklet',
        kind: 'BOOKMARKLET',
        secretValue: 'ltk_existingrawtoken',
      });
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(existing);

      const result = await service.getOrCreateBookmarkletToken(USER_ID);

      expect(prismaMock.apiToken.findFirst).toHaveBeenCalledWith({
        where: { userId: USER_ID, kind: 'BOOKMARKLET' },
      });
      expect(prismaMock.apiToken.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: existing.id,
        name: existing.name,
        prefix: existing.prefix,
        createdAt: existing.createdAt,
        lastUsedAt: existing.lastUsedAt,
        rawToken: 'ltk_existingrawtoken',
      });
    });

    it('mints a new bookmarklet token when none exists', async () => {
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.apiToken.create as jest.Mock).mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(makeApiToken({ ...data, id: 'bm-new' })),
      );

      const result = await service.getOrCreateBookmarkletToken(USER_ID);

      const callArgs = (prismaMock.apiToken.create as jest.Mock).mock
        .calls[0][0] as {
        data: {
          name: string;
          kind: string;
          secretValue: string;
          userId: string;
          tokenHash: string;
          prefix: string;
        };
      };
      expect(callArgs.data.name).toBe('Bookmarklet');
      expect(callArgs.data.kind).toBe('BOOKMARKLET');
      expect(callArgs.data.userId).toBe(USER_ID);
      expect(callArgs.data.secretValue).toMatch(/^ltk_/);
      expect(callArgs.data.tokenHash).not.toBe(callArgs.data.secretValue);
      expect(callArgs.data.prefix).toBe(callArgs.data.secretValue.slice(0, 12));
      expect(result.rawToken).toBe(callArgs.data.secretValue);
      expect(result.id).toBe('bm-new');
    });

    it('falls back to the existing row when create races (P2002)', async () => {
      const raced = makeApiToken({
        id: 'bm-raced',
        name: 'Bookmarklet',
        kind: 'BOOKMARKLET',
        secretValue: 'ltk_racedrawtoken',
      });
      (prismaMock.apiToken.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(raced);
      (prismaMock.apiToken.create as jest.Mock).mockRejectedValue(makeP2002());

      const result = await service.getOrCreateBookmarkletToken(USER_ID);

      expect(result.rawToken).toBe('ltk_racedrawtoken');
      expect(result.id).toBe('bm-raced');
    });

    it('re-throws non-P2002 errors from create', async () => {
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.apiToken.create as jest.Mock).mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(
        service.getOrCreateBookmarkletToken(USER_ID),
      ).rejects.toThrow('Connection timeout');
    });

    it('re-throws the P2002 error when the recovery findFirst also returns null', async () => {
      // Both create() and the fallback findFirst() fail — the P2002 itself
      // propagates because there is no row to return.
      (prismaMock.apiToken.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prismaMock.apiToken.create as jest.Mock).mockRejectedValue(makeP2002());

      await expect(
        service.getOrCreateBookmarkletToken(USER_ID),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('regenerateBookmarkletToken', () => {
    it('deletes any existing bookmarklet rows and creates a fresh one in a transaction', async () => {
      const created = makeApiToken({
        id: 'bm-regen',
        name: 'Bookmarklet',
        kind: 'BOOKMARKLET',
      });

      const transactionMock = prismaMock.$transaction as unknown as jest.Mock;
      transactionMock.mockImplementation(
        async (callback: (transaction: unknown) => Promise<unknown>) => {
          const transactionClient = {
            apiToken: {
              deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
              create: jest
                .fn()
                .mockImplementation(
                  ({ data }: { data: Record<string, unknown> }) =>
                    Promise.resolve({ ...created, ...data }),
                ),
            },
          };
          const result = await callback(transactionClient);
          (
            transactionMock as unknown as {
              lastClient: typeof transactionClient;
            }
          ).lastClient = transactionClient;
          return result;
        },
      );

      const result = await service.regenerateBookmarkletToken(USER_ID);

      const lastClient = (
        transactionMock as unknown as {
          lastClient: {
            apiToken: { deleteMany: jest.Mock; create: jest.Mock };
          };
        }
      ).lastClient;
      expect(lastClient.apiToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, kind: 'BOOKMARKLET' },
      });
      const createCallArgs = lastClient.apiToken.create.mock.calls[0][0] as {
        data: {
          name: string;
          kind: string;
          secretValue: string;
          userId: string;
        };
      };
      expect(createCallArgs.data.name).toBe('Bookmarklet');
      expect(createCallArgs.data.kind).toBe('BOOKMARKLET');
      expect(createCallArgs.data.userId).toBe(USER_ID);
      expect(createCallArgs.data.secretValue).toMatch(/^ltk_/);
      expect(result.rawToken).toBe(createCallArgs.data.secretValue);
      expect(result.id).toBe('bm-regen');
    });
  });

  describe('validateToken', () => {
    it('returns user when token matches', async () => {
      const user = { id: USER_ID, email: 'user@example.com' };
      const stored = makeApiToken({ user });
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(stored);
      (prismaMock.apiToken.update as jest.Mock).mockResolvedValue(stored);

      const result = await service.validateToken('ltk_sometoken');

      expect(result).toBe(user);
    });

    it('returns null when token does not match', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateToken('ltk_badtoken');

      expect(result).toBeNull();
    });

    it('updates lastUsedAt on a successful lookup', async () => {
      const stored = makeApiToken({ user: { id: USER_ID } });
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(stored);
      (prismaMock.apiToken.update as jest.Mock).mockResolvedValue(stored);

      await service.validateToken('ltk_sometoken');

      expect(prismaMock.apiToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: expect.any(String) as string },
          data: { lastUsedAt: expect.any(Date) as Date },
        }),
      );
    });
  });
});
